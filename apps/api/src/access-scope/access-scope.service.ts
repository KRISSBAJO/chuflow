import { hasAdditionalPermission } from '../common/permissions';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  HierarchyUnit,
  HierarchyUnitDocument,
} from '../hierarchy/hierarchy.schema';
import {
  District,
  DistrictDocument,
} from '../districts/schemas/district.schema';
import {
  isBranchScopedRole,
  isDistrictRole,
  isGlobalRole,
  isNationalRole,
} from '../common/constants/roles.constants';

@Injectable()
export class AccessScopeService {
  constructor(
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
    @InjectModel(HierarchyUnit.name)
    private readonly units: Model<HierarchyUnitDocument>,
    @InjectModel(District.name)
    private readonly districts: Model<DistrictDocument>,
  ) {}

  async unitBranchQuery(id: string): Promise<Record<string, unknown>> {
    if (!Types.ObjectId.isValid(id))
      throw new ForbiddenException('Unknown oversight unit.');
    const unit = await this.units.findOne({ _id: id, isActive: true }).lean();
    if (!unit)
      throw new ForbiddenException(
        'Oversight unit is inactive or unavailable.',
      );
    const district = await this.districts
      .findOne({ _id: unit.districtId, isActive: true })
      .lean();
    if (!district)
      throw new ForbiddenException('District is inactive or unavailable.');
    if (unit.kind !== 'district') {
      const parent = await this.units
        .findOne({
          _id: unit.parentId,
          districtId: unit.districtId,
          isActive: true,
        })
        .lean();
      if (
        !parent ||
        parent.kind !== (unit.kind === 'area' ? 'zone' : 'district')
      )
        throw new ForbiddenException('The oversight parent is unavailable.');
      if (
        unit.kind === 'area' &&
        !(await this.units.exists({
          _id: parent.parentId,
          kind: 'district',
          districtId: unit.districtId,
          isActive: true,
        }))
      )
        throw new ForbiddenException('The oversight district is unavailable.');
    }
    return {
      oversightRegion: district.oversightRegion,
      district: district.name,
      ...(unit.kind === 'zone' ? { zoneId: unit._id } : {}),
      ...(unit.kind === 'area'
        ? { zoneId: unit.parentId, areaId: unit._id }
        : {}),
    };
  }

  async oversightAssignments(u: AuthUser) {
    if (
      u.role !== 'resident_pastor' ||
      !u.branchId ||
      !Types.ObjectId.isValid(u.sub)
    )
      return [];
    const appointments = await this.units
      .find({
        pastorUserId: u.sub,
        pastorVisibilityEnabled: true,
        headquartersBranchId: u.branchId,
        isActive: true,
      })
      .lean();
    const allowed: (HierarchyUnit & {
      _id: Types.ObjectId;
      branchQuery: Record<string, unknown>;
    })[] = [];
    for (const unit of appointments) {
      try {
        const branchQuery = await this.unitBranchQuery(String(unit._id));
        if (
          await this.branchModel.exists({
            ...branchQuery,
            _id: unit.headquartersBranchId,
            status: 'active',
          })
        )
          allowed.push({
            ...unit,
            name:
              unit.kind === 'district'
                ? String(branchQuery.district)
                : unit.name,
            branchQuery,
          });
      } catch (error) {
        if (!(error instanceof ForbiddenException)) throw error;
      }
    }
    return allowed;
  }

  private ensureScopeValue(value: string | undefined, label: string) {
    if (!value) {
      throw new ForbiddenException(`${label} is not configured for this user`);
    }

    return value;
  }

  async localReportingBranch(
    currentUser: AuthUser,
    branchId?: string,
    delegatedAction?: 'attendance.create',
  ) {
    // Oversight appointments grant visibility, never another church's entry link.
    if (
      (![
        'branch_admin',
        'resident_pastor',
        'associate_pastor',
        'usher',
      ].includes(currentUser.role) &&
        !(
          delegatedAction &&
          hasAdditionalPermission(currentUser, delegatedAction)
        )) ||
      !currentUser.branchId ||
      (branchId !== undefined && !Types.ObjectId.isValid(branchId))
    ) {
      throw new ForbiddenException(
        'Only authorised staff assigned to this local church can submit reports.',
      );
    }
    const ownBranch = await this.branchModel
      .findOne(this.buildBranchLookup(currentUser.branchId))
      .select('_id name oversightRegion district status')
      .lean();
    if (
      !ownBranch ||
      (branchId !== undefined && String(ownBranch._id) !== branchId) ||
      ownBranch.status !== 'active'
    ) {
      throw new ForbiddenException(
        'This recording link is not available for your local church.',
      );
    }
    return ownBranch;
  }

  /** Both the string and ObjectId form of each id, so filters also work inside aggregations (no casting). */
  buildBranchReferenceValues(branchIds: string[]) {
    const values = new Map<string, string | Types.ObjectId>();

    for (const branchId of branchIds) {
      if (!branchId) {
        continue;
      }

      values.set(`string:${branchId}`, branchId);

      if (Types.ObjectId.isValid(branchId)) {
        values.set(`object:${branchId}`, new Types.ObjectId(branchId));
      }
    }

    return Array.from(values.values());
  }

  private buildBranchLookup(branchRef: string) {
    if (Types.ObjectId.isValid(branchRef)) {
      return {
        $or: [{ _id: new Types.ObjectId(branchRef) }, { name: branchRef }],
      };
    }

    return { name: branchRef };
  }

  private async resolveBranchFromScopeValue(branchRef: string) {
    const branch = await this.branchModel
      .findOne(this.buildBranchLookup(branchRef))
      .select('_id oversightRegion district name')
      .lean();

    if (!branch) {
      throw new ForbiddenException('The configured branch was not found');
    }

    return branch;
  }

  async getBranchDocumentQuery(currentUser: AuthUser) {
    if (isGlobalRole(currentUser.role)) {
      return {};
    }

    if (isNationalRole(currentUser.role)) {
      return {
        oversightRegion: this.ensureScopeValue(
          currentUser.oversightRegion,
          'Oversight region',
        ),
      };
    }

    if (isDistrictRole(currentUser.role)) {
      return {
        oversightRegion: this.ensureScopeValue(
          currentUser.oversightRegion,
          'Oversight region',
        ),
        district: this.ensureScopeValue(currentUser.district, 'District'),
      };
    }

    const branch = await this.resolveBranchFromScopeValue(
      this.ensureScopeValue(currentUser.branchId, 'Branch'),
    );

    const appointments = await this.oversightAssignments(currentUser);
    if (!appointments.length) return { _id: branch._id };
    // Keep authorization in an ID constraint. A caller's search $or must not replace it.
    const branches = await this.branchModel
      .find({
        $or: [{ _id: branch._id }, ...appointments.map((a) => a.branchQuery)],
      })
      .select('_id')
      .lean();
    return { _id: { $in: branches.map((b) => b._id) } };
  }

  async getAccessibleBranchIds(
    currentUser: AuthUser,
  ): Promise<string[] | null> {
    if (isGlobalRole(currentUser.role)) {
      return null;
    }

    if (
      isBranchScopedRole(currentUser.role) &&
      !(await this.oversightAssignments(currentUser)).length
    ) {
      const branch = await this.resolveBranchFromScopeValue(
        this.ensureScopeValue(currentUser.branchId, 'Branch'),
      );
      return [String(branch._id)];
    }

    const branches = await this.branchModel
      .find(await this.getBranchDocumentQuery(currentUser))
      .select('_id')
      .lean();

    return branches.map((branch) => String(branch._id));
  }

  async getAccessibleBranchObjectIds(
    currentUser: AuthUser,
  ): Promise<Types.ObjectId[] | null> {
    const branchIds = await this.getAccessibleBranchIds(currentUser);

    if (branchIds === null) {
      return null;
    }

    return branchIds
      .filter((branchId) => Types.ObjectId.isValid(branchId))
      .map((branchId) => new Types.ObjectId(branchId));
  }

  async ensureBranchAccess(currentUser: AuthUser, branchId?: string) {
    if (!branchId) {
      return;
    }

    if (isGlobalRole(currentUser.role)) {
      return;
    }

    if (isBranchScopedRole(currentUser.role)) {
      const query = await this.getBranchDocumentQuery(currentUser);
      const target = await this.resolveBranchFromScopeValue(branchId);
      if (
        !(await this.branchModel.exists({ $and: [query, { _id: target._id }] }))
      )
        throw new ForbiddenException(
          'You cannot access records outside your church or appointed oversight.',
        );
      return;
    }

    const branch = await this.resolveBranchFromScopeValue(branchId);

    if (
      isNationalRole(currentUser.role) &&
      branch.oversightRegion !==
        this.ensureScopeValue(currentUser.oversightRegion, 'Oversight region')
    ) {
      throw new ForbiddenException(
        'You cannot access records outside your oversight region',
      );
    }

    if (isDistrictRole(currentUser.role)) {
      const oversightRegion = this.ensureScopeValue(
        currentUser.oversightRegion,
        'Oversight region',
      );
      const district = this.ensureScopeValue(currentUser.district, 'District');

      if (
        branch.oversightRegion !== oversightRegion ||
        branch.district !== district
      ) {
        throw new ForbiddenException(
          'You cannot access records outside your district',
        );
      }
    }
  }

  async resolveScopedBranchId(
    currentUser: AuthUser | undefined,
    requestedBranchId?: string,
  ) {
    if (!currentUser) {
      return requestedBranchId;
    }

    if (isBranchScopedRole(currentUser.role)) {
      const branch = await this.resolveBranchFromScopeValue(
        this.ensureScopeValue(currentUser.branchId, 'Branch'),
      );
      const branchId = String(branch._id);

      if (requestedBranchId && requestedBranchId !== branchId) {
        await this.ensureBranchAccess(currentUser, requestedBranchId);
        const requested =
          await this.resolveBranchFromScopeValue(requestedBranchId);
        return String(requested._id);
      }

      return branchId;
    }

    if (requestedBranchId) {
      await this.ensureBranchAccess(currentUser, requestedBranchId);
      return requestedBranchId;
    }

    return undefined;
  }

  async buildBranchFilter(currentUser: AuthUser, requestedBranchId?: string) {
    if (requestedBranchId) {
      await this.ensureBranchAccess(currentUser, requestedBranchId);
      return {
        branchId: { $in: this.buildBranchReferenceValues([requestedBranchId]) },
      };
    }

    const branchIds = await this.getAccessibleBranchIds(currentUser);

    if (branchIds === null) {
      return {};
    }

    return {
      branchId: { $in: this.buildBranchReferenceValues(branchIds) },
    };
  }

  async buildBranchObjectIdFilter(
    currentUser: AuthUser,
    requestedBranchId?: string,
  ) {
    if (requestedBranchId) {
      await this.ensureBranchAccess(currentUser, requestedBranchId);

      if (!Types.ObjectId.isValid(requestedBranchId)) {
        return { branchId: requestedBranchId };
      }

      return { branchId: new Types.ObjectId(requestedBranchId) };
    }

    const branchIds = await this.getAccessibleBranchObjectIds(currentUser);

    if (branchIds === null) {
      return {};
    }

    return { branchId: { $in: branchIds } };
  }
}
