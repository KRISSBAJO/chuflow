import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  isBranchScopedRole,
  isDistrictRole,
  isGlobalRole,
  isNationalRole,
} from '../common/constants/roles.constants';

@Injectable()
export class AccessScopeService {
  constructor(
    @InjectModel(Branch.name) private readonly branchModel: Model<BranchDocument>,
  ) {}

  private ensureScopeValue(value: string | undefined, label: string) {
    if (!value) {
      throw new ForbiddenException(`${label} is not configured for this user`);
    }

    return value;
  }

  private buildBranchReferenceValues(branchIds: string[]) {
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

    return {
      _id: branch._id,
    };
  }

  async getAccessibleBranchIds(currentUser: AuthUser): Promise<string[] | null> {
    if (isGlobalRole(currentUser.role)) {
      return null;
    }

    if (isBranchScopedRole(currentUser.role)) {
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
      const [userBranch, targetBranch] = await Promise.all([
        this.resolveBranchFromScopeValue(
          this.ensureScopeValue(currentUser.branchId, 'Branch'),
        ),
        this.resolveBranchFromScopeValue(branchId),
      ]);

      if (String(userBranch._id) !== String(targetBranch._id)) {
        throw new ForbiddenException(
          'You cannot access records from another branch',
        );
      }

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
