import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import {
  isBranchScopedRole,
  isDistrictRole,
  isGlobalRole,
  isNationalRole,
} from '../common/constants/roles.constants';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

type RecordAuditParams = {
  entityType: string;
  entityId: string;
  action: string;
  summary: string;
  branchId?: string;
  oversightRegion?: string;
  district?: string;
  metadata?: Record<string, unknown>;
  actor?: AuthUser | null;
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
};

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  private normalizeText(value?: string) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private async resolveScopeFromBranch(branchId?: string) {
    if (!branchId || !Types.ObjectId.isValid(branchId)) {
      return {
        branchId: undefined,
        oversightRegion: undefined,
        district: undefined,
      };
    }

    const branch = await this.branchModel
      .findById(branchId)
      .select('oversightRegion district')
      .lean();

    if (!branch) {
      return {
        branchId: undefined,
        oversightRegion: undefined,
        district: undefined,
      };
    }

    return {
      branchId,
      oversightRegion: branch.oversightRegion,
      district: branch.district,
    };
  }

  async record(params: RecordAuditParams) {
    const branchScope = await this.resolveScopeFromBranch(params.branchId);
    const oversightRegion =
      this.normalizeText(params.oversightRegion) ?? branchScope.oversightRegion;
    const district = this.normalizeText(params.district) ?? branchScope.district;
    const branchId = this.normalizeText(params.branchId) ?? branchScope.branchId;
    const actorId =
      params.actor?.sub && Types.ObjectId.isValid(params.actor.sub)
        ? new Types.ObjectId(params.actor.sub)
        : undefined;

    await this.auditLogModel.create({
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      summary: params.summary,
      actorId,
      actorName:
        params.actorName ?? params.actor?.email,
      actorEmail: params.actorEmail ?? params.actor?.email,
      actorRole: params.actorRole ?? params.actor?.role,
      oversightRegion,
      district,
      branchId: branchId ? new Types.ObjectId(branchId) : undefined,
      metadata: params.metadata,
    });
  }

  private async buildScopeQuery(currentUser: AuthUser) {
    if (isGlobalRole(currentUser.role)) {
      return {};
    }

    if (isBranchScopedRole(currentUser.role)) {
      return {
        branchId: new Types.ObjectId(currentUser.branchId),
      };
    }

    const branchQuery = await this.accessScopeService.getBranchDocumentQuery(currentUser);
    const visibleBranches = await this.branchModel.find(branchQuery).select('_id').lean();
    const branchIds = visibleBranches.map((branch) => new Types.ObjectId(String(branch._id)));

    if (isDistrictRole(currentUser.role)) {
      return {
        $or: [
          ...(branchIds.length > 0 ? [{ branchId: { $in: branchIds } }] : []),
          {
            branchId: { $exists: false },
            oversightRegion: currentUser.oversightRegion,
            district: currentUser.district,
          },
        ],
      };
    }

    if (isNationalRole(currentUser.role)) {
      return {
        $or: [
          ...(branchIds.length > 0 ? [{ branchId: { $in: branchIds } }] : []),
          {
            branchId: { $exists: false },
            oversightRegion: currentUser.oversightRegion,
          },
        ],
      };
    }

    throw new ForbiddenException('You cannot access audit logs from your role');
  }

  async list(
    currentUser: AuthUser,
    filters: {
      entityType?: string;
      search?: string;
      branchId?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const safeLimit = Math.min(Math.max(filters.limit || 12, 1), 100);
    const requestedPage = Math.max(filters.page || 1, 1);
    const query = {
      ...(await this.buildScopeQuery(currentUser)),
    } as Record<string, unknown>;

    const normalizedEntityType = this.normalizeText(filters.entityType);
    const normalizedSearch = this.normalizeText(filters.search);
    const normalizedBranchId = this.normalizeText(filters.branchId);

    if (normalizedEntityType) {
      query.entityType = normalizedEntityType;
    }

    if (normalizedSearch) {
      query.$or = [
        { summary: { $regex: normalizedSearch, $options: 'i' } },
        { action: { $regex: normalizedSearch, $options: 'i' } },
        { actorName: { $regex: normalizedSearch, $options: 'i' } },
        { actorEmail: { $regex: normalizedSearch, $options: 'i' } },
      ];
    }

    if (normalizedBranchId) {
      await this.accessScopeService.ensureBranchAccess(currentUser, normalizedBranchId);
      query.branchId = new Types.ObjectId(normalizedBranchId);
    }

    const total = await this.auditLogModel.countDocuments(query);
    const totalPages = Math.max(Math.ceil(total / safeLimit), 1);
    const safePage = Math.min(requestedPage, totalPages);
    const skip = (safePage - 1) * safeLimit;

    const items = await this.auditLogModel
      .find(query)
      .populate('branchId', 'name oversightRegion district')
      .populate('actorId', 'firstName lastName email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean();

    return {
      items: items.map((item) => ({
        _id: String(item._id),
        entityType: item.entityType,
        entityId: item.entityId,
        action: item.action,
        summary: item.summary,
        actor: item.actorId
          ? {
              _id: String((item.actorId as { _id?: unknown })._id ?? ''),
              firstName: (item.actorId as { firstName?: string }).firstName,
              lastName: (item.actorId as { lastName?: string }).lastName,
              email: (item.actorId as { email?: string }).email,
              role: (item.actorId as { role?: string }).role,
            }
          : {
              firstName: item.actorName,
              email: item.actorEmail,
              role: item.actorRole,
            },
        branchId:
          typeof item.branchId === 'object' && item.branchId !== null
            ? {
                _id: String((item.branchId as { _id?: unknown })._id ?? ''),
                name: (item.branchId as { name?: string }).name,
                oversightRegion: (item.branchId as { oversightRegion?: string }).oversightRegion,
                district: (item.branchId as { district?: string }).district,
              }
            : undefined,
        oversightRegion: item.oversightRegion,
        district: item.district,
        metadata: item.metadata,
        createdAt: (item as { createdAt?: Date }).createdAt,
      })),
      pagination: {
        page: safePage,
        pageSize: safeLimit,
        total,
        totalPages,
      },
    };
  }
}
