import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { isGlobalRole } from '../common/constants/roles.constants';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { Guest, GuestDocument } from '../guests/schemas/guest.schema';
import { MailService } from '../mail/mail.service';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import {
  CreateCommunicationTemplateDto,
  UpdateCommunicationTemplateDto,
} from './dto/manage-template.dto';
import { Communication, CommunicationDocument } from './schemas/communication.schema';
import {
  CommunicationTemplate,
  CommunicationTemplateDocument,
} from './schemas/communication-template.schema';

const DEFAULT_COMMUNICATION_TEMPLATES = [
  {
    key: 'welcome_first_timer',
    name: 'Welcome first-timer',
    channel: 'email',
    subject: 'Thank you for worshipping with us',
    message:
      'Thank you for worshipping with us. We are grateful you came and would love to stay connected with you.',
    sortOrder: 10,
  },
  {
    key: 'thank_you_for_worshipping',
    name: 'Thank you message',
    channel: 'email',
    subject: 'Thank you for being with us',
    message:
      'Thank you again for joining us. We hope the service strengthened you, and we would be glad to help you take your next step.',
    sortOrder: 20,
  },
  {
    key: 'next_service_reminder',
    name: 'Next service reminder',
    channel: 'email',
    subject: 'We would love to welcome you again',
    message:
      'Our next service is coming up soon, and we would be honored to welcome you again. Please let us know if we can help you plan your visit.',
    sortOrder: 30,
  },
  {
    key: 'pastoral_follow_up',
    name: 'Pastoral follow-up',
    channel: 'email',
    subject: 'Pastoral follow-up',
    message:
      'Thank you for connecting with us. A pastor or leader from our team would be glad to follow up, pray with you, and help you in any way we can.',
    sortOrder: 40,
  },
  {
    key: 'member_care_check_in',
    name: 'Member care check-in',
    channel: 'email',
    subject: 'Checking in from church',
    message:
      'We are checking in to see how you are doing and how we can support you this week. Please reply if there is anything you would like us to pray about or help with.',
    sortOrder: 50,
  },
];

@Injectable()
export class CommunicationsService {
  constructor(
    @InjectModel(Communication.name)
    private readonly communicationModel: Model<CommunicationDocument>,
    @InjectModel(CommunicationTemplate.name)
    private readonly communicationTemplateModel: Model<CommunicationTemplateDocument>,
    @InjectModel(Guest.name)
    private readonly guestModel: Model<GuestDocument>,
    @InjectModel(Member.name)
    private readonly memberModel: Model<MemberDocument>,
    private readonly mailService: MailService,
    private readonly accessScopeService: AccessScopeService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private normalizeText(value?: string) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private buildRegex(search?: string) {
    const normalized = this.normalizeText(search);
    return normalized ? new RegExp(normalized, 'i') : undefined;
  }

  private async ensureDefaultTemplates() {
    const existingCount = await this.communicationTemplateModel.countDocuments();

    if (existingCount > 0) {
      return;
    }

    await this.communicationTemplateModel.insertMany(
      DEFAULT_COMMUNICATION_TEMPLATES.map((template) => ({
        ...template,
        isActive: true,
        isSeeded: true,
      })),
    );
  }

  private async getScopedRecipientIds(
    currentUser: AuthUser,
    requestedBranchId?: string,
  ) {
    const branchFilter = await this.accessScopeService.buildBranchFilter(
      currentUser,
      requestedBranchId,
    );

    const [guestIds, memberIds] = await Promise.all([
      this.guestModel.find(branchFilter).distinct('_id'),
      this.memberModel.find(branchFilter).distinct('_id'),
    ]);

    return { guestIds, memberIds };
  }

  private async resolveRecipientScope(dto: CreateCommunicationDto, currentUser: AuthUser) {
    if (dto.guestId) {
      const guest = await this.guestModel.findById(dto.guestId).lean();
      if (!guest) {
        throw new NotFoundException('Guest not found');
      }

      await this.accessScopeService.ensureBranchAccess(currentUser, String(guest.branchId));
      return {
        branchId: String(guest.branchId),
        recipientName: `${guest.firstName} ${guest.lastName}`,
      };
    }

    if (dto.memberId) {
      const member = await this.memberModel.findById(dto.memberId).lean();
      if (!member) {
        throw new NotFoundException('Member not found');
      }

      await this.accessScopeService.ensureBranchAccess(currentUser, String(member.branchId));
      return {
        branchId: String(member.branchId),
        recipientName: `${member.firstName} ${member.lastName}`,
      };
    }

    return {};
  }

  async listTemplates(_currentUser: AuthUser) {
    await this.ensureDefaultTemplates();

    return this.communicationTemplateModel
      .find()
      .sort({ sortOrder: 1, name: 1 })
      .lean();
  }

  async createTemplate(
    dto: CreateCommunicationTemplateDto,
    currentUser: AuthUser,
  ) {
    await this.ensureDefaultTemplates();

    if (!isGlobalRole(currentUser.role)) {
      throw new ForbiddenException(
        'Only the overall oversight admin can manage shared templates',
      );
    }

    const created = await this.communicationTemplateModel.create({
      key: dto.key.trim(),
      name: dto.name.trim(),
      channel: this.normalizeText(dto.channel) ?? 'email',
      subject: this.normalizeText(dto.subject),
      message: dto.message.trim(),
      isActive: dto.isActive ?? true,
      isSeeded: false,
      sortOrder: dto.sortOrder ?? 100,
    });

    await this.auditLogsService.record({
      entityType: 'communication_template',
      entityId: String(created._id),
      action: 'created',
      summary: `Communication template ${created.name} created`,
      actor: currentUser,
      metadata: {
        key: created.key,
        channel: created.channel,
      },
    });

    return created.toObject();
  }

  async updateTemplate(
    id: string,
    dto: UpdateCommunicationTemplateDto,
    currentUser: AuthUser,
  ) {
    if (!isGlobalRole(currentUser.role)) {
      throw new ForbiddenException(
        'Only the overall oversight admin can manage shared templates',
      );
    }

    const existing = await this.communicationTemplateModel.findById(id).lean();
    if (!existing) {
      throw new NotFoundException('Communication template not found');
    }

    const updated = await this.communicationTemplateModel
      .findByIdAndUpdate(
        id,
        {
          name: this.normalizeText(dto.name) ?? existing.name,
          channel: this.normalizeText(dto.channel) ?? existing.channel,
          subject:
            dto.subject !== undefined
              ? this.normalizeText(dto.subject)
              : existing.subject,
          message: this.normalizeText(dto.message) ?? existing.message,
          isActive: dto.isActive ?? existing.isActive,
          sortOrder: dto.sortOrder ?? existing.sortOrder,
        },
        { new: true },
      )
      .lean();

    if (!updated) {
      throw new NotFoundException('Communication template not found');
    }

    await this.auditLogsService.record({
      entityType: 'communication_template',
      entityId: String(updated._id),
      action: 'updated',
      summary: `Communication template ${updated.name} updated`,
      actor: currentUser,
      metadata: {
        key: updated.key,
        channel: updated.channel,
        isActive: updated.isActive,
      },
    });

    return updated;
  }

  async send(dto: CreateCommunicationDto, currentUser: AuthUser) {
    const resolvedScope = await this.resolveRecipientScope(dto, currentUser);

    let status = 'sent';
    let previewUrl: string | undefined;
    let deliveredAt: Date | undefined;
    let deliveryMode = dto.channel === 'email' ? 'system_email' : 'manual_sms';
    let failedAt: Date | undefined;
    let errorMessage: string | undefined;
    let externalMessageId: string | undefined;

    if (dto.channel === 'phone_call') {
      deliveryMode = 'manual_call';
      deliveredAt = new Date();
    } else if (dto.channel === 'sms') {
      deliveryMode = 'manual_sms';
      deliveredAt = new Date();
    } else if (dto.channel === 'email') {
      try {
        const subject = dto.subject || dto.templateName.replace(/_/g, ' ');
        const delivery = await this.mailService.sendAppEmail({
          to: dto.recipient,
          subject,
          text: dto.message,
          html: `<div style="font-family: Arial, sans-serif; padding: 20px; color: #0f172a;"><p>${dto.message.replace(/\n/g, '<br />')}</p></div>`,
        });

        status = delivery.delivered ? 'sent' : 'preview';
        deliveryMode = delivery.delivered ? 'system_email' : 'preview_email';
        previewUrl = delivery.previewUrl ?? undefined;
        deliveredAt = delivery.delivered ? new Date() : undefined;
        externalMessageId = delivery.messageId ?? undefined;
      } catch (error) {
        status = 'failed';
        deliveryMode = 'system_email';
        failedAt = new Date();
        errorMessage =
          error instanceof Error ? error.message : 'Email delivery failed';
      }
    }

    const created = await this.communicationModel.create({
      ...dto,
      subject: dto.subject || undefined,
      branchId: resolvedScope.branchId,
      sentBy: currentUser.sub,
      senderRole: currentUser.role,
      status,
      deliveryMode,
      previewUrl,
      deliveredAt,
      failedAt,
      errorMessage,
      externalMessageId,
    });

    await this.auditLogsService.record({
      entityType: 'communication',
      entityId: String(created._id),
      action: 'created',
      summary: `Communication logged on ${dto.channel}`,
      actor: currentUser,
      metadata: {
        templateName: dto.templateName,
        channel: dto.channel,
        guestId: dto.guestId,
        memberId: dto.memberId,
        status,
        deliveryMode,
        branchId: resolvedScope.branchId,
        recipientName: resolvedScope.recipientName,
        errorMessage,
      },
    });

    return created.toObject();
  }

  async listHistory(
    currentUser: AuthUser,
    filters: {
      branchId?: string;
      channel?: string;
      status?: string;
      deliveryMode?: string;
      templateName?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const safeLimit = Math.min(Math.max(filters.limit || 12, 1), 100);
    const requestedPage = Math.max(filters.page || 1, 1);
    const searchRegex = this.buildRegex(filters.search);
    const { guestIds, memberIds } = await this.getScopedRecipientIds(
      currentUser,
      filters.branchId,
    );

    const query: Record<string, unknown> = {
      $or: [{ guestId: { $in: guestIds } }, { memberId: { $in: memberIds } }],
    };

    if (filters.channel) {
      query.channel = filters.channel;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.deliveryMode) {
      query.deliveryMode = filters.deliveryMode;
    }

    if (filters.templateName) {
      query.templateName = filters.templateName;
    }

    if (searchRegex) {
      query.$and = [
        {
          $or: [
            { recipient: searchRegex },
            { subject: searchRegex },
            { message: searchRegex },
            { templateName: searchRegex },
            { errorMessage: searchRegex },
            { senderRole: searchRegex },
          ],
        },
      ];
    }

    const total = await this.communicationModel.countDocuments(query);
    const totalPages = Math.max(Math.ceil(total / safeLimit), 1);
    const safePage = Math.min(requestedPage, totalPages);
    const skip = (safePage - 1) * safeLimit;

    const [items, channelBuckets, statusBuckets, deliveryModeBuckets] =
      await Promise.all([
      this.communicationModel
        .find(query)
        .populate({
          path: 'guestId',
          populate: { path: 'branchId', select: 'name oversightRegion district' },
        })
        .populate({
          path: 'memberId',
          populate: { path: 'branchId', select: 'name oversightRegion district' },
        })
        .populate('branchId', 'name oversightRegion district')
        .populate('sentBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      this.communicationModel.aggregate<{ _id: string; total: number }>([
        { $match: query },
        { $group: { _id: '$channel', total: { $sum: 1 } } },
      ]),
      this.communicationModel.aggregate<{ _id: string; total: number }>([
        { $match: query },
        { $group: { _id: '$status', total: { $sum: 1 } } },
      ]),
      this.communicationModel.aggregate<{ _id: string; total: number }>([
        { $match: query },
        { $group: { _id: '$deliveryMode', total: { $sum: 1 } } },
      ]),
      ]);

    const channelSummary = {
      email: 0,
      sms: 0,
      phoneCall: 0,
    };
    for (const bucket of channelBuckets) {
      if (bucket._id === 'email') {
        channelSummary.email = bucket.total;
      } else if (bucket._id === 'sms') {
        channelSummary.sms = bucket.total;
      } else if (bucket._id === 'phone_call') {
        channelSummary.phoneCall = bucket.total;
      }
    }

    const statusSummary = {
      sent: 0,
      preview: 0,
      queued: 0,
      failed: 0,
    };
    for (const bucket of statusBuckets) {
      if (bucket._id === 'sent') {
        statusSummary.sent = bucket.total;
      } else if (bucket._id === 'preview') {
        statusSummary.preview = bucket.total;
      } else if (bucket._id === 'queued') {
        statusSummary.queued = bucket.total;
      } else if (bucket._id === 'failed') {
        statusSummary.failed = bucket.total;
      }
    }

    const deliverySummary = {
      systemEmail: 0,
      previewEmail: 0,
      manualSms: 0,
      manualCall: 0,
    };
    for (const bucket of deliveryModeBuckets) {
      if (bucket._id === 'system_email') {
        deliverySummary.systemEmail = bucket.total;
      } else if (bucket._id === 'preview_email') {
        deliverySummary.previewEmail = bucket.total;
      } else if (bucket._id === 'manual_sms') {
        deliverySummary.manualSms = bucket.total;
      } else if (bucket._id === 'manual_call') {
        deliverySummary.manualCall = bucket.total;
      }
    }

    return {
      items,
      pagination: {
        page: safePage,
        pageSize: safeLimit,
        total,
        totalPages,
      },
      summary: {
        total,
        ...channelSummary,
        ...statusSummary,
        ...deliverySummary,
      },
    };
  }

  async list(currentUser: AuthUser, filters: { guestId?: string; memberId?: string }) {
    if (filters.guestId) {
      await this.resolveRecipientScope({ ...filters, templateName: 'filter', channel: 'filter', recipient: 'filter', message: 'filter' }, currentUser);
    }

    if (filters.memberId) {
      await this.resolveRecipientScope({ ...filters, templateName: 'filter', channel: 'filter', recipient: 'filter', message: 'filter' }, currentUser);
    }

    const query = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    const records = await this.communicationModel
      .find(query)
      .populate({
        path: 'guestId',
        populate: { path: 'branchId', select: 'name oversightRegion district' },
      })
      .populate({
        path: 'memberId',
        populate: { path: 'branchId', select: 'name oversightRegion district' },
      })
      .populate('branchId', 'name oversightRegion district')
      .populate('sentBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();

    if (currentUser.role === 'super_admin') {
      return records;
    }

    const branchFilter = await this.accessScopeService.buildBranchFilter(currentUser);
    const visibleGuestIds = new Set(
      (await this.guestModel.find(branchFilter).distinct('_id')).map((value) => String(value)),
    );
    const visibleMemberIds = new Set(
      (await this.memberModel.find(branchFilter).distinct('_id')).map((value) => String(value)),
    );

    return records.filter((record) => {
      const guestId = record.guestId && typeof record.guestId === 'object' && '_id' in record.guestId
        ? String(record.guestId._id)
        : record.guestId
          ? String(record.guestId)
          : undefined;
      const memberId = record.memberId && typeof record.memberId === 'object' && '_id' in record.memberId
        ? String(record.memberId._id)
        : record.memberId
          ? String(record.memberId)
          : undefined;

      return (guestId && visibleGuestIds.has(guestId)) || (memberId && visibleMemberIds.has(memberId));
    });
  }
}
