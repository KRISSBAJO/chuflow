import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { IsIn, IsInt, IsMongoId, IsOptional, Min } from 'class-validator';
import { Model, Types } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { User } from '../users/schemas/user.schema';
import { Guest, GuestDocument } from './schemas/guest.schema';

const PRAYER_ROLES = ['super_admin', 'branch_admin', 'resident_pastor', 'associate_pastor', 'follow_up'];
const ASSIGNEE_ROLES = PRAYER_ROLES.slice(1);
const STATUSES = ['new', 'praying', 'follow_up', 'answered', 'closed'] as const;
type PrayerStatus = (typeof STATUSES)[number];

export class UpdatePrayerCareDto {
  @IsInt() @Min(0) revision!: number;
  @IsIn(STATUSES) status!: PrayerStatus;
  @IsOptional() @IsMongoId() assigneeId?: string | null;
}

@Injectable()
export class PrayerCareService {
  constructor(
    @InjectModel(Guest.name) private readonly guests: Model<GuestDocument>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly access: AccessScopeService,
    private readonly audit: AuditLogsService,
  ) {}

  private async scope(user: AuthUser) {
    if (!PRAYER_ROLES.includes(user.role)) throw new ForbiddenException();
    const branchId = user.role === 'super_admin' ? undefined : await this.access.resolveScopedBranchId(user);
    if (user.role !== 'super_admin' && !branchId) throw new ForbiddenException();
    return {
      ...(branchId ? { branchId } : {}),
      ...(user.role === 'follow_up' ? { prayerCareAssigneeId: user.sub } : {}),
      prayerRequest: { $regex: /\S/ },
    };
  }

  async pendingFollowUp(user: AuthUser) {
    if (!PRAYER_ROLES.includes(user.role) || (user.role !== 'super_admin' && !user.branchId)) return 0;
    try {
      return await this.guests.countDocuments({ ...(await this.scope(user)), prayerCareStatus: 'follow_up', wantsPastoralCall: true });
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) return 0;
      throw error;
    }
  }

  async list(user: AuthUser, requestedPage = 1, view?: string) {
    const query = {
      ...await this.scope(user),
      ...(view === 'follow_up' ? { prayerCareStatus: 'follow_up', wantsPastoralCall: true } : {}),
    };
    const page = Number.isSafeInteger(requestedPage) ? Math.min(1000, Math.max(1, requestedPage)) : 1;
    const limit = 20;
    const [records, total] = await Promise.all([
      this.guests.find(query)
        .select('_id branchId firstName lastName phone createdAt wantsPastoralCall +prayerRequest +prayerCareStatus +prayerCareAssigneeId +prayerCareRevision +prayerCareUpdatedAt')
        .populate('branchId', 'name')
        .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.guests.countDocuments(query),
    ]);
    const branchIds = [...new Set(records.map(({ branchId }) => String(branchId && typeof branchId === 'object' && '_id' in branchId ? branchId._id : branchId)))].filter((id) => Types.ObjectId.isValid(id));
    const assignees = user.role === 'follow_up' || !branchIds.length ? [] : await this.users.find({
      branchId: { $in: branchIds }, role: { $in: ASSIGNEE_ROLES }, isActive: true,
    }).select('firstName lastName branchId').sort({ firstName: 1, lastName: 1 }).lean();
    return {
      page, total, totalPages: Math.max(1, Math.ceil(total / limit)),
      canAssign: user.role !== 'follow_up',
      assignees,
      items: records.map((record) => ({
        id: String(record._id), branch: record.branchId,
        name: [record.firstName, record.lastName].filter(Boolean).join(' '),
        request: record.prayerRequest, status: record.prayerCareStatus ?? 'new',
        assigneeId: record.prayerCareAssigneeId ? String(record.prayerCareAssigneeId) : null,
        revision: record.prayerCareRevision ?? 0, createdAt: record.createdAt,
        updatedAt: record.prayerCareUpdatedAt,
        contactAllowed: record.wantsPastoralCall === true,
        ...(record.wantsPastoralCall === true ? { phone: record.phone } : {}),
      })),
    };
  }

  async update(user: AuthUser, id: string, dto: UpdatePrayerCareDto) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException();
    const query = { ...(await this.scope(user)), _id: id };
    const record = await this.guests.findOne(query)
      .select('branchId wantsPastoralCall +prayerCareRevision +prayerCareStatus +prayerCareAssigneeId').lean();
    if (!record) throw new NotFoundException();
    if (dto.assigneeId !== undefined && user.role === 'follow_up') throw new ForbiddenException();
    if (dto.status === 'follow_up' && record.wantsPastoralCall !== true) {
      throw new BadRequestException('This guest has not asked to be contacted.');
    }
    if (dto.assigneeId && !await this.users.exists({
      _id: dto.assigneeId, branchId: record.branchId, role: { $in: ASSIGNEE_ROLES }, isActive: true,
    })) throw new BadRequestException('Choose an active care team member from this branch.');

    const revision = record.prayerCareRevision ?? 0;
    if (revision !== dto.revision) throw new ConflictException('This request changed. Refresh and try again.');
    const change = {
      prayerCareStatus: dto.status, prayerCareUpdatedAt: new Date(),
      ...(dto.assigneeId !== undefined ? { prayerCareAssigneeId: dto.assigneeId } : {}),
    };
    const saved = await this.guests.updateOne({
      ...query, branchId: record.branchId,
      ...(revision ? { prayerCareRevision: revision } : { $or: [{ prayerCareRevision: 0 }, { prayerCareRevision: { $exists: false } }] }),
    }, { $set: change, $inc: { prayerCareRevision: 1 } });
    if (!saved.matchedCount) throw new ConflictException('This request changed. Refresh and try again.');
    await this.audit.record({
      entityType: 'prayer_care', entityId: id, action: 'update', summary: 'Updated private prayer care', actor: user,
      branchId: String(record.branchId),
      metadata: {
        previousStatus: record.prayerCareStatus ?? 'new',
        status: dto.status,
        ...(dto.assigneeId !== undefined ? {
          previousAssigneeId: record.prayerCareAssigneeId ? String(record.prayerCareAssigneeId) : null,
          assigneeId: dto.assigneeId,
        } : {}),
      },
    });
    return { revision: revision + 1 };
  }
}
