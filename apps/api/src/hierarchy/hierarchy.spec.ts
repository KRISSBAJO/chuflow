import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { ensureHierarchyManager, hierarchyParent } from './hierarchy.policy';
import { HierarchyService } from './hierarchy.service';
import { validateSync } from 'class-validator';
import { UpdateHierarchyDto } from './hierarchy.dto';
type Row = Record<string, unknown>;
const id = () => new Types.ObjectId();
function equal(a: unknown, b: unknown) {
  const text = (v: unknown) =>
    v instanceof Types.ObjectId
      ? v.toHexString()
      : typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number'
        ? String(v)
        : '';
  return text(a) === text(b);
}
function matches(row: Row, filter: Row): boolean {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$and') return (value as Row[]).every((q) => matches(row, q));
    if (key === '$or') return (value as Row[]).some((q) => matches(row, q));
    if (value && typeof value === 'object' && '$in' in value)
      return (value.$in as unknown[]).some((v) => equal(row[key], v));
    return equal(row[key], value);
  });
}
function q<T>(value: T) {
  return {
    lean: jest.fn().mockResolvedValue(value),
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
  };
}
function fixture() {
  const districtId = id(),
    districtUnitId = id(),
    zoneId = id(),
    areaId = id(),
    pastorId = id(),
    headquartersId = id();
  const district: Row = {
    _id: districtId,
    name: 'District A',
    oversightRegion: 'Region A',
    isActive: true,
  };
  const units: Row[] = [
    {
      _id: districtUnitId,
      kind: 'district',
      districtId,
      name: 'District A',
      isActive: true,
    },
    {
      _id: zoneId,
      kind: 'zone',
      districtId,
      parentId: districtUnitId,
      name: 'Zone A',
      isActive: true,
    },
    {
      _id: areaId,
      kind: 'area',
      districtId,
      parentId: zoneId,
      name: 'Area A',
      isActive: true,
      pastorUserId: pastorId,
      headquartersBranchId: headquartersId,
    },
  ];
  const churches: Row[] = [
    {
      _id: headquartersId,
      name: 'Headquarters local church',
      oversightRegion: 'Region A',
      district: 'District A',
      zoneId,
      areaId,
    },
    {
      _id: id(),
      name: 'Area local church',
      oversightRegion: 'Region A',
      district: 'District A',
      zoneId,
      areaId,
    },
    {
      _id: id(),
      name: 'Sibling area church',
      oversightRegion: 'Region A',
      district: 'District A',
      zoneId,
      areaId: id(),
    },
    {
      _id: id(),
      name: 'Sibling zone church',
      oversightRegion: 'Region A',
      district: 'District A',
      zoneId: id(),
      areaId: id(),
    },
    {
      _id: id(),
      name: 'Other district church',
      oversightRegion: 'Region A',
      district: 'District B',
    },
  ];
  for (const church of churches) church.status = 'active';
  const branchModel = {
    findOne: jest.fn((filter: Row) =>
      q(churches.find((b) => matches(b, filter)) || null),
    ),
    exists: jest.fn((filter: Row) =>
      Promise.resolve(churches.find((b) => matches(b, filter)) || null),
    ),
    find: jest.fn((filter: Row) =>
      q(churches.filter((b) => matches(b, filter))),
    ),
  };
  const unitModel = {
    findOne: jest.fn((filter: Row) =>
      q(units.find((u) => matches(u, filter)) || null),
    ),
    exists: jest.fn((filter: Row) =>
      Promise.resolve(units.find((u) => matches(u, filter)) || null),
    ),
    find: jest.fn((filter: Row) => q(units.filter((u) => matches(u, filter)))),
  };
  const districtModel = {
    find: jest.fn((filter: Row) =>
      q(matches(district, filter) ? [district] : []),
    ),
    findOne: jest.fn((filter: Row) =>
      q(matches(district, filter) ? district : null),
    ),
  };
  const scope = new AccessScopeService(
    ...([
      branchModel,
      unitModel,
      districtModel,
    ] as unknown as ConstructorParameters<typeof AccessScopeService>),
  );
  const user: AuthUser = {
    sub: String(pastorId),
    branchId: String(headquartersId),
    email: 'pastor@example.test',
    role: 'resident_pastor',
    oversightRegion: 'Region A',
    district: 'District A',
  };
  return {
    scope,
    user,
    units,
    churches,
    district,
    branchModel,
    unitModel,
    districtModel,
    districtId,
    districtUnitId,
    zoneId,
    areaId,
    headquartersId,
    pastorId,
  };
}
describe('Local church plus independent oversight access', () => {
  it('keeps scope intact when a directory adds its own search OR', async () => {
    const f = fixture();
    const scope = await f.scope.getBranchDocumentQuery(f.user);
    expect(scope).not.toHaveProperty('$or');
    const query = {
      ...scope,
      $or: [{ name: 'Sibling area church' }, { name: 'Area local church' }],
    };
    expect(
      f.churches.filter((c) => matches(c, query)).map((c) => c.name),
    ).toEqual(['Area local church']);
  });
  it('rolls up existing church records once instead of adding overlapping headquarters counts', async () => {
    const f = fixture();
    for (const unit of f.units)
      Object.assign(unit, {
        pastorUserId: f.pastorId,
        headquartersBranchId: f.headquartersId,
      });
    const service = new HierarchyService(
      ...([
        f.unitModel,
        {},
        f.branchModel,
        f.districtModel,
        {},
        {
          aggregate: jest.fn().mockResolvedValue([
            { _id: f.headquartersId, total: 5 },
            { _id: f.churches[1]._id, total: 3 },
          ]),
        },
        {
          aggregate: jest
            .fn()
            .mockResolvedValue([{ _id: f.headquartersId, total: 4 }]),
        },
        f.scope,
      ] as unknown as ConstructorParameters<typeof HierarchyService>),
    );
    const result = await service.list(f.user);
    const units = result.units as Row[];
    expect(units.find((u) => u.kind === 'district')).toMatchObject({
      churches: 4,
      members: 8,
      guests: 4,
      partial: false,
    });
    expect(units.find((u) => u.kind === 'area')).toMatchObject({
      churches: 2,
      members: 8,
      guests: 4,
    });
  });
  it('area pastor sees the headquarters once plus local churches in the appointed area', async () => {
    const f = fixture();
    const ids = await f.scope.getAccessibleBranchIds(f.user);
    expect(ids).toEqual([String(f.churches[0]._id), String(f.churches[1]._id)]);
    expect(new Set(ids).size).toBe(ids?.length);
  });
  it('zonal appointment includes child areas but not neighboring zones', async () => {
    const f = fixture();
    Object.assign(f.units[1], {
      pastorUserId: f.pastorId,
      headquartersBranchId: f.headquartersId,
    });
    expect(await f.scope.getAccessibleBranchIds(f.user)).toHaveLength(3);
  });
  it('district appointment includes all district churches, including those awaiting placement', async () => {
    const f = fixture();
    Object.assign(f.units[0], {
      pastorUserId: f.pastorId,
      headquartersBranchId: f.headquartersId,
    });
    expect(await f.scope.getAccessibleBranchIds(f.user)).toHaveLength(4);
  });
  it('overlapping district, zone and area appointments do not duplicate churches', async () => {
    const f = fixture();
    for (const unit of f.units)
      Object.assign(unit, {
        pastorUserId: f.pastorId,
        headquartersBranchId: f.headquartersId,
      });
    const ids = await f.scope.getAccessibleBranchIds(f.user);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
  });
  it('unappointed resident pastors retain their original local-only scope', async () => {
    const f = fixture();
    f.units[2].pastorUserId = id();
    expect(await f.scope.getAccessibleBranchIds(f.user)).toEqual([
      String(f.headquartersId),
    ]);
  });
  it('support roles cannot acquire oversight by a forged or stale appointment', async () => {
    const f = fixture();
    expect(
      await f.scope.getAccessibleBranchIds({ ...f.user, role: 'follow_up' }),
    ).toEqual([String(f.headquartersId)]);
  });
  it('transferring a pastor to another church invalidates the old appointment immediately', async () => {
    const f = fixture();
    expect(
      await f.scope.oversightAssignments({
        ...f.user,
        branchId: String(f.churches[2]._id),
      }),
    ).toEqual([]);
  });
  it('an appointment whose headquarters is outside its area grants no oversight', async () => {
    const f = fixture();
    f.churches[0].areaId = id();
    expect(await f.scope.oversightAssignments(f.user)).toEqual([]);
  });
  it.each([0, 1, 2])(
    'an inactive ancestor or appointed unit (%s) revokes oversight',
    async (index) => {
      const f = fixture();
      f.units[index].isActive = false;
      expect(await f.scope.oversightAssignments(f.user)).toEqual([]);
    },
  );
  it('an inactive district catalog revokes oversight', async () => {
    const f = fixture();
    f.district.isActive = false;
    expect(await f.scope.oversightAssignments(f.user)).toEqual([]);
  });
  it('rejects direct record access outside the appointed area', async () => {
    const f = fixture();
    await expect(
      f.scope.ensureBranchAccess(f.user, String(f.churches[2]._id)),
    ).rejects.toThrow(ForbiddenException);
  });
  it('supports explicitly selecting a child church, while creation defaults to the pastor’s own church', async () => {
    const f = fixture();
    expect(await f.scope.resolveScopedBranchId(f.user)).toBe(
      String(f.headquartersId),
    );
    expect(
      await f.scope.resolveScopedBranchId(f.user, String(f.churches[1]._id)),
    ).toBe(String(f.churches[1]._id));
  });
  it('preserves legacy district and national account boundaries', async () => {
    const f = fixture();
    expect(
      await f.scope.getBranchDocumentQuery({
        ...f.user,
        role: 'district_pastor',
      }),
    ).toEqual({ oversightRegion: 'Region A', district: 'District A' });
    expect(
      await f.scope.getBranchDocumentQuery({
        ...f.user,
        role: 'national_admin',
      }),
    ).toEqual({ oversightRegion: 'Region A' });
  });
});
describe('Hierarchy management boundaries', () => {
  it('rejects null switches and hidden parent changes in appointment requests', () => {
    expect(
      validateSync(
        Object.assign(new UpdateHierarchyDto(), {
          expectedRevision: 0,
          isActive: null,
        }),
      ),
    ).toHaveLength(1);
    expect(
      validateSync(
        Object.assign(new UpdateHierarchyDto(), {
          expectedRevision: 0,
          parentId: String(id()),
        }),
        { whitelist: true, forbidNonWhitelisted: true },
      ),
    ).toHaveLength(1);
  });
  it('does not appoint a headquarters church outside the unit', async () => {
    const f = fixture();
    const service = Object.create(
      HierarchyService.prototype,
    ) as HierarchyService;
    const users = { findOne: jest.fn() };
    Object.assign(service, {
      units: { findById: () => q(f.units[2]) },
      branches: { findOne: () => q(null) },
      users,
      scope: f.scope,
    });
    jest
      .spyOn(
        service as unknown as { district: () => Promise<unknown> },
        'district',
      )
      .mockResolvedValue(f.district);
    await expect(
      service.update({ ...f.user, role: 'super_admin' }, String(f.areaId), {
        expectedRevision: 0,
        headquartersBranchId: String(f.churches[2]._id),
        pastorUserId: String(f.pastorId),
      }),
    ).rejects.toThrow('inside this oversight unit');
    expect(users.findOne).not.toHaveBeenCalled();
  });
  it('prevents moving an area headquarters out of its area while its appointment is active', async () => {
    const f = fixture();
    const service = Object.create(
      HierarchyService.prototype,
    ) as HierarchyService;
    Object.assign(service, {
      branches: { findById: () => q(f.churches[0]) },
      districts: f.districtModel,
      units: f.unitModel,
      scope: f.scope,
    });
    await expect(
      service.place(
        { ...f.user, role: 'super_admin' },
        String(f.headquartersId),
        { expectedRevision: 0, unitId: String(f.zoneId) },
      ),
    ).rejects.toThrow('Clear the affected headquarters appointment');
  });
  it('requires the exact district → zone → area parent order', () => {
    expect(() => hierarchyParent('zone', 'area')).toThrow(BadRequestException);
    expect(() => hierarchyParent('area', 'district')).toThrow(
      BadRequestException,
    );
    expect(() => hierarchyParent('district', 'zone')).toThrow(
      BadRequestException,
    );
    expect(() => hierarchyParent('zone', 'district')).not.toThrow();
    expect(() => hierarchyParent('area', 'zone')).not.toThrow();
  });
  it('pastors cannot grant themselves oversight or reorganize churches', () => {
    const f = fixture();
    expect(() =>
      ensureHierarchyManager(f.user, {
        name: 'District A',
        oversightRegion: 'Region A',
      }),
    ).toThrow(ForbiddenException);
  });
  it('district administrators cannot appoint into another district or region', () => {
    const f = fixture();
    expect(() =>
      ensureHierarchyManager(
        { ...f.user, role: 'district_admin' },
        { name: 'District B', oversightRegion: 'Region A' },
      ),
    ).toThrow(ForbiddenException);
    expect(() =>
      ensureHierarchyManager(
        { ...f.user, role: 'national_admin' },
        { name: 'District A', oversightRegion: 'Region B' },
      ),
    ).toThrow(ForbiddenException);
  });
  it('rejects a pastor who is not the active resident pastor of the headquarters', async () => {
    const f = fixture();
    const service = Object.create(
      HierarchyService.prototype,
    ) as HierarchyService;
    Object.assign(service, {
      units: { findById: () => q({ ...f.units[2], revision: 0 }) },
      branches: { findOne: () => q(f.churches[0]) },
      users: { findOne: () => q(null) },
      scope: f.scope,
    });
    jest
      .spyOn(
        service as unknown as { district: () => Promise<unknown> },
        'district',
      )
      .mockResolvedValue(f.district);
    await expect(
      service.update({ ...f.user, role: 'super_admin' }, String(f.areaId), {
        expectedRevision: 0,
        headquartersBranchId: String(f.headquartersId),
        pastorUserId: String(id()),
      }),
    ).rejects.toThrow('active resident pastor');
  });
  it('rejects stale appointment edits rather than overwriting another administrator', async () => {
    const f = fixture();
    const service = Object.create(
      HierarchyService.prototype,
    ) as HierarchyService;
    Object.assign(service, {
      units: {
        findById: () => q({ ...f.units[2], revision: 2 }),
        findOneAndUpdate: jest.fn().mockResolvedValue(null),
      },
    });
    jest
      .spyOn(
        service as unknown as { district: () => Promise<unknown> },
        'district',
      )
      .mockResolvedValue(f.district);
    await expect(
      service.update({ ...f.user, role: 'super_admin' }, String(f.areaId), {
        expectedRevision: 0,
        clearAppointment: true,
      }),
    ).rejects.toThrow(ConflictException);
  });
});
