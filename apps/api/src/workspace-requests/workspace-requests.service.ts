import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MailService } from '../mail/mail.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { FIRST_WORKSPACE_ID, getWorkspace } from '../workspaces/workspace-boundary';
import { CreateWorkspaceRequestDto } from './dto/create-workspace-request.dto';
import { UpdateWorkspaceRequestDto } from './dto/update-workspace-request.dto';
import {
  WorkspaceRequest,
  WorkspaceRequestDocument,
} from './schemas/workspace-request.schema';

@Injectable()
export class WorkspaceRequestsService implements OnModuleInit {
  private readonly logger = new Logger(WorkspaceRequestsService.name);

  constructor(
    @InjectModel(WorkspaceRequest.name)
    private readonly workspaceRequestModel: Model<WorkspaceRequestDocument>,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async onModuleInit() {
    await this.workspaceRequestModel.init();
  }

  async checkHandle(raw?: string) {
    if (getWorkspace(this.configService).id !== FIRST_WORKSPACE_ID) {
      throw new NotFoundException();
    }
    const handle = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (!/^(?=.{3,64}$)[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle)) {
      return { handle, status: 'invalid' as const };
    }
    const taken = this.isReservedHandle(handle) || await this.workspaceRequestModel.exists({
      workspaceHandle: handle,
      workspaceHandleClaimed: true,
    });
    return { handle, status: taken ? 'taken' as const : 'available' as const };
  }

  private normalizeText(value?: string) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private buildNotificationMessage(dto: CreateWorkspaceRequestDto) {
    return [
      `Organization: ${dto.organizationName}`,
      `Contact: ${dto.contactName}`,
      `Email: ${dto.email}`,
      dto.phone ? `Phone: ${dto.phone}` : undefined,
      dto.country ? `Country: ${dto.country}` : undefined,
      dto.state ? `State: ${dto.state}` : undefined,
      dto.city ? `City: ${dto.city}` : undefined,
      dto.branchCount ? `Expected branches: ${dto.branchCount}` : undefined,
      dto.notes ? `Notes: ${dto.notes}` : undefined,
    ]
      .filter(Boolean)
      .join('\n');
  }

  async create(
    dto: CreateWorkspaceRequestDto,
  ): Promise<Record<string, unknown>> {
    const handle = dto.workspaceHandle === undefined ? undefined : await this.checkHandle(dto.workspaceHandle);
    if (handle?.status === 'invalid') throw new BadRequestException({ code: 'workspace_handle_invalid', message: 'Enter a valid workspace handle.' });
    if (handle?.status === 'taken') throw this.handleTaken();
    const payload = {
      organizationName: dto.organizationName.trim(),
      workspaceHandle: handle?.handle,
      contactName: dto.contactName.trim(),
      email: dto.email.trim().toLowerCase(),
      phone: this.normalizeText(dto.phone),
      country: this.normalizeText(dto.country),
      state: this.normalizeText(dto.state),
      city: this.normalizeText(dto.city),
      branchCount: dto.branchCount,
      notes: this.normalizeText(dto.notes),
      status: 'new',
      notificationStatus: 'queued',
    };

    const request = await this.workspaceRequestModel.create(payload);

    await this.auditLogsService.record({
      entityType: 'workspace_request',
      entityId: String(request._id),
      action: 'created',
      summary: `Workspace request received from ${payload.organizationName}`,
      actorName: payload.contactName,
      actorEmail: payload.email,
      actorRole: 'public_request',
      metadata: {
        organizationName: payload.organizationName,
        branchCount: payload.branchCount,
        country: payload.country,
        state: payload.state,
        city: payload.city,
      },
    });

    const adminEmail = this.configService.get<string>('adminEmail');
    const appName = this.configService.get<string>('appName') ?? 'ChuFlow';

    if (!adminEmail) {
      return {
        ...request.toObject(),
        _id: String(request._id),
      };
    }

    try {
      const delivery = await this.mailService.sendAppEmail({
        to: adminEmail,
        subject: `${appName} workspace request: ${payload.organizationName}`,
        text: this.buildNotificationMessage(dto),
        html: `
          <div style="font-family: Arial, sans-serif; padding: 24px; color: #0f172a;">
            <h2 style="margin-bottom: 16px;">New workspace request</h2>
            <p><strong>Organization:</strong> ${payload.organizationName}</p>
            <p><strong>Contact:</strong> ${payload.contactName}</p>
            <p><strong>Email:</strong> ${payload.email}</p>
            ${payload.phone ? `<p><strong>Phone:</strong> ${payload.phone}</p>` : ''}
            ${payload.country ? `<p><strong>Country:</strong> ${payload.country}</p>` : ''}
            ${payload.state ? `<p><strong>State:</strong> ${payload.state}</p>` : ''}
            ${payload.city ? `<p><strong>City:</strong> ${payload.city}</p>` : ''}
            ${payload.branchCount ? `<p><strong>Expected branches:</strong> ${payload.branchCount}</p>` : ''}
            ${payload.notes ? `<p><strong>Notes:</strong><br />${payload.notes.replace(/\n/g, '<br />')}</p>` : ''}
          </div>
        `,
      });

      request.notificationStatus = delivery.delivered ? 'sent' : 'preview';
      request.adminNotifiedAt = delivery.delivered ? new Date() : undefined;
      await request.save();
    } catch (error) {
      this.logger.warn(
        `Workspace request notification failed for ${payload.email}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      request.notificationStatus = 'failed';
      await request.save();
    }

    return {
      ...request.toObject(),
      _id: String(request._id),
    };
  }

  async findAll(
    filters: {
      status?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<Record<string, unknown>> {
    const safeLimit = Math.min(Math.max(filters.limit || 12, 1), 100);
    const requestedPage = Math.max(filters.page || 1, 1);
    const query: Record<string, unknown> = {};
    const normalizedStatus = this.normalizeText(filters.status);
    const normalizedSearch = this.normalizeText(filters.search);

    if (normalizedStatus) {
      query.status = normalizedStatus;
    }

    if (normalizedSearch) {
      query.$or = [
        { organizationName: { $regex: normalizedSearch, $options: 'i' } },
        { contactName: { $regex: normalizedSearch, $options: 'i' } },
        { email: { $regex: normalizedSearch, $options: 'i' } },
        { city: { $regex: normalizedSearch, $options: 'i' } },
        { state: { $regex: normalizedSearch, $options: 'i' } },
      ];
    }

    const total = await this.workspaceRequestModel.countDocuments(query);
    const totalPages = Math.max(Math.ceil(total / safeLimit), 1);
    const safePage = Math.min(requestedPage, totalPages);
    const skip = (safePage - 1) * safeLimit;

    const [items, summaryRows] = await Promise.all([
      this.workspaceRequestModel
        .find(query)
        .populate('reviewedBy', 'firstName lastName email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      this.workspaceRequestModel.aggregate<{
        _id: null;
        total: number;
        newCount: number;
        inReviewCount: number;
        approvedCount: number;
        rejectedCount: number;
        provisionedCount: number;
      }>([
        { $match: query },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            newCount: { $sum: { $cond: [{ $eq: ['$status', 'new'] }, 1, 0] } },
            inReviewCount: {
              $sum: { $cond: [{ $eq: ['$status', 'in_review'] }, 1, 0] },
            },
            approvedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] },
            },
            rejectedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] },
            },
            provisionedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'provisioned'] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const summary = summaryRows[0] ?? {
      total: 0,
      newCount: 0,
      inReviewCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      provisionedCount: 0,
    };

    return {
      items: items.map((item) => ({
        ...item,
        _id: String(item._id),
        reviewedBy:
          typeof item.reviewedBy === 'object' && item.reviewedBy !== null
            ? {
                _id: String((item.reviewedBy as { _id?: unknown })._id ?? ''),
                firstName: (item.reviewedBy as { firstName?: string })
                  .firstName,
                lastName: (item.reviewedBy as { lastName?: string }).lastName,
                email: (item.reviewedBy as { email?: string }).email,
                role: (item.reviewedBy as { role?: string }).role,
              }
            : undefined,
      })),
      pagination: {
        page: safePage,
        pageSize: safeLimit,
        total,
        totalPages,
      },
      summary: {
        total: summary.total,
        newCount: summary.newCount,
        inReviewCount: summary.inReviewCount,
        approvedCount: summary.approvedCount,
        rejectedCount: summary.rejectedCount,
        provisionedCount: summary.provisionedCount,
      },
    };
  }

  async updateStatus(
    id: string,
    dto: UpdateWorkspaceRequestDto,
    currentUser: AuthUser,
  ): Promise<Record<string, unknown>> {
    const existing = await this.workspaceRequestModel.findById(id).lean();

    if (!existing) {
      throw new NotFoundException('Workspace request not found');
    }

    const nextStatus = dto.status;
    const claim = !!existing.workspaceHandle && !existing.workspaceHandleClaimed &&
      (nextStatus === 'approved' || nextStatus === 'provisioned');
    if (claim && this.isReservedHandle(existing.workspaceHandle!)) {
      throw this.handleTaken();
    }
    try {
      await this.workspaceRequestModel.findByIdAndUpdate(id, {
        status: nextStatus,
        decisionNotes: this.normalizeText(dto.decisionNotes),
        reviewedBy: new Types.ObjectId(currentUser.sub),
        reviewedAt: new Date(),
        ...(claim ? { workspaceHandleClaimed: true } : {}),
      });
    } catch (error) {
      if (claim && typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        throw this.handleTaken();
      }
      throw error;
    }

    await this.auditLogsService.record({
      entityType: 'workspace_request',
      entityId: id,
      action: nextStatus,
      summary: `Workspace request ${existing.organizationName} moved to ${nextStatus.replace(/_/g, ' ')}`,
      actor: currentUser,
      metadata: {
        previousStatus: existing.status,
        nextStatus,
        decisionNotes: this.normalizeText(dto.decisionNotes),
      },
    });

    const updated = await this.workspaceRequestModel
      .findById(id)
      .populate('reviewedBy', 'firstName lastName email role')
      .lean();

    if (!updated) {
      throw new NotFoundException('Workspace request not found');
    }

    return {
      ...updated,
      _id: String(updated._id),
      reviewedBy:
        typeof updated.reviewedBy === 'object' && updated.reviewedBy !== null
          ? {
              _id: String((updated.reviewedBy as { _id?: unknown })._id ?? ''),
              firstName: (updated.reviewedBy as { firstName?: string })
                .firstName,
              lastName: (updated.reviewedBy as { lastName?: string }).lastName,
              email: (updated.reviewedBy as { email?: string }).email,
              role: (updated.reviewedBy as { role?: string }).role,
            }
          : undefined,
    };
  }

  private handleTaken() {
    return new ConflictException({ code: 'workspace_handle_taken', message: 'This workspace handle is already in use.' });
  }

  private isReservedHandle(handle: string) {
    return [
      FIRST_WORKSPACE_ID, 'admin', 'api', 'app', 'login', 'www', 'support',
      ...(process.env.CHUFLOW_RESERVED_WORKSPACE_HANDLES?.split(',') ?? []),
    ].includes(handle);
  }
}
