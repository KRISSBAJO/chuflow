import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import {
  District,
  DistrictDocument,
} from '../districts/schemas/district.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import { Guest, GuestDocument } from '../guests/schemas/guest.schema';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { isBranchScopedRole } from '../common/constants/roles.constants';
import {
  HierarchyUnit,
  HierarchyUnitDocument,
  HierarchyChange,
} from './hierarchy.schema';
import {
  ensureHierarchyManager,
  HIERARCHY_MANAGERS,
  hierarchyId,
  hierarchyParent,
} from './hierarchy.policy';
import {
  CreateHierarchyDto,
  UpdateHierarchyDto,
  PlaceChurchDto,
} from './hierarchy.dto';
@Injectable()
export class HierarchyService {
  constructor(
    @InjectModel(HierarchyUnit.name)
    private readonly units: Model<HierarchyUnitDocument>,
    @InjectModel(HierarchyChange.name)
    private readonly changes: Model<HierarchyChange>,
    @InjectModel(Branch.name) private readonly branches: Model<BranchDocument>,
    @InjectModel(District.name)
    private readonly districts: Model<DistrictDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Member.name) private readonly members: Model<MemberDocument>,
    @InjectModel(Guest.name) private readonly guests: Model<GuestDocument>,
    private readonly scope: AccessScopeService,
  ) {}
  async context(u: AuthUser) {
    const assignments = await this.scope.oversightAssignments(u);
    return {
      hasOversight: assignments.length > 0,
      assignments: assignments.map((a) => ({
        _id: String(a._id),
        kind: a.kind,
        name: a.name,
      })),
      homeBranchId: u.branchId,
    };
  }
  private async district(u: AuthUser, id: string, write = false) {
    const district = await this.districts.findById(hierarchyId(id)).lean();
    if (!district) throw new NotFoundException('District not found.');
    if (write) ensureHierarchyManager(u, district);
    else if (u.role !== 'super_admin') {
      const allowed = await this.branches.exists({
        $and: [
          await this.scope.getBranchDocumentQuery(u),
          {
            oversightRegion: district.oversightRegion,
            district: district.name,
          },
        ],
      });
      if (
        !allowed &&
        !(
          u.oversightRegion === district.oversightRegion &&
          (u.role === 'national_admin' ||
            u.role === 'national_pastor' ||
            ((u.role === 'district_admin' || u.role === 'district_pastor') &&
              u.district === district.name))
        )
      )
        throw new ForbiddenException('District is outside your scope.');
    }
    return district;
  }
  async list(
    u: AuthUser,
    districtId?: string,
  ): Promise<Record<string, unknown>> {
    const branchQuery = await this.scope.getBranchDocumentQuery(u);
    const branches = await this.branches
      .find(branchQuery)
      .select(
        '_id name oversightRegion district zoneId areaId hierarchyRevision status',
      )
      .sort({ name: 1 })
      .lean();
    const districtQuery =
      u.role === 'super_admin'
        ? {}
        : u.role.startsWith('national_')
          ? { oversightRegion: u.oversightRegion || '__none__' }
          : u.role.startsWith('district_')
            ? {
                oversightRegion: u.oversightRegion || '__none__',
                name: u.district || '__none__',
              }
            : {
                $or: branches
                  .map((b) => ({
                    oversightRegion: b.oversightRegion,
                    name: b.district,
                  }))
                  .concat([{ oversightRegion: '__none__', name: '__none__' }]),
              };
    const districts = await this.districts
      .find(districtQuery)
      .select('_id name oversightRegion isActive')
      .sort({ name: 1 })
      .lean();
    const selected = districtId
      ? districts.find((d) => String(d._id) === districtId)
      : districts[0];
    if (districtId && !selected)
      throw new ForbiddenException('District is outside your scope.');
    if (!selected)
      return {
        districts,
        units: [],
        branches: [],
        canManage: false,
        selectedDistrictId: null,
        context: await this.context(u),
      };
    const canManage = HIERARCHY_MANAGERS.includes(u.role);
    const units = await this.units
      .find({ districtId: selected._id })
      .populate('headquartersBranchId', 'name')
      .populate('pastorUserId', 'firstName lastName')
      .sort({ kind: 1, name: 1 })
      .lean();
    const visible = branches.filter(
      (b) =>
        b.district === selected.name &&
        b.oversightRegion === selected.oversightRegion,
    );
    const appointments = await this.scope.oversightAssignments(u);
    const branchIds = visible.map((b) => b._id);
    const branchRefs = this.scope.buildBranchReferenceValues(
      branchIds.map((id) => String(id)),
    );
    const [memberCounts, guestCounts] = await Promise.all([
      this.members.aggregate<{ _id: Types.ObjectId; total: number }>([
        { $match: { branchId: { $in: branchRefs } } },
        { $group: { _id: { $toString: '$branchId' }, total: { $sum: 1 } } },
      ]),
      this.guests.aggregate<{ _id: Types.ObjectId; total: number }>([
        { $match: { branchId: { $in: branchRefs } } },
        { $group: { _id: { $toString: '$branchId' }, total: { $sum: 1 } } },
      ]),
    ]);
    const memberMap = new Map(
      memberCounts.map((row) => [String(row._id), row.total]),
    );
    const guestMap = new Map(
      guestCounts.map((row) => [String(row._id), row.total]),
    );
    const unitItems = units.map((unit) => {
      const churches = visible.filter(
        (b) =>
          unit.kind === 'district' ||
          (unit.kind === 'zone'
            ? String(b.zoneId || '') === String(unit._id)
            : String(b.areaId || '') === String(unit._id)),
      );
      const full =
        canManage ||
        !['resident_pastor', 'associate_pastor', 'branch_admin'].includes(
          u.role,
        ) ||
        appointments.some(
          (a) =>
            String(a._id) === String(unit._id) ||
            a.kind === 'district' ||
            (a.kind === 'zone' && String(unit.parentId) === String(a._id)),
        );
      return {
        ...unit,
        name: unit.kind === 'district' ? selected.name : unit.name,
        parentName: unit.parentId
          ? units.find((parent) => String(parent._id) === String(unit.parentId))
              ?.name || ''
          : selected.oversightRegion,
        churches: churches.length,
        members: churches.reduce(
          (n, b) => n + (memberMap.get(String(b._id)) || 0),
          0,
        ),
        guests: churches.reduce(
          (n, b) => n + (guestMap.get(String(b._id)) || 0),
          0,
        ),
        partial: !full,
      };
    });
    return {
      districts,
      units: isBranchScopedRole(u.role)
        ? unitItems.filter((unit) => unit.churches > 0)
        : unitItems,
      branches: visible.map((branch) => ({
        ...branch,
        zoneName:
          units.find((unit) => String(unit._id) === String(branch.zoneId || ''))
            ?.name || '',
        areaName:
          units.find((unit) => String(unit._id) === String(branch.areaId || ''))
            ?.name || '',
      })),
      canManage,
      selectedDistrictId: String(selected._id),
      context: await this.context(u),
    };
  }
  async create(u: AuthUser, dto: CreateHierarchyDto) {
    const district = await this.district(u, dto.districtId, true);
    if (!district.isActive)
      throw new BadRequestException('Activate the district first.');
    const parent = dto.parentId
      ? await this.units
          .findOne({
            _id: hierarchyId(dto.parentId),
            districtId: district._id,
            isActive: true,
          })
          .lean()
      : null;
    hierarchyParent(dto.kind, parent?.kind);
    if (dto.kind !== 'district' && !parent)
      throw new BadRequestException(
        'Choose an active parent in this district.',
      );
    if (parent) await this.scope.unitBranchQuery(String(parent._id));
    const name =
      dto.kind === 'district'
        ? district.name
        : dto.name.trim().replace(/\s+/g, ' ');
    if (name.length < 2)
      throw new BadRequestException(
        'Enter a name with at least two characters.',
      );
    const key =
      dto.kind === 'district'
        ? `district:${String(district._id)}`
        : `${dto.kind}:${String(parent!._id)}:${name.toLowerCase()}`;
    try {
      const result = await this.units.create({
        kind: dto.kind,
        districtId: district._id,
        parentId: parent?._id,
        name,
        key,
      });
      await this.changes.create({
        actorId: u.sub,
        action: 'unit_created',
        details: {
          unitId: String(result._id),
          districtId: dto.districtId,
          name,
          kind: dto.kind,
        },
      });
      return result;
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw new ConflictException('This oversight unit already exists.');
      throw error;
    }
  }
  async update(u: AuthUser, id: string, dto: UpdateHierarchyDto) {
    const unit = await this.units.findById(hierarchyId(id)).lean();
    if (!unit) throw new NotFoundException();
    const district = await this.district(u, String(unit.districtId), true);
    if (dto.isActive === true) {
      if (!district.isActive)
        throw new BadRequestException('Activate the district first.');
      if (unit.parentId)
        await this.scope.unitBranchQuery(String(unit.parentId));
    }
    if (
      dto.clearAppointment &&
      (dto.pastorUserId ||
        dto.headquartersBranchId ||
        dto.pastorVisibilityEnabled === true)
    )
      throw new BadRequestException(
        'Choose either a new appointment or clear the current appointment.',
      );
    const set: Record<string, unknown> = {};
    const unset: Record<string, string> = {};
    if (dto.isActive !== undefined) set.isActive = dto.isActive;
    if (dto.clearAppointment) {
      unset.pastorUserId = '';
      unset.headquartersBranchId = '';
      set.pastorVisibilityEnabled = false;
    } else if (
      dto.headquartersBranchId ||
      dto.pastorUserId ||
      dto.pastorVisibilityEnabled === true
    ) {
      if (
        (dto.headquartersBranchId || dto.pastorUserId) &&
        (!dto.headquartersBranchId || !dto.pastorUserId)
      )
        throw new BadRequestException(
          'Choose both a headquarters church and its resident pastor.',
        );
      const headquartersBranchId =
        dto.headquartersBranchId || String(unit.headquartersBranchId || '');
      const pastorUserId = dto.pastorUserId || String(unit.pastorUserId || '');
      if (!headquartersBranchId || !pastorUserId)
        throw new BadRequestException(
          'Appoint a headquarters church and resident pastor before enabling oversight access.',
        );
      if (
        dto.pastorVisibilityEnabled === true &&
        (!unit.isActive || dto.isActive === false)
      )
        throw new BadRequestException(
          'Activate this oversight level before enabling access.',
        );
      const query = await this.scope.unitBranchQuery(id);
      const headquarters = await this.branches
        .findOne({
          $and: [
            query,
            { _id: hierarchyId(headquartersBranchId), status: 'active' },
          ],
        })
        .lean();
      if (!headquarters)
        throw new BadRequestException(
          'The headquarters must be an active local church inside this oversight unit.',
        );
      const pastor = await this.users
        .findOne({
          _id: hierarchyId(pastorUserId),
          branchId: headquarters._id,
          role: 'resident_pastor',
          isActive: true,
        })
        .lean();
      if (!pastor)
        throw new BadRequestException(
          'Appoint the active resident pastor of the headquarters church.',
        );
      set.headquartersBranchId = headquarters._id;
      set.pastorUserId = pastor._id;
      const changed =
        String(unit.pastorUserId || '') !== String(pastor._id) ||
        String(unit.headquartersBranchId || '') !== String(headquarters._id);
      set.pastorVisibilityEnabled =
        dto.pastorVisibilityEnabled ??
        (changed ? false : unit.pastorVisibilityEnabled === true);
    }
    if (dto.pastorVisibilityEnabled === false || dto.isActive === false)
      set.pastorVisibilityEnabled = false;
    if (
      dto.isActive === false &&
      (await this.units.exists({ parentId: unit._id, isActive: true }))
    )
      throw new BadRequestException('Deactivate the child areas/zones first.');
    const result = await this.units.findOneAndUpdate(
      { _id: unit._id, revision: dto.expectedRevision },
      { $set: set, $unset: unset, $inc: { revision: 1 } },
      { new: true },
    );
    if (!result)
      throw new ConflictException(
        'This appointment changed. Reload before saving.',
      );
    await this.changes.create({
      actorId: u.sub,
      action: 'appointment_updated',
      details: {
        unitId: id,
        before: {
          headquartersBranchId: unit.headquartersBranchId,
          pastorUserId: unit.pastorUserId,
          pastorVisibilityEnabled: unit.pastorVisibilityEnabled === true,
          isActive: unit.isActive,
        },
        after: set,
        cleared: !!dto.clearAppointment,
      },
    });
    return result;
  }
  async pastors(u: AuthUser, branchId: string) {
    const branch = await this.branches.findById(hierarchyId(branchId)).lean();
    if (!branch) throw new NotFoundException();
    await this.scope.ensureBranchAccess(u, branchId);
    const district = await this.districts
      .findOne({
        name: branch.district,
        oversightRegion: branch.oversightRegion,
      })
      .lean();
    if (!district) throw new NotFoundException();
    ensureHierarchyManager(u, district);
    return this.users
      .find({ branchId: branch._id, role: 'resident_pastor', isActive: true })
      .select('_id firstName lastName')
      .lean();
  }
  async place(u: AuthUser, branchId: string, dto: PlaceChurchDto) {
    const branch = await this.branches.findById(hierarchyId(branchId)).lean();
    if (!branch) throw new NotFoundException();
    const district = await this.districts
      .findOne({
        name: branch.district,
        oversightRegion: branch.oversightRegion,
      })
      .lean();
    if (!district)
      throw new BadRequestException('Configure the existing district first.');
    ensureHierarchyManager(u, district);
    if (!!dto.unassigned === !!dto.unitId)
      throw new BadRequestException(
        'Choose a placement or explicitly leave this church unassigned.',
      );
    const unit = dto.unitId
      ? await this.units
          .findOne({
            _id: hierarchyId(dto.unitId),
            districtId: district._id,
            isActive: true,
          })
          .lean()
      : null;
    if (dto.unitId && (!unit || unit.kind === 'district'))
      throw new BadRequestException(
        'Choose an area or zone in this church’s existing district.',
      );
    if (unit) await this.scope.unitBranchQuery(String(unit._id));
    const zoneId = unit?.kind === 'zone' ? unit._id : unit?.parentId;
    const areaId = unit?.kind === 'area' ? unit._id : undefined;
    const appointments = await this.units
      .find({ headquartersBranchId: branch._id, isActive: true })
      .lean();
    for (const appointment of appointments) {
      if (
        (appointment.kind === 'zone' &&
          String(zoneId || '') !== String(appointment._id)) ||
        (appointment.kind === 'area' &&
          String(areaId || '') !== String(appointment._id))
      )
        throw new BadRequestException(
          'Clear the affected headquarters appointment before moving its church.',
        );
    }
    const result = await this.branches.findOneAndUpdate(
      {
        _id: branch._id,
        hierarchyRevision:
          dto.expectedRevision === 0
            ? { $in: [0, null] }
            : dto.expectedRevision,
      },
      {
        $set: { ...(zoneId ? { zoneId } : {}), ...(areaId ? { areaId } : {}) },
        $unset: {
          ...(!zoneId ? { zoneId: '' } : {}),
          ...(!areaId ? { areaId: '' } : {}),
        },
        $inc: { hierarchyRevision: 1 },
      },
      { new: true },
    );
    if (!result)
      throw new ConflictException(
        'Church placement changed. Reload before saving.',
      );
    await this.changes.create({
      actorId: u.sub,
      action: 'church_placed',
      details: {
        branchId,
        previousZoneId: branch.zoneId,
        previousAreaId: branch.areaId,
        zoneId,
        areaId,
      },
    });
    return result;
  }
}
