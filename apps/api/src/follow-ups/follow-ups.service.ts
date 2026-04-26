import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Guest, GuestDocument } from '../guests/schemas/guest.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreateFollowUpDto, UpdateFollowUpDto } from './dto/create-follow-up.dto';
import { FollowUp, FollowUpDocument } from './schemas/follow-up.schema';

@Injectable()
export class FollowUpsService {
  constructor(
    @InjectModel(FollowUp.name) private readonly followUpModel: Model<FollowUpDocument>,
    @InjectModel(Guest.name) private readonly guestModel: Model<GuestDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly accessScopeService: AccessScopeService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private extractBranchId(value: unknown) {
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'object' && value !== null && '_id' in value) {
      return String((value as { _id?: unknown })._id ?? '');
    }

    return value ? String(value) : '';
  }

  private normalizeSearch(search?: string) {
    const trimmed = search?.trim();
    return trimmed ? trimmed : undefined;
  }

  private buildGuestSearchConditions(search?: string) {
    const normalizedSearch = this.normalizeSearch(search);

    if (!normalizedSearch) {
      return undefined;
    }

    return [
      { firstName: { $regex: normalizedSearch, $options: 'i' } },
      { lastName: { $regex: normalizedSearch, $options: 'i' } },
      { phone: { $regex: normalizedSearch, $options: 'i' } },
      { email: { $regex: normalizedSearch, $options: 'i' } },
    ];
  }

  private buildQuery(clauses: Record<string, unknown>[]) {
    if (clauses.length === 0) {
      return {};
    }

    if (clauses.length === 1) {
      return clauses[0];
    }

    return { $and: clauses };
  }

  private async getScopedGuest(guestId: string, currentUser: AuthUser) {
    const guest = await this.guestModel.findById(guestId).lean();
    if (!guest) {
      throw new NotFoundException('Guest not found');
    }

    await this.accessScopeService.ensureBranchAccess(
      currentUser,
      String(guest.branchId),
    );

    return guest;
  }

  private async ensureAssignableUser(assignedTo: string, guestBranchId: string, currentUser: AuthUser) {
    const user = await this.userModel.findById(assignedTo).select('-password -passwordResetToken').lean();

    if (!user) {
      throw new BadRequestException('Assigned user was not found');
    }

    if (!user.isActive) {
      throw new BadRequestException('Assigned user is inactive');
    }

    if (!['branch_admin', 'resident_pastor', 'associate_pastor', 'follow_up'].includes(user.role)) {
      throw new BadRequestException(
        'Only branch admins, resident pastors, associate pastors, and follow-up users can own follow-up tasks',
      );
    }

    const assigneeBranchId = this.extractBranchId(user.branchId);
    if (!assigneeBranchId || assigneeBranchId !== guestBranchId) {
      throw new BadRequestException('Assigned user must belong to the same branch as the guest');
    }

    if (currentUser.role === 'follow_up' && String(user._id) !== currentUser.sub) {
      throw new ForbiddenException('Follow-up team members can only assign tasks to themselves');
    }
  }

  private normalizeStatus(status: string | undefined, assignedTo?: string | null) {
    const normalizedStatus = (status || 'new').trim();

    if (assignedTo && normalizedStatus === 'new') {
      return 'assigned';
    }

    if (!assignedTo && normalizedStatus === 'assigned') {
      return 'new';
    }

    return normalizedStatus;
  }

  async create(dto: CreateFollowUpDto, currentUser?: AuthUser) {
    const assignedTo = dto.assignedTo ?? undefined;

    if (!currentUser && assignedTo) {
      throw new BadRequestException('Public registration cannot assign a follow-up worker');
    }

    let guestBranchId = '';
    if (currentUser) {
      const guest = await this.getScopedGuest(dto.guestId, currentUser);
      guestBranchId = this.extractBranchId(guest.branchId);
    }

    if (currentUser && assignedTo) {
      await this.ensureAssignableUser(assignedTo, guestBranchId, currentUser);
    }

    const followUp = await this.followUpModel.create({
      ...dto,
      assignedTo,
      status: this.normalizeStatus(dto.status, assignedTo),
      nextActionDate: dto.nextActionDate ? new Date(dto.nextActionDate) : undefined,
    });

    await this.auditLogsService.record({
      entityType: 'follow_up',
      entityId: String(followUp._id),
      action: 'created',
      summary: `Follow-up created with ${this.normalizeStatus(dto.status, assignedTo)} status`,
      actor: currentUser,
      actorRole: currentUser?.role ?? 'public_submission',
      branchId: guestBranchId || undefined,
      metadata: {
        guestId: dto.guestId,
        assignedTo,
        contactMethod: dto.contactMethod,
        status: this.normalizeStatus(dto.status, assignedTo),
      },
    });

    return followUp;
  }

  async findAll(
    currentUser: AuthUser,
    filters: {
      assignedTo?: string;
      status?: string;
      guestId?: string;
      branchId?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const safeLimit = Math.min(Math.max(filters.limit || 12, 1), 100);
    const requestedPage = Math.max(filters.page || 1, 1);
    const baseClauses: Record<string, unknown>[] = [];
    const searchConditions = this.buildGuestSearchConditions(filters.search);
    const guestScopeQuery = await this.accessScopeService.buildBranchFilter(
      currentUser,
      filters.branchId,
    );

    if (currentUser.role === 'follow_up') {
      baseClauses.push({ assignedTo: currentUser.sub });
    } else if (filters.assignedTo) {
      baseClauses.push({ assignedTo: filters.assignedTo });
    }

    if (filters.guestId) {
      await this.getScopedGuest(filters.guestId, currentUser);
      baseClauses.push({ guestId: filters.guestId });
    } else {
      const scopedGuestIds = await this.guestModel.find(guestScopeQuery).distinct('_id');
      baseClauses.push({ guestId: { $in: scopedGuestIds } });
    }

    if (searchConditions) {
      const matchingGuestIds = await this.guestModel
        .find({
          ...guestScopeQuery,
          $or: searchConditions,
        })
        .distinct('_id');

      baseClauses.push({
        $or: [
          { note: { $regex: this.normalizeSearch(filters.search), $options: 'i' } },
          { guestId: { $in: matchingGuestIds } },
        ],
      });
    }

    const summaryQuery = this.buildQuery(baseClauses);
    const filteredClauses = [...baseClauses];

    if (filters.status) {
      filteredClauses.push({ status: filters.status });
    }

    const filteredQuery = this.buildQuery(filteredClauses);

    const [filteredTotal, statusBuckets] = await Promise.all([
      this.followUpModel.countDocuments(filteredQuery),
      this.followUpModel.aggregate<{ _id: string; total: number }>([
        { $match: summaryQuery },
        {
          $group: {
            _id: '$status',
            total: { $sum: 1 },
          },
        },
      ]),
    ]);

    const totalPages = Math.max(Math.ceil(filteredTotal / safeLimit), 1);
    const safePage = Math.min(requestedPage, totalPages);
    const skip = (safePage - 1) * safeLimit;

    const items = await this.followUpModel
      .find(filteredQuery)
      .populate({
        path: 'guestId',
        populate: {
          path: 'branchId',
          select: 'name',
        },
      })
      .populate('assignedTo', '-password')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean();

    const statusTotals = {
      new: 0,
      assigned: 0,
      contacted: 0,
      prayedWith: 0,
      invitedBack: 0,
      returned: 0,
      converted: 0,
    };

    for (const bucket of statusBuckets) {
      switch (bucket._id) {
        case 'new':
          statusTotals.new = bucket.total;
          break;
        case 'assigned':
          statusTotals.assigned = bucket.total;
          break;
        case 'contacted':
          statusTotals.contacted = bucket.total;
          break;
        case 'prayed_with':
          statusTotals.prayedWith = bucket.total;
          break;
        case 'invited_back':
          statusTotals.invitedBack = bucket.total;
          break;
        case 'returned':
          statusTotals.returned = bucket.total;
          break;
        case 'converted':
          statusTotals.converted = bucket.total;
          break;
        default:
          break;
      }
    }

    return {
      items,
      pagination: {
        page: safePage,
        pageSize: safeLimit,
        total: filteredTotal,
        totalPages,
      },
      summary: {
        total:
          statusTotals.new +
          statusTotals.assigned +
          statusTotals.contacted +
          statusTotals.prayedWith +
          statusTotals.invitedBack +
          statusTotals.returned +
          statusTotals.converted,
        ...statusTotals,
      },
    };
  }

  async findOne(id: string, currentUser: AuthUser) {
    const followUp = await this.followUpModel
      .findById(id)
      .populate('guestId')
      .populate('assignedTo', '-password')
      .lean();
    if (!followUp) {
      throw new NotFoundException('Follow-up not found');
    }

    await this.accessScopeService.ensureBranchAccess(
      currentUser,
      String((followUp.guestId as { branchId?: unknown })?.branchId ?? ''),
    );

    if (currentUser.role === 'follow_up' && String(followUp.assignedTo?._id ?? '') !== currentUser.sub) {
      throw new ForbiddenException('You can only access follow-up tasks assigned to you');
    }

    return followUp;
  }

  async update(id: string, dto: UpdateFollowUpDto, currentUser: AuthUser) {
    const existing = await this.findOne(id, currentUser);
    let guestBranchId = this.extractBranchId((existing.guestId as { branchId?: unknown })?.branchId);
    const hasAssignedToField = Object.prototype.hasOwnProperty.call(dto, 'assignedTo');
    const assignedTo = hasAssignedToField
      ? dto.assignedTo ?? undefined
      : existing.assignedTo?._id
        ? String(existing.assignedTo._id)
        : undefined;

    if (dto.guestId) {
      const guest = await this.getScopedGuest(dto.guestId, currentUser);
      guestBranchId = this.extractBranchId(guest.branchId);
    }

    if (assignedTo) {
      await this.ensureAssignableUser(assignedTo, guestBranchId, currentUser);
    }

    const followUp = await this.followUpModel
      .findByIdAndUpdate(
        id,
        {
          ...dto,
          assignedTo,
          status: this.normalizeStatus(dto.status ?? existing.status, assignedTo),
          nextActionDate: dto.nextActionDate ? new Date(dto.nextActionDate) : undefined,
        },
        { new: true },
      )
      .lean();
    if (!followUp) {
      throw new NotFoundException('Follow-up not found');
    }

    await this.auditLogsService.record({
      entityType: 'follow_up',
      entityId: String(followUp._id),
      action: 'updated',
      summary: `Follow-up updated to ${this.normalizeStatus(dto.status ?? existing.status, assignedTo)}`,
      actor: currentUser,
      branchId: guestBranchId || undefined,
      metadata: {
        guestId: dto.guestId ?? String((existing.guestId as { _id?: unknown })?._id ?? ''),
        assignedTo,
        contactMethod: dto.contactMethod ?? existing.contactMethod,
        status: this.normalizeStatus(dto.status ?? existing.status, assignedTo),
      },
    });

    return this.findOne(String(followUp._id), currentUser);
  }
}
