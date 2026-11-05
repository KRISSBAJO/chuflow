import { MeetingInvitationsService } from './meeting-invitations.service';
import { serviceAudienceFilter } from './meeting-recipients';
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
import { LEADERSHIP_ROLES } from '../common/constants/roles.constants';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import {
  ServiceUnit,
  ServiceUnitDocument,
} from '../service-units/schemas/service-unit.schema';
import {
  Meeting,
  MeetingDocument,
  MeetingGroup,
  MeetingGroupDocument,
  MeetingFile,
  MeetingFileDocument,
} from './meetings.schema';
import {
  MeetingListDto,
  MeetingAudienceDto,
  CreateMeetingDto,
  GroupDto,
  UpdateMeetingDto,
} from './meetings.dto';

export const meetingAdmin = (u: AuthUser) => LEADERSHIP_ROLES.includes(u.role);
export function validateMeetingTimes(start: string | Date, end: string | Date) {
  const a = new Date(start),
    b = new Date(end);
  if (
    !Number.isFinite(+a) ||
    !Number.isFinite(+b) ||
    +b <= +a ||
    +b - +a > 24 * 3600000
  )
    throw new BadRequestException(
      'Meeting end must be after its start and within 24 hours.',
    );
  return { startsAt: a, endsAt: b };
}
export function validateFutureMeetingTimes(
  start?: Date,
  end?: Date,
  now = Date.now(),
) {
  if (start && +start < now)
    throw new BadRequestException('Meeting start cannot be in the past.');
  if (end && +end < now)
    throw new BadRequestException('Meeting end cannot be in the past.');
}
export function minutesOverdue(
  m: {
    minutesRequired: boolean;
    minutesStatus: string;
    status: string;
    minutesDueAt: Date | string;
  },
  now = Date.now(),
) {
  return (
    m.minutesRequired &&
    !['submitted', 'approved'].includes(m.minutesStatus) &&
    m.status !== 'cancelled' &&
    +new Date(m.minutesDueAt) < now
  );
}
export function validateDocument(file: {
  originalname: string;
  buffer: Buffer;
  size: number;
}) {
  if (!file?.buffer?.length || file.size > 5 * 1024 * 1024)
    throw new BadRequestException(
      'Upload a PDF, Word document, or text file up to 5 MB.',
    );
  const name = Array.from(file.originalname.replace(/[\\/]/g, '_'))
    .map((char) =>
      char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? '_' : char,
    )
    .join('')
    .slice(0, 180);
  let mime: string;
  if (/\.pdf$/i.test(name) && file.buffer.subarray(0, 5).toString() === '%PDF-')
    mime = 'application/pdf';
  else if (
    /\.docx$/i.test(name) &&
    file.buffer.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4]))
  )
    mime =
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  else if (/\.txt$/i.test(name) && !file.buffer.includes(0))
    mime = 'text/plain';
  else
    throw new BadRequestException(
      'Only PDF, DOCX, and plain text documents are accepted.',
    );
  return { name, mime };
}
@Injectable()
export class MeetingsService {
  constructor(
    @InjectModel(Member.name) private readonly members: Model<MemberDocument>,
    @InjectModel(Meeting.name)
    private readonly meetings: Model<MeetingDocument>,
    @InjectModel(MeetingGroup.name)
    private readonly groupModel: Model<MeetingGroupDocument>,
    @InjectModel(MeetingFile.name)
    private readonly files: Model<MeetingFileDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(ServiceUnit.name)
    private readonly units: Model<ServiceUnitDocument>,
    @InjectModel(Branch.name) private readonly branches: Model<BranchDocument>,
    private readonly scope: AccessScopeService,
    private readonly invitations: MeetingInvitationsService,
  ) {}
  private id(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid record ID');
    return id;
  }
  private async group(u: AuthUser, id: string) {
    const g = await this.groupModel.findById(this.id(id)).lean();
    if (!g) throw new NotFoundException('Meeting group not found');
    await this.scope.ensureBranchAccess(u, String(g.branchId));
    return g;
  }
  private canWrite(u: AuthUser, g: MeetingGroup, m?: Meeting) {
    return (
      meetingAdmin(u) ||
      g.submitterUserIds.includes(u.sub) ||
      m?.organizerUserId === u.sub
    );
  }
  private async context(u: AuthUser, id: string) {
    const m = await this.meetings.findById(this.id(id)).lean();
    if (!m) throw new NotFoundException('Meeting not found');
    await this.scope.ensureBranchAccess(u, String(m.branchId));
    const g = await this.group(u, String(m.groupId));
    if (
      !this.canWrite(u, g, m) &&
      !g.reviewerUserIds.includes(u.sub) &&
      !m.attendeeUserIds.includes(u.sub)
    )
      throw new ForbiddenException('You are not assigned to this meeting.');
    return { m, g };
  }
  private async validateUsers(
    ids: string[],
    branchId: string,
    actor: AuthUser,
  ) {
    const unique = [...new Set(ids)];
    const found = await this.users
      .find({ _id: { $in: unique }, isActive: true })
      .select('_id branchId')
      .lean();
    if (
      found.length !== unique.length ||
      found.some(
        (x) =>
          String(x.branchId) !== branchId &&
          !(String(x._id) === actor.sub && meetingAdmin(actor)),
      )
    )
      throw new BadRequestException(
        'Choose active users from the meeting branch.',
      );
  }
  private async validateMembers(ids: string[], branchId: string) {
    if (
      (await this.members.countDocuments({ _id: { $in: ids }, branchId })) !==
      new Set(ids).size
    )
      throw new BadRequestException(
        'Members must belong to the meeting branch.',
      );
  }
  async participants(
    u: AuthUser,
    branchId: string,
    q = '',
    page = '1',
    kind: 'members' | 'staff' = 'members',
  ) {
    this.id(branchId);
    await this.scope.ensureBranchAccess(u, branchId);
    const limit = 8;
    if (q.trim().length < 2) return { items: [], total: 0, limit };
    const search = q
      .trim()
      .slice(0, 100)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const terms = search.split(/\s+/).filter(Boolean).slice(0, 8);
    const filter = {
      $and: [
        kind === 'staff'
          ? { isActive: true, $or: [{ branchId }, { _id: u.sub }] }
          : { branchId },
        ...terms.map((term) => ({
          $or: [
            { firstName: { $regex: term, $options: 'i' } },
            { lastName: { $regex: term, $options: 'i' } },
            { email: { $regex: term, $options: 'i' } },
          ],
        })),
      ],
    };
    const skip = (Math.max(1, Math.min(100000, Number(page) || 1)) - 1) * limit;
    if (kind === 'staff') {
      const [items, total] = await Promise.all([
        this.users
          .find(filter)
          .select('_id firstName lastName email')
          .sort({ firstName: 1, _id: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        this.users.countDocuments(filter),
      ]);
      return { items, total, limit };
    }
    const [items, total] = await Promise.all([
      this.members
        .find(filter)
        .select('_id firstName lastName email')
        .sort({ firstName: 1, _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.members.countDocuments(filter),
    ]);
    return { items, total, limit };
  }
  private async resolveAudience(
    branchId: string,
    mode: string,
    groupIds: string[],
    extraIds: string[],
  ) {
    await this.validateMembers(extraIds, branchId);
    let query: Record<string, unknown> | undefined;
    if (mode === 'service_groups') {
      if (!groupIds.length)
        throw new BadRequestException('Select at least one service group.');
      if (
        (await this.units.countDocuments({
          _id: { $in: groupIds },
          branchId,
          isActive: true,
        })) !== new Set(groupIds).size
      )
        throw new BadRequestException(
          'Choose active service groups from the meeting branch.',
        );
      query = {
        ...serviceAudienceFilter(branchId, groupIds),
        membershipStatus: 'active',
      };
    } else if (mode === 'church')
      query = { branchId, membershipStatus: 'active' };
    const rows = query
      ? await this.members.find(query).select('_id').limit(10001).lean()
      : [];
    const ids = [...new Set([...rows.map((m) => String(m._id)), ...extraIds])];
    if (ids.length > 10000)
      throw new BadRequestException(
        'Choose a smaller audience: at most 10,000 members per meeting.',
      );
    return ids;
  }
  async previewAudience(u: AuthUser, dto: MeetingAudienceDto) {
    const context = dto.meetingId ? await this.context(u, dto.meetingId) : null;
    const g = dto.groupId ? await this.group(u, dto.groupId) : null;
    if (context && String(context.m.groupId) !== dto.groupId)
      throw new BadRequestException('Meeting group does not match.');
    if (g ? !this.canWrite(u, g, context?.m) : !meetingAdmin(u))
      throw new ForbiddenException('You cannot select this meeting audience.');
    const branchId = g
      ? String(g.branchId)
      : await this.scope.resolveScopedBranchId(u, dto.branchId);
    if (!branchId) throw new BadRequestException('Select a church / branch.');
    await this.scope.ensureBranchAccess(u, branchId);
    await this.validateUsers(dto.attendeeUserIds, branchId, u);
    const ids = await this.resolveAudience(
      branchId,
      dto.audienceMode,
      dto.audienceServiceUnitIds,
      dto.attendeeMemberIds,
    );
    const delivery = await this.invitations.recipients({
      branchId: new Types.ObjectId(branchId),
      attendeeMemberIds: ids,
      attendeeUserIds: dto.attendeeUserIds,
    });
    return {
      memberCount: ids.length,
      staffCount: dto.attendeeUserIds.length,
      uniqueEmails: delivery.recipients.length,
      missingEmail: delivery.missingEmail,
    };
  }
  async groups(u: AuthUser) {
    return this.groupModel
      .find({
        ...(await this.scope.buildBranchFilter(u)),
        ...(!meetingAdmin(u)
          ? { $or: [{ submitterUserIds: u.sub }, { reviewerUserIds: u.sub }] }
          : {}),
      })
      .populate('branchId', 'name')
      .sort({ name: 1 })
      .lean();
  }
  async options(u: AuthUser, includeUsers = true) {
    const branchFilter = await this.scope.getBranchDocumentQuery(u);
    const branches = await this.branches
      .find(branchFilter)
      .select('_id name')
      .sort({ name: 1 })
      .lean();
    const branchIds = branches.map((b) => b._id);
    const [users, serviceUnits, groups] = await Promise.all([
      includeUsers
        ? this.users
            .find({
              isActive: true,
              $or: [{ branchId: { $in: branchIds } }, { _id: u.sub }],
            })
            .select('_id firstName lastName branchId')
            .sort({ firstName: 1 })
            .lean()
        : Promise.resolve([]),
      this.units
        .find({ branchId: { $in: branchIds }, isActive: true })
        .select('_id name branchId')
        .sort({ name: 1 })
        .lean(),
      this.groups(u),
    ]);
    return {
      branches,
      users,
      serviceUnits,
      groups,
      isAdmin: meetingAdmin(u),
      userId: u.sub,
    };
  }
  async saveGroup(u: AuthUser, dto: GroupDto, id?: string) {
    if (!meetingAdmin(u))
      throw new ForbiddenException(
        'Only leadership can configure meeting groups.',
      );
    const old = id ? await this.group(u, id) : null;
    const branchId = old
      ? String(old.branchId)
      : await this.scope.resolveScopedBranchId(u, dto.branchId);
    if (!branchId) throw new BadRequestException('Select a branch.');
    await this.scope.ensureBranchAccess(u, branchId);
    await this.validateUsers(
      [...dto.submitterUserIds, ...dto.reviewerUserIds],
      branchId,
      u,
    );
    if (dto.serviceUnitId) {
      const unit = await this.units.findById(dto.serviceUnitId).lean();
      if (!unit || String(unit.branchId) !== branchId)
        throw new BadRequestException(
          'Service group must belong to the meeting branch.',
        );
    }
    const data = {
      branchId,
      name: dto.name.trim(),
      serviceUnitId: dto.serviceUnitId
        ? new Types.ObjectId(dto.serviceUnitId)
        : null,
      enabled: dto.enabled,
      minutesRequired: dto.minutesRequired,
      minutesDueHours: dto.minutesDueHours,
      submitterUserIds: dto.submitterUserIds,
      reviewerUserIds: dto.reviewerUserIds,
    };
    if (data.name.length < 2)
      throw new BadRequestException('Group name is required.');
    if (!id) return this.groupModel.create(data);
    if (dto.expectedRevision === undefined)
      throw new BadRequestException('Group version is required.');
    const result = await this.groupModel.findOneAndUpdate(
      { _id: id, revision: dto.expectedRevision },
      { $set: data, $inc: { revision: 1 } },
      { new: true },
    );
    if (!result)
      throw new ConflictException('This group changed. Reload before saving.');
    return result;
  }
  private async generalGroup(u: AuthUser, branchRef?: string) {
    if (!meetingAdmin(u))
      throw new ForbiddenException(
        'Only leadership can schedule general church meetings.',
      );
    const branchId = await this.scope.resolveScopedBranchId(u, branchRef);
    if (!branchId) throw new BadRequestException('Select a church / branch.');
    await this.scope.ensureBranchAccess(u, branchId);
    const filter = { branchId, isGeneral: true };
    const data = {
      ...filter,
      name: 'Church meetings',
      enabled: true,
      minutesRequired: false,
      minutesDueHours: 72,
      submitterUserIds: [],
      reviewerUserIds: [],
      revision: 0,
    };
    try {
      const g = await this.groupModel.findOneAndUpdate(
        filter,
        { $setOnInsert: data },
        { upsert: true, new: true },
      );
      if (g) return g.toObject();
    } catch (e) {
      if ((e as { code?: number }).code !== 11000) throw e;
      const existing = await this.groupModel.findOne(filter).lean();
      if (existing) return existing;
    }
    throw new BadRequestException(
      'Could not set up church meetings. Please retry.',
    );
  }
  async create(u: AuthUser, dto: CreateMeetingDto) {
    const g = dto.groupId
      ? await this.group(u, dto.groupId)
      : await this.generalGroup(u, dto.branchId);
    if (!g.enabled)
      throw new BadRequestException('This meeting group is disabled.');
    if (!this.canWrite(u, g))
      throw new ForbiddenException(
        'Only the group submitters or leadership can schedule meetings.',
      );
    const times = validateMeetingTimes(dto.startsAt, dto.endsAt);
    validateFutureMeetingTimes(times.startsAt, times.endsAt);
    await this.validateUsers(dto.attendeeUserIds, String(g.branchId), u);
    const mode = dto.audienceMode || 'individuals';
    const attendeeMemberIds = await this.resolveAudience(
      String(g.branchId),
      mode,
      dto.audienceServiceUnitIds || [],
      dto.attendeeMemberIds || [],
    );
    if (dto.title.trim().length < 2)
      throw new BadRequestException('Meeting title is required.');
    return this.meetings.create({
      ...dto,
      ...times,
      groupId: g._id,
      attendeeMemberIds,
      additionalMemberIds: dto.attendeeMemberIds || [],
      audienceMode: mode,
      audienceServiceUnitIds:
        mode === 'service_groups' ? dto.audienceServiceUnitIds || [] : [],
      invitationsRequested: dto.sendInvitations ?? true,
      invitationsPrepared: false,
      title: dto.title.trim(),
      branchId: g.branchId,
      organizerUserId: u.sub,
      minutesRequired: g.minutesRequired,
      minutesDueAt: new Date(+times.endsAt + g.minutesDueHours * 3600000),
    });
  }
  async list(u: AuthUser, q: MeetingListDto): Promise<Record<string, unknown>> {
    const conditions: Record<string, unknown>[] = [
      await this.scope.buildBranchFilter(u, q.branchId),
    ];
    if (!meetingAdmin(u)) {
      const groups = await this.groupModel
        .find({
          ...(await this.scope.buildBranchFilter(u)),
          $or: [{ submitterUserIds: u.sub }, { reviewerUserIds: u.sub }],
        })
        .select('_id')
        .lean();
      conditions.push({
        $or: [
          { groupId: { $in: groups.map((g) => g._id) } },
          { organizerUserId: u.sub },
          { attendeeUserIds: u.sub },
        ],
      });
    }
    if (q.groupId) conditions.push({ groupId: this.id(q.groupId) });
    if (
      q.status &&
      ['scheduled', 'ongoing', 'completed', 'cancelled'].includes(q.status)
    )
      conditions.push({ status: q.status });
    if (q.q)
      conditions.push({
        title: {
          $regex: q.q.slice(0, 150).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          $options: 'i',
        },
      });
    if (q.minutes === 'overdue')
      conditions.push({
        minutesRequired: true,
        minutesStatus: { $nin: ['submitted', 'approved'] },
        status: { $ne: 'cancelled' },
        minutesDueAt: { $lt: new Date() },
      });
    else if (
      q.minutes &&
      ['draft', 'submitted', 'approved', 'changes_requested'].includes(
        q.minutes,
      )
    )
      conditions.push({ minutesStatus: q.minutes });
    if (q.from) {
      const date = new Date(q.from);
      if (!Number.isFinite(+date))
        throw new BadRequestException('Invalid start date');
      conditions.push({ startsAt: { $gte: date } });
    }
    if (q.to) {
      const date = new Date(q.to);
      if (!Number.isFinite(+date))
        throw new BadRequestException('Invalid end date');
      date.setUTCHours(23, 59, 59, 999);
      conditions.push({ startsAt: { $lte: date } });
    }
    if (q.upcoming === 'true')
      conditions.push({
        status: 'scheduled',
        startsAt: {
          $gte: new Date(),
          $lte: new Date(Date.now() + 24 * 3600000),
        },
      });
    if (q.actions === 'due')
      conditions.push({
        status: { $ne: 'cancelled' },
        actions: {
          $elemMatch: {
            ownerUserId: u.sub,
            status: 'open',
            dueAt: { $lte: new Date().toISOString() },
          },
        },
      });
    const filter = { $and: conditions };
    const page = Math.floor(
      Math.max(1, Math.min(1000000, Number(q.page) || 1)),
    );
    const limit = Math.floor(Math.max(1, Math.min(100, Number(q.limit) || 25)));
    const sort = q.sort === 'oldest' ? 1 : -1;
    const [items, total] = await Promise.all([
      this.meetings
        .find(filter)
        .select('-minutesHistory -minutesBody')
        .populate('groupId', 'name')
        .populate('branchId', 'name')
        .sort({ startsAt: sort, _id: sort })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.meetings.countDocuments(filter),
    ]);
    return {
      items: items.map((m) => ({ ...m, minutesOverdue: minutesOverdue(m) })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
  async details(u: AuthUser, id: string): Promise<Record<string, unknown>> {
    const { m, g } = await this.context(u, id);
    const files = await this.files
      .find({ meetingId: m._id, _id: { $in: m.attachmentIds || [] } })
      .select('-data')
      .sort({ createdAt: -1 })
      .lean();
    const [attendeeMembers, attendeeUsers] = await Promise.all([
      this.members
        .find({ _id: { $in: m.attendeeMemberIds || [] } })
        .select('_id firstName lastName')
        .lean(),
      this.users
        .find({
          _id: {
            $in: [
              ...m.attendeeUserIds,
              m.organizerUserId,
              ...g.submitterUserIds,
              ...g.reviewerUserIds,
            ],
          },
        })
        .select('_id firstName lastName')
        .lean(),
    ]);
    const invitationSummary = this.canWrite(u, g, m)
      ? await this.invitations.summary(m)
      : undefined;
    return {
      ...m,
      invitationSummary,
      attendeeMembers,
      attendeeUsers,
      group: g,
      files,
      canManage: this.canWrite(u, g, m),
      canReview: meetingAdmin(u) || g.reviewerUserIds.includes(u.sub),
      minutesOverdue: minutesOverdue(m),
    };
  }
  async update(
    u: AuthUser,
    id: string,
    dto: UpdateMeetingDto,
  ): Promise<Record<string, unknown>> {
    const { m, g } = await this.context(u, id);
    const manage = this.canWrite(u, g, m);
    const review = meetingAdmin(u) || g.reviewerUserIds.includes(u.sub);
    const op = dto.operation;
    if (
      ['approve', 'return'].includes(op) ? !review : op !== 'actions' && !manage
    )
      throw new ForbiddenException('You cannot make this change.');
    const data: Record<string, unknown> = {};
    let history: Record<string, unknown> | undefined;
    if (op === 'details') {
      for (const key of [
        'title',
        'agenda',
        'location',
        'joinUrl',
        'status',
      ] as const)
        if (dto[key] !== undefined) data[key] = dto[key];
      if (dto.title !== undefined) {
        if (dto.title.trim().length < 2)
          throw new BadRequestException(
            'Meeting title needs at least two characters.',
          );
        data.title = dto.title.trim();
      }
      const times = validateMeetingTimes(
        dto.startsAt || m.startsAt,
        dto.endsAt || m.endsAt,
      );
      validateFutureMeetingTimes(
        dto.startsAt !== undefined && +times.startsAt !== +m.startsAt
          ? times.startsAt
          : undefined,
        dto.endsAt !== undefined && +times.endsAt !== +m.endsAt
          ? times.endsAt
          : undefined,
      );
      Object.assign(data, times);
      if (+times.endsAt !== +m.endsAt)
        data.minutesDueAt = new Date(
          +times.endsAt + (+m.minutesDueAt - +m.endsAt),
        );
      if (dto.attendeeUserIds) {
        await this.validateUsers(dto.attendeeUserIds, String(m.branchId), u);
        if (
          m.actions.some(
            (a) =>
              !dto.attendeeUserIds!.includes(a.ownerUserId) &&
              a.ownerUserId !== m.organizerUserId,
          )
        )
          throw new BadRequestException(
            'Reassign action items before removing their owners.',
          );
        data.attendeeUserIds = dto.attendeeUserIds;
        data.presentUserIds = m.presentUserIds.filter((x) =>
          dto.attendeeUserIds!.includes(x),
        );
      }
      if (
        dto.attendeeMemberIds !== undefined ||
        dto.audienceMode !== undefined ||
        dto.audienceServiceUnitIds !== undefined
      ) {
        const mode = dto.audienceMode || m.audienceMode || 'individuals';
        const extras =
          dto.attendeeMemberIds ?? m.additionalMemberIds ?? m.attendeeMemberIds;
        const ids = await this.resolveAudience(
          String(m.branchId),
          mode,
          dto.audienceServiceUnitIds ?? m.audienceServiceUnitIds ?? [],
          extras,
        );
        data.attendeeMemberIds = ids;
        data.additionalMemberIds = extras;
        data.audienceMode = mode;
        data.audienceServiceUnitIds =
          mode === 'service_groups'
            ? (dto.audienceServiceUnitIds ?? m.audienceServiceUnitIds ?? [])
            : [];
        data.presentMemberIds = (m.presentMemberIds || []).filter((id) =>
          ids.includes(id),
        );
      }
      if (dto.sendInvitations !== undefined)
        data.invitationsRequested = dto.sendInvitations;
      data.invitationsPrepared = false;
    } else if (op === 'attendance') {
      if (
        !dto.presentUserIds ||
        dto.presentUserIds.some((x) => !m.attendeeUserIds.includes(x))
      )
        throw new BadRequestException(
          'Attendance must use the invited attendee list.',
        );
      if (
        dto.presentMemberIds &&
        dto.presentMemberIds.some(
          (x) => !(m.attendeeMemberIds || []).includes(x),
        )
      )
        throw new BadRequestException(
          'Attendance must use the selected member list.',
        );
      data.presentUserIds = dto.presentUserIds;
      data.presentMemberIds = dto.presentMemberIds || m.presentMemberIds || [];
    } else if (op === 'minutes') {
      if (['submitted', 'approved'].includes(m.minutesStatus))
        throw new BadRequestException(
          'Minutes under review or approved cannot be edited.',
        );
      data.minutesBody = dto.minutesBody ?? m.minutesBody;
      data.minutesLinks = dto.minutesLinks ?? m.minutesLinks;
      data.minutesStatus = 'draft';
      data.reviewComment = '';
    } else if (op === 'submit') {
      if (!['draft', 'changes_requested'].includes(m.minutesStatus))
        throw new BadRequestException(
          'Only draft or returned minutes can be submitted.',
        );
      if (m.status === 'cancelled')
        throw new BadRequestException(
          'Cancelled meetings cannot submit minutes.',
        );
      const body = dto.minutesBody ?? m.minutesBody;
      const links = dto.minutesLinks ?? m.minutesLinks;
      if (!body.trim() && !links.length && !(m.attachmentIds || []).length)
        throw new BadRequestException(
          'Write minutes, attach a document, or add a minutes link first.',
        );
      data.minutesBody = body;
      data.minutesLinks = links;
      data.minutesStatus = 'submitted';
      data.reviewComment = '';
    } else if (op === 'approve' || op === 'return') {
      if (m.minutesStatus !== 'submitted')
        throw new BadRequestException(
          'Only submitted minutes can be reviewed.',
        );
      if (op === 'return' && !dto.reviewComment?.trim())
        throw new BadRequestException('Explain which changes are required.');
      data.minutesStatus = op === 'approve' ? 'approved' : 'changes_requested';
      data.reviewComment = dto.reviewComment?.trim() || '';
    } else if (op === 'actions') {
      if (!dto.actions)
        throw new BadRequestException('Action items are required.');
      if (new Set(dto.actions.map((a) => a.id)).size !== dto.actions.length)
        throw new BadRequestException('Action IDs must be unique.');
      if (
        dto.actions.some(
          (a) =>
            !a.title.trim() ||
            ![...m.attendeeUserIds, m.organizerUserId].includes(a.ownerUserId),
        )
      )
        throw new BadRequestException(
          'Each action needs a title and an owner from the meeting attendees.',
        );
      if (!manage) {
        if (
          dto.actions.length !== m.actions.length ||
          dto.actions.some((a) => {
            const old = m.actions.find((x) => x.id === a.id);
            return (
              !old ||
              old.title !== a.title ||
              old.ownerUserId !== a.ownerUserId ||
              old.dueAt !== a.dueAt ||
              (old.status !== a.status && old.ownerUserId !== u.sub)
            );
          })
        )
          throw new ForbiddenException(
            'You can only complete or reopen your own actions.',
          );
      }
      data.actions = dto.actions;
    }
    if (['minutes', 'submit', 'approve', 'return'].includes(op))
      history = {
        revision: m.revision + 1,
        body: data.minutesBody ?? m.minutesBody,
        links: data.minutesLinks ?? m.minutesLinks,
        status: data.minutesStatus,
        comment: data.reviewComment,
        by: u.sub,
        at: new Date().toISOString(),
      };
    const result = await this.meetings.updateOne(
      { _id: m._id, revision: dto.expectedRevision },
      {
        $set: data,
        $inc: { revision: 1 },
        ...(history
          ? { $push: { minutesHistory: { $each: [history], $slice: -30 } } }
          : {}),
      },
    );
    if (!result.modifiedCount)
      throw new ConflictException(
        'This meeting changed. Reload before saving to avoid overwriting someone else.',
      );
    return this.details(u, id);
  }
  async upload(
    u: AuthUser,
    id: string,
    file: {
      originalname: string;
      mimetype: string;
      buffer: Buffer;
      size: number;
    },
  ): Promise<Record<string, unknown>> {
    const { m, g } = await this.context(u, id);
    if (!this.canWrite(u, g, m))
      throw new ForbiddenException(
        'Only the organiser or group submitters can attach minutes.',
      );
    if (['submitted', 'approved'].includes(m.minutesStatus))
      throw new BadRequestException(
        'Minutes under review or approved cannot be changed.',
      );
    const meta = validateDocument(file);
    if ((m.attachmentIds || []).length >= 10)
      throw new BadRequestException('A meeting can have up to 10 documents.');
    const created = await this.files.create({
      ...meta,
      meetingId: m._id,
      data: file.buffer,
      size: file.size,
      uploadedBy: u.sub,
    });
    try {
      const result = await this.meetings.updateOne(
        { _id: m._id, revision: m.revision },
        {
          $inc: { revision: 1 },
          $push: { attachmentIds: String(created._id) },
        },
      );
      if (!result.modifiedCount)
        throw new ConflictException(
          'Meeting changed during upload. Please retry.',
        );
    } catch (e) {
      await this.files.deleteOne({ _id: created._id });
      throw e;
    }
    return this.details(u, id);
  }
  async alertItems(u: AuthUser): Promise<
    {
      key: string;
      label: string;
      description: string;
      count: number;
      tone: 'warm' | 'critical' | 'cool';
      href: string;
    }[]
  > {
    const specs: {
      key: string;
      label: string;
      description: string;
      tone: 'critical' | 'warm' | 'cool';
      query: Record<string, string>;
    }[] = [
      {
        key: 'meeting_minutes_overdue',
        label: 'Meeting minutes overdue',
        description: 'Required minutes are past their submission deadline.',
        tone: 'critical' as const,
        query: { minutes: 'overdue' },
      },
      {
        key: 'meeting_minutes_review',
        label: 'Meeting minutes awaiting review',
        description: 'Submitted minutes are ready for a reviewer.',
        tone: 'warm' as const,
        query: { minutes: 'submitted' },
      },
      {
        key: 'meeting_actions_due',
        label: 'Your meeting actions are overdue',
        description: 'Complete your assigned meeting actions.',
        tone: 'critical' as const,
        query: { actions: 'due' },
      },
      {
        key: 'meeting_upcoming',
        label: 'Meetings in the next 24 hours',
        description: 'Check the agenda and meeting link before the meeting.',
        tone: 'cool' as const,
        query: { upcoming: 'true' },
      },
    ];
    const results = await Promise.all(
      specs.map(async (spec) => ({
        ...spec,
        count: Number(
          (await this.list(u, { ...spec.query, limit: '1' } as MeetingListDto))
            .total,
        ),
        href: `/meetings?${new URLSearchParams(spec.query)}`,
      })),
    );
    return results
      .filter((x) => x.count > 0)
      .map((item) => ({
        key: item.key,
        label: item.label,
        description: item.description,
        tone: item.tone,
        count: item.count,
        href: item.href,
      }));
  }
  async retryInvitations(u: AuthUser, id: string) {
    const { m, g } = await this.context(u, id);
    if (!this.canWrite(u, g, m))
      throw new ForbiddenException('You cannot send meeting invitations.');
    if (!m.invitationsRequested || m.status === 'cancelled')
      throw new BadRequestException(
        'Enable invitations on an active meeting first.',
      );
    await this.invitations.retryFailed(id);
    return this.details(u, id);
  }
  async removeFile(
    u: AuthUser,
    id: string,
    fileId: string,
    expectedRevision: number,
  ) {
    const { m, g } = await this.context(u, id);
    if (!this.canWrite(u, g, m))
      throw new ForbiddenException(
        'Only organisers and submitters can remove documents.',
      );
    if (['submitted', 'approved'].includes(m.minutesStatus))
      throw new BadRequestException(
        'Minutes under review or approved cannot be changed.',
      );
    if (!(m.attachmentIds || []).includes(fileId))
      throw new NotFoundException('Document not found');
    const result = await this.meetings.updateOne(
      { _id: m._id, revision: expectedRevision },
      { $pull: { attachmentIds: fileId }, $inc: { revision: 1 } },
    );
    if (!result.modifiedCount)
      throw new ConflictException(
        'This meeting changed. Reload before removing documents.',
      );
    await this.files.deleteOne({ _id: fileId, meetingId: m._id });
    return this.details(u, id);
  }
  async download(u: AuthUser, id: string, fileId: string) {
    const { m } = await this.context(u, id);
    if (!(m.attachmentIds || []).includes(fileId))
      throw new NotFoundException('Document not found');
    const file = await this.files
      .findOne({ _id: this.id(fileId), meetingId: id })
      .select('+data');
    if (!file) throw new NotFoundException('Document not found');
    return { name: file.name, mime: file.mime, data: Buffer.from(file.data) };
  }
}
