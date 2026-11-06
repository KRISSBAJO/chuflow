import { Reflector } from '@nestjs/core';
import { PATH_METADATA } from '@nestjs/common/constants';
import type { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
import { childrenApiAllowed } from '../common/children-access';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { validateSync } from 'class-validator';
import { ChildrenService } from './children.service';
import {
  ChildFamily,
  ChildProfile,
  ChildSession,
  ChildKiosk,
  ChildSessionSchema,
  ChildKioskSchema,
  type ChildVisit,
} from './children.schema';
import {
  ageMonths,
  tokenHash,
  cardToken,
  pickupToken,
  checkRoom,
  validatePickup,
  requireUnique,
} from './children.logic';
import { CheckInDto, CheckoutDto } from './children.dto';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { Branch } from '../branches/schemas/branch.schema';
import { Member, MemberSchema } from '../members/schemas/member.schema';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
const id = () => new Types.ObjectId();
const asModel = <T>(value: unknown) => value as Model<T>;
function q<T>(value: T) {
  return {
    lean: jest
      .fn()
      .mockImplementation(() => Promise.resolve(structuredClone(value))),
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
  };
}
// ObjectIds must retain their identity in simulated database reads.
function copy<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
function fixture() {
  const branchId = id(),
    familyId = id(),
    childId = id(),
    sessionId = id(),
    workerId = id().toString(),
    guardianId = randomUUID(),
    otherGuardian = randomUUID(),
    roomId = randomUUID();
  const user: AuthUser = {
    sub: workerId,
    email: 'worker@example.com',
    role: 'children_supervisor',
    branchId: String(branchId),
  };
  const family = {
    _id: familyId,
    branchId,
    name: 'Family A',
    isActive: true,
    guardians: [
      {
        id: guardianId,
        firstName: 'Parent',
        lastName: 'One',
        phone: '555-0100',
        relationship: 'Parent',
        canCheckIn: true,
      },
      {
        id: otherGuardian,
        firstName: 'Emergency',
        lastName: 'Contact',
        phone: '555-0200',
        relationship: 'Emergency contact',
        canCheckIn: false,
      },
    ],
    revision: 0,
  };
  const child = {
    _id: childId,
    branchId,
    familyId,
    firstName: 'Child',
    lastName: 'Example',
    birthDate: '2022-01-01',
    guardianIds: [guardianId, otherGuardian],
    pickupGuardianIds: [guardianId],
    careNotes: 'PRIVATE CARE',
    pickupNotes: 'PRIVATE PICKUP',
    isActive: true,
    isMember: true,
    revision: 0,
  };
  const session = {
    _id: sessionId,
    branchId,
    name: 'Sunday',
    startsAt: new Date(Date.now() - 3600000),
    endsAt: new Date(Date.now() + 3600000),
    status: 'open',
    rooms: [
      {
        id: roomId,
        name: 'Preschool',
        minMonths: 0,
        maxMonths: 215,
        capacity: 2,
      },
    ],
    visits: [] as ChildVisit[],
    events: [],
    revision: 0,
  };
  const families = {
    findById: jest.fn(() => query(family)),
    findOne: jest.fn(() => query(family)),
    find: jest.fn(() => query([family])),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
  const children = {
    find: jest.fn(() => query([child])),
    findById: jest.fn(() => query(child)),
    findOne: jest.fn(() => query(child)),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
  const sessions = {
    findById: jest.fn(() => query(session)),
    exists: jest.fn().mockResolvedValue(null),
    updateOne: jest.fn(
      (filter: Record<string, unknown>, update: Record<string, unknown>) => {
        if (filter.revision !== session.revision)
          return Promise.resolve({ modifiedCount: 0 });
        const set = update.$set as
          | { visits?: ChildVisit[]; status?: string }
          | undefined;
        if (set?.visits) session.visits = copy(set.visits);
        if (set?.status) session.status = set.status;
        const push = update.$push as
          | { visits?: { $each: ChildVisit[] } }
          | undefined;
        if (push?.visits) session.visits.push(...copy(push.visits.$each));
        session.revision++;
        return Promise.resolve({ modifiedCount: 1 });
      },
    ),
  };
  const kiosks = {
    findOne: jest.fn(() => query(null)),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
  const branches = {
    findOne: jest.fn(() => query({ _id: branchId, name: 'Church' })),
    findById: jest.fn(() => query({ _id: branchId, name: 'Church' })),
  };
  const members = {
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
  const scope = {
    getBranchDocumentQuery: jest.fn().mockResolvedValue({ _id: branchId }),
  };
  const service = new ChildrenService(
    asModel<ChildFamily>(families),
    asModel<ChildProfile>(children),
    asModel<ChildSession>(sessions),
    asModel<ChildKiosk>(kiosks),
    asModel<Branch>(branches),
    asModel<Member>(members),
    scope as unknown as AccessScopeService,
  );
  const dto = {
    familyId: String(familyId),
    guardianId,
    children: [{ childId: String(childId), roomId }],
    adultConfirmed: true,
  };
  return {
    service,
    user,
    family,
    child,
    session,
    families,
    children,
    sessions,
    kiosks,
    branches,
    members,
    dto,
    guardianId,
    otherGuardian,
    roomId,
  };
}
function query<T>(value: T) {
  const result = q(value);
  result.lean.mockImplementation(() =>
    Promise.resolve(value === null ? null : copyPreservingDates(value)),
  );
  return result;
}
function copyPreservingDates<T>(value: T): T {
  if (value instanceof Date) return new Date(value) as T;
  if (value instanceof Types.ObjectId)
    return new Types.ObjectId(String(value)) as T;
  if (Array.isArray(value)) return value.map(copyPreservingDates) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, copyPreservingDates(v)]),
    ) as T;
  return value;
}
describe('child identity and room rules', () => {
  it('codes carry no child identity and permanent cards differ from pickup receipts', () => {
    const a = cardToken(),
      b = pickupToken();
    expect(a).toMatch(/^cfc_[A-Za-z0-9_-]{32}$/);
    expect(b).toMatch(/^cfp_[A-Za-z0-9_-]{32}$/);
    expect(tokenHash(a)).not.toContain(a);
    expect(tokenHash(a)).toHaveLength(64);
    expect(cardToken()).not.toBe(a);
  });
  it('validates real birth dates and completed-month boundaries', () => {
    expect(ageMonths('2022-01-15', new Date('2026-01-14'))).toBe(47);
    expect(ageMonths('2022-01-15', new Date('2026-01-15'))).toBe(48);
    expect(() => ageMonths('2026-02-31')).toThrow(BadRequestException);
    expect(() => ageMonths('2999-01-01')).toThrow(BadRequestException);
  });
  it('rejects duplicate child selections', () =>
    expect(() => requireUnique(['a', 'a'], 'child')).toThrow(
      BadRequestException,
    ));
  it('enforces capacity including siblings in the same submission', () => {
    const f = fixture();
    expect(() =>
      checkRoom(
        f.session.rooms[0],
        f.child.birthDate,
        [],
        3,
        f.session.startsAt,
      ),
    ).toThrow(BadRequestException);
  });
  it('rejects age-inappropriate classrooms', () => {
    const f = fixture();
    expect(() =>
      checkRoom(
        { ...f.session.rooms[0], maxMonths: 12 },
        f.child.birthDate,
        [],
        1,
        f.session.startsAt,
      ),
    ).toThrow(BadRequestException);
  });
  it('pickup requires both authorized adult and identity confirmation', () => {
    expect(() =>
      validatePickup({ pickupGuardianIds: ['a'] }, 'a', false),
    ).toThrow(BadRequestException);
    expect(() =>
      validatePickup({ pickupGuardianIds: ['a'] }, 'b', true),
    ).toThrow(BadRequestException);
  });
  it('only one open session per branch is enforced by a partial unique index', () =>
    expect(ChildSessionSchema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { branchId: 1 },
          expect.objectContaining({
            unique: true,
            partialFilterExpression: { status: 'open' },
          }),
        ],
      ]),
    ));
  it('kiosk credentials are not selected by default and expire', () => {
    expect(ChildKioskSchema.path('tokenHash').options.select).toBe(false);
    expect(
      ChildKioskSchema.indexes().some(
        ([, o]) => o.expireAfterSeconds !== undefined,
      ),
    ).toBe(true);
  });
  it('general member records contain no guardian or care details', () => {
    expect(MemberSchema.path('recordType')).toBeDefined();
    expect(MemberSchema.path('careNotes')).toBeUndefined();
    expect(MemberSchema.path('pickupGuardianIds')).toBeUndefined();
  });
});
describe('check-in invariants', () => {
  it('creates one visit per child and returns a separate pickup receipt', async () => {
    const f = fixture();
    const r = await f.service.checkIn(f.user, String(f.session._id), f.dto);
    expect(r.code).toMatch(/^cfp_/);
    expect(f.session.visits).toHaveLength(1);
    expect(f.session.visits[0].pickupHash).toBe(tokenHash(r.code));
    expect(JSON.stringify(r)).not.toContain('PRIVATE');
  });
  it('duplicate scan never adds attendance twice', async () => {
    const f = fixture();
    await f.service.checkIn(f.user, String(f.session._id), f.dto);
    await expect(
      f.service.checkIn(f.user, String(f.session._id), f.dto),
    ).rejects.toThrow(ConflictException);
    expect(f.session.visits).toHaveLength(1);
  });
  it('two simultaneous check-ins only accept one revision', async () => {
    const f = fixture();
    const results = await Promise.allSettled([
      f.service.checkIn(f.user, String(f.session._id), f.dto),
      f.service.checkIn(f.user, String(f.session._id), f.dto),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(f.session.visits).toHaveLength(1);
  });
  it('requires an adult confirmation', async () => {
    const f = fixture();
    await expect(
      f.service.checkIn(f.user, String(f.session._id), {
        ...f.dto,
        adultConfirmed: false,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(f.session.visits).toHaveLength(0);
  });
  it('an emergency contact is not automatically a check-in guardian', async () => {
    const f = fixture();
    await expect(
      f.service.checkIn(f.user, String(f.session._id), {
        ...f.dto,
        guardianId: f.otherGuardian,
      }),
    ).rejects.toThrow(BadRequestException);
  });
  it('a guardian must be linked to this child', async () => {
    const f = fixture();
    f.child.guardianIds = [];
    await expect(
      f.service.checkIn(f.user, String(f.session._id), f.dto),
    ).rejects.toThrow(BadRequestException);
  });
  it('inactive or missing children cannot be checked in', async () => {
    const f = fixture();
    f.children.find.mockReturnValue(query([]));
    await expect(
      f.service.checkIn(f.user, String(f.session._id), f.dto),
    ).rejects.toThrow(BadRequestException);
  });
  it('rejects closed and future sessions', async () => {
    const f = fixture();
    f.session.status = 'closed';
    await expect(
      f.service.checkIn(f.user, String(f.session._id), f.dto),
    ).rejects.toThrow(BadRequestException);
    f.session.status = 'open';
    f.session.startsAt = new Date(Date.now() + 3600000);
    await expect(
      f.service.checkIn(f.user, String(f.session._id), f.dto),
    ).rejects.toThrow(BadRequestException);
  });
  it('cross-church access is rejected before check-in', async () => {
    const f = fixture();
    f.branches.findOne.mockReturnValue(query(null) as never);
    await expect(
      f.service.checkIn(f.user, String(f.session._id), f.dto),
    ).rejects.toThrow(ForbiddenException);
  });
});
describe('pickup handover', () => {
  async function checkedIn() {
    const f = fixture();
    const receipt = await f.service.checkIn(
      f.user,
      String(f.session._id),
      f.dto,
    );
    return { ...f, receipt };
  }
  it('permanent membership cards cannot authorize pickup', async () => {
    const f = await checkedIn();
    await expect(
      f.service.pickup(f.user, String(f.session._id), cardToken()),
    ).rejects.toThrow(BadRequestException);
  });
  it('scanning pickup does not check the child out', async () => {
    const f = await checkedIn();
    const r = await f.service.pickup(
      f.user,
      String(f.session._id),
      f.receipt.code,
    );
    expect(r.visitIds).toHaveLength(1);
    expect(f.session.visits[0].status).toBe('checked_in');
  });
  it('checkout needs explicit identity confirmation', async () => {
    const f = await checkedIn();
    await expect(
      f.service.checkout(f.user, String(f.session._id), {
        visitIds: [f.session.visits[0].id],
        guardianId: f.guardianId,
        identityConfirmed: false,
        pickupCode: f.receipt.code,
        expectedRevision: 1,
      }),
    ).rejects.toThrow(BadRequestException);
  });
  it('supervisor exceptions never bypass authorized pickup relationships', async () => {
    const f = await checkedIn();
    await expect(
      f.service.checkout(f.user, String(f.session._id), {
        visitIds: [f.session.visits[0].id],
        guardianId: f.otherGuardian,
        identityConfirmed: true,
        exceptionReason: 'Verified emergency contact',
        expectedRevision: 1,
      }),
    ).rejects.toThrow(BadRequestException);
  });
  it('workers cannot use lost-receipt overrides', async () => {
    const f = await checkedIn();
    await expect(
      f.service.checkout(
        { ...f.user, role: 'children_worker' },
        String(f.session._id),
        {
          visitIds: [f.session.visits[0].id],
          guardianId: f.guardianId,
          identityConfirmed: true,
          exceptionReason: 'Verified identity carefully',
          expectedRevision: 1,
        },
      ),
    ).rejects.toThrow(ForbiddenException);
  });
  it('live pickup permission changes take effect immediately', async () => {
    const f = await checkedIn();
    f.child.pickupGuardianIds = [];
    await expect(
      f.service.checkout(f.user, String(f.session._id), {
        visitIds: [f.session.visits[0].id],
        guardianId: f.guardianId,
        identityConfirmed: true,
        pickupCode: f.receipt.code,
        expectedRevision: 1,
      }),
    ).rejects.toThrow(BadRequestException);
  });
  it('concurrent checkout records only one handover', async () => {
    const f = await checkedIn();
    const dto = {
      visitIds: [f.session.visits[0].id],
      guardianId: f.guardianId,
      identityConfirmed: true,
      pickupCode: f.receipt.code,
      expectedRevision: 1,
    };
    const results = await Promise.allSettled([
      f.service.checkout(f.user, String(f.session._id), dto),
      f.service.checkout(f.user, String(f.session._id), dto),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(f.session.visits[0].status).toBe('checked_out');
    await expect(
      f.service.pickup(f.user, String(f.session._id), f.receipt.code),
    ).rejects.toThrow();
  });
  it('reissuing a receipt invalidates the previous child pickup credential', async () => {
    const f = await checkedIn();
    const r = await f.service.sessionAction(f.user, String(f.session._id), {
      action: 'reissue',
      visitId: f.session.visits[0].id,
      reason: 'Guardian identity verified at desk',
      expectedRevision: 1,
    });
    expect(r).toHaveProperty('code');
    await expect(
      f.service.pickup(f.user, String(f.session._id), f.receipt.code),
    ).rejects.toThrow();
  });
  it('cannot close while any child is still present', async () => {
    const f = await checkedIn();
    await expect(
      f.service.sessionAction(f.user, String(f.session._id), {
        action: 'close',
        reason: 'Service has now ended',
        expectedRevision: 1,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(f.session.status).toBe('open');
  });
  it('closing an empty session revokes every kiosk credential', async () => {
    const f = fixture();
    await f.service.sessionAction(f.user, String(f.session._id), {
      action: 'close',
      reason: 'Service has now ended',
      expectedRevision: 0,
    });
    expect(f.session.status).toBe('closed');
    expect(f.kiosks.updateMany).toHaveBeenCalledWith(
      { sessionId: f.session._id },
      { $set: { revoked: true } },
    );
  });
  it('rosters never return pickup credential hashes', async () => {
    const f = await checkedIn();
    const roster = await f.service.roster(f.user, String(f.session._id));
    expect(roster.visits[0]).not.toHaveProperty('pickupHash');
    expect(roster.visits[0].careNotes).toBe('PRIVATE CARE');
  });
});
describe('public kiosk and team boundaries', () => {
  it('unassigned support staff cannot see child profiles', async () => {
    const f = fixture();
    await expect(
      f.service.family({ ...f.user, role: 'follow_up' }, String(f.family._id)),
    ).rejects.toThrow(ForbiddenException);
  });
  it('workers cannot edit family relationships', async () => {
    const f = fixture();
    await expect(
      f.service.family(
        { ...f.user, role: 'children_worker' },
        String(f.family._id),
      ),
    ).rejects.toThrow(ForbiddenException);
  });
  it('expired or revoked kiosks are rejected', async () => {
    const f = fixture();
    await expect(f.service.kioskInfo('x'.repeat(43))).rejects.toThrow(
      ForbiddenException,
    );
  });
  it('kiosk responses reveal no care notes, birth date or guardian phone', async () => {
    const f = fixture();
    f.kiosks.findOne.mockReturnValue(
      query({
        _id: id(),
        sessionId: f.session._id,
        branchId: f.session.branchId,
        revoked: false,
        expiresAt: new Date(Date.now() + 3600000),
      }) as never,
    );
    const r = await f.service.kioskScan('x'.repeat(43), cardToken());
    const json = JSON.stringify(r);
    expect(json).not.toContain('PRIVATE');
    expect(json).not.toContain('birthDate');
    expect(json).not.toContain('555-0100');
    expect(json).not.toContain('Child Example');
    expect(json).toContain('Child E.');
  });
  it('pickup DTOs require a revision and explicit identity field', () => {
    expect(
      validateSync(
        Object.assign(new CheckoutDto(), {
          visitIds: [randomUUID()],
          guardianId: randomUUID(),
        }),
      ).map((e) => e.property),
    ).toEqual(
      expect.arrayContaining(['identityConfirmed', 'expectedRevision']),
    );
  });
  it('check-in rejects arbitrary or repeated child identifiers through validation and service checks', () => {
    expect(
      validateSync(
        Object.assign(new CheckInDto(), {
          familyId: 'not-an-id',
          guardianId: 'x',
          children: [],
          adultConfirmed: true,
        }),
      ),
    ).not.toHaveLength(0);
  });
});

describe('children-only accounts cannot escape their workspace', () => {
  for (const role of ['children_worker', 'children_supervisor']) {
    it(role + ' can use children endpoints and its own account actions', () => {
      expect(childrenApiAllowed(role, 'children', 'sessions/:id')).toBe(true);
      for (const path of ['me', 'logout', 'change-password'])
        expect(childrenApiAllowed(role, 'auth', path)).toBe(true);
    });
    it(
      role +
        ' cannot access dashboards, finance, members, role management or approvals',
      () => {
        for (const controller of [
          'reports',
          'finance',
          'members',
          'users',
          'approval-workflows',
          'children-kiosk-other',
        ])
          expect(childrenApiAllowed(role, controller, '')).toBe(false);
        expect(childrenApiAllowed(role, 'auth', 'register')).toBe(false);
      },
    );
  }
  it('existing church leadership routes are unchanged', () =>
    expect(childrenApiAllowed('super_admin', 'finance', '')).toBe(true));
});

it('the global API guard enforces children isolation even on controllers open to all roles', () => {
  const guard = new RolesGuard(new Reflector());
  const handler = () => {};
  class Controller {}
  const ctx = {
    getClass: () => Controller,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({ user: { role: 'children_worker' } }),
    }),
  } as unknown as ExecutionContext;
  Reflect.defineMetadata(PATH_METADATA, 'members', Controller);
  expect(guard.canActivate(ctx)).toBe(false);
  Reflect.defineMetadata(PATH_METADATA, 'children', Controller);
  expect(guard.canActivate(ctx)).toBe(true);
  Reflect.defineMetadata(PATH_METADATA, 'auth', Controller);
  Reflect.defineMetadata(PATH_METADATA, 'me', handler);
  expect(guard.canActivate(ctx)).toBe(true);
  Reflect.defineMetadata(PATH_METADATA, 'register', handler);
  expect(guard.canActivate(ctx)).toBe(false);
});
