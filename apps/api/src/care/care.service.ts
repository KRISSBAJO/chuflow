import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { careEventFilters, type CareEventFilters } from './event-filters';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { AccessScopeService } from '../access-scope/access-scope.service';
import {
  BRANCH_LEADERSHIP_ROLES,
  LEADERSHIP_ROLES,
} from '../common/constants/roles.constants';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Guest, GuestDocument } from '../guests/schemas/guest.schema';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import {
  OutreachContact,
  OutreachContactDocument,
} from '../evangelism/evangelism.schema';
import {
  ServiceUnit,
  ServiceUnitDocument,
} from '../service-units/schemas/service-unit.schema';
import {
  CareCase,
  CareCaseDocument,
  CareTask,
  CareTaskDocument,
  CareEvent,
  CareEventDocument,
  CarePlan,
  CarePlanDocument,
  CareJob,
  CareJobDocument,
  CareToken,
  CareTokenDocument,
} from './care.schema';
import { CARE_ROLES, careAllowed } from './care.policy';
import {
  CareChangeDto,
  CareListDto,
  CarePlanDto,
  CarePublicDto,
} from './care.dto';
export const careAdmin = (u: AuthUser) => LEADERSHIP_ROLES.includes(u.role);
type CaseRecord = CareCase & { _id: Types.ObjectId };
type Intent = {
  key: string;
  kind: string;
  text: string;
  visibility: string;
  actorId?: string;
  data?: Record<string, unknown>;
  at?: string;
};
@Injectable()
export class CareService {
  constructor(
    @InjectModel(CareCase.name) readonly cases: Model<CareCaseDocument>,
    @InjectModel(CareTask.name) readonly tasks: Model<CareTaskDocument>,
    @InjectModel(CareEvent.name) readonly events: Model<CareEventDocument>,
    @InjectModel(CarePlan.name) readonly plans: Model<CarePlanDocument>,
    @InjectModel(CareJob.name) readonly jobs: Model<CareJobDocument>,
    @InjectModel(CareToken.name) readonly tokens: Model<CareTokenDocument>,
    @InjectModel(User.name) readonly users: Model<UserDocument>,
    @InjectModel(Guest.name) readonly guests: Model<GuestDocument>,
    @InjectModel(Member.name) readonly members: Model<MemberDocument>,
    @InjectModel(Branch.name) readonly branches: Model<BranchDocument>,
    @InjectModel(OutreachContact.name)
    readonly outreach: Model<OutreachContactDocument>,
    @InjectModel(ServiceUnit.name) readonly units: Model<ServiceUnitDocument>,
    readonly scope: AccessScopeService,
    private readonly config: ConfigService,
  ) {}
  id(value: string) {
    if (!Types.ObjectId.isValid(value))
      throw new BadRequestException('Invalid record ID.');
    return value;
  }
  private async filter(u: AuthUser, branchId?: string) {
    if (branchId) this.id(branchId);
    const filter = await this.scope.buildBranchFilter(u, branchId);
    return {
      ...filter,
      mergedInto: { $exists: false },
      ...(!careAdmin(u)
        ? {
            $or: [
              { ownerId: u.sub },
              { backupId: u.sub },
              { 'handover.to': u.sub, 'handover.status': 'pending' },
              {
                _id: {
                  $in: await this.tasks
                    .find({ assignedTo: u.sub, status: 'open' })
                    .distinct('caseId'),
                },
              },
            ],
          }
        : {}),
    };
  }
  async context(u: AuthUser, id: string, write = false): Promise<CaseRecord> {
    const c = await this.cases.findById(this.id(id)).lean();
    if (!c || c.mergedInto)
      throw new NotFoundException('Care record not found.');
    await this.scope.ensureBranchAccess(u, String(c.branchId));
    if (
      !careAdmin(u) &&
      !(
        !write &&
        (await this.tasks.exists({
          caseId: c._id,
          assignedTo: u.sub,
          status: 'open',
        }))
      ) &&
      ![
        String(c.ownerId || ''),
        String(c.backupId || ''),
        ...(write
          ? []
          : c.handover?.status === 'pending'
            ? [c.handover.to]
            : []),
      ].includes(u.sub)
    )
      throw new ForbiddenException('This care record is not assigned to you.');
    return c;
  }
  async validateUser(id: string, branchId: string) {
    const user = await this.users
      .findOne({
        _id: this.id(id),
        branchId,
        isActive: true,
        role: { $in: CARE_ROLES },
      })
      .select('_id firstName lastName email')
      .lean();
    if (!user)
      throw new BadRequestException(
        'Choose an active care worker from the same branch.',
      );
    return user;
  }
  async options(u: AuthUser) {
    return {
      branches: await this.branches
        .find(await this.scope.getBranchDocumentQuery(u))
        .select('_id name')
        .sort({ name: 1 })
        .lean(),
      isAdmin: careAdmin(u),
      userId: u.sub,
    };
  }
  async assignees(u: AuthUser, branchId: string, q = '', leadersOnly = false) {
    this.id(branchId);
    await this.scope.ensureBranchAccess(u, branchId);
    if (typeof q !== 'string' || q.trim().length < 2) return [];
    const search = q
      .trim()
      .slice(0, 80)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.users
      .find({
        branchId,
        isActive: true,
        role: { $in: leadersOnly ? BRANCH_LEADERSHIP_ROLES : CARE_ROLES },
        $or: [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ],
      })
      .select('_id firstName lastName email')
      .limit(8)
      .lean();
  }
  async getPlan(
    u: AuthUser,
    branchId: string,
  ): Promise<Record<string, unknown>> {
    if (!careAdmin(u)) throw new ForbiddenException();
    this.id(branchId);
    await this.scope.ensureBranchAccess(u, branchId);
    const p = await this.plans
      .findOneAndUpdate(
        { branchId },
        { $setOnInsert: { branchId } },
        { upsert: true, new: true },
      )
      .lean();
    const people = await this.users
      .find({
        _id: {
          $in: [...(p?.teamIds || []), String(p?.leaderId || '')].filter(
            (value) => Types.ObjectId.isValid(value),
          ),
        },
        branchId,
      })
      .select('_id firstName lastName')
      .lean();
    return {
      ...p,
      people,
      capabilities: {
        emailConfigured:
          !!this.config.get<string>('mailHost') &&
          !!this.config.get<number>('mailPort'),
        publicOrigin: this.baseUrl(),
      },
    };
  }
  async savePlan(u: AuthUser, branchId: string, dto: CarePlanDto) {
    await this.getPlan(u, branchId);
    const old = await this.plans.findOne({ branchId }).lean();
    if (!old) throw new NotFoundException();
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: dto.timeZone }).format(
        new Date(),
      );
    } catch {
      throw new BadRequestException(
        'Choose a valid timezone, such as America/Chicago.',
      );
    }
    if (
      dto.attendanceReliable &&
      (!dto.coverageFrom || +new Date(dto.coverageFrom) > Date.now())
    )
      throw new BadRequestException(
        'Confirm when reliable individual attendance recording began.',
      );
    for (const id of [...dto.teamIds, ...(dto.leaderId ? [dto.leaderId] : [])])
      await this.validateUser(id, branchId);
    if (
      dto.leaderId &&
      !(await this.users.exists({
        _id: dto.leaderId,
        branchId,
        isActive: true,
        role: { $in: BRANCH_LEADERSHIP_ROLES },
      }))
    )
      throw new BadRequestException(
        'Choose a branch administrator or pastor as the escalation leader.',
      );
    const unavailable = dto.unavailableUntil || {};
    for (const [id, at] of Object.entries(unavailable))
      if (
        !dto.teamIds.includes(id) ||
        typeof at !== 'string' ||
        !Number.isFinite(+new Date(at))
      )
        throw new BadRequestException(
          'Worker availability must use selected team members and valid dates.',
        );
    const { expectedRevision, ...fields } = dto;
    const result = await this.plans.findOneAndUpdate(
      { _id: old._id, revision: expectedRevision },
      {
        $set: {
          ...fields,
          branchId,
          leaderId: dto.leaderId ? new Types.ObjectId(dto.leaderId) : null,
          coverageFrom: dto.coverageFrom ? new Date(dto.coverageFrom) : null,
          ...(!old.enabled && dto.enabled ? { enabledAt: new Date() } : {}),
        },
        $inc: { revision: 1 },
      },
      { new: true },
    );
    if (!result)
      throw new ConflictException('Settings changed. Reload before saving.');
    if (!dto.enabled || !dto.emailEnabled)
      await this.jobs.updateMany(
        { branchId, status: 'queued', kind: 'care_email' },
        {
          $set: { status: 'cancelled', result: 'Automation settings changed.' },
        },
      );
    await this.jobs.create({
      key: 'plan-change:' + randomUUID(),
      branchId,
      kind: 'plan_change',
      status: 'logged',
      dueAt: new Date(),
      result: 'Care plan settings saved.',
      data: {
        actorId: u.sub,
        enabled: dto.enabled,
        emailEnabled: dto.emailEnabled,
        teamCount: dto.teamIds.length,
        attendanceReliable: dto.attendanceReliable,
      },
    });
    return this.getPlan(u, branchId);
  }
  async list(u: AuthUser, q: CareListDto): Promise<Record<string, unknown>> {
    const filter: Record<string, unknown> = await this.filter(u, q.branchId);
    const now = new Date();
    if (q.q) {
      const search = q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$and = [
        {
          $or: [
            { firstName: { $regex: search, $options: 'i' } },
            { lastName: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
          ],
        },
      ];
    }
    if (q.view === 'unassigned') filter.ownerId = { $exists: false };
    if (q.view !== 'all' && q.view !== undefined) {
      filter.stage = { $nin: ['closed', 'paused'] };
      filter.stopContact = false;
    }
    if (q.view === 'mine') filter.ownerId = u.sub;
    const taskFilter: Record<string, unknown> = {
      ...(await this.scope.buildBranchFilter(u, q.branchId)),
      status: 'open',
    };
    if (q.view === 'today') {
      const end = new Date(Date.now() + 24 * 3600000);
      taskFilter.dueAt = { $lte: end };
    }
    if (q.view === 'overdue') taskFilter.dueAt = { $lt: now };
    if (q.view === 'escalated') taskFilter.escalated = true;
    if (q.view === 'retention') taskFilter.kind = 'absence_check';
    if (['today', 'overdue', 'escalated', 'retention'].includes(q.view || ''))
      filter._id = {
        $in: await this.tasks.find(taskFilter).distinct('caseId'),
      };
    const limit = Math.max(1, Math.min(100, Number(q.limit) || 20));
    const page = Math.max(1, Math.min(100000, Number(q.page) || 1));
    const [items, total] = await Promise.all([
      this.cases
        .find(filter)
        .select('-pendingEvents')
        .populate('ownerId', 'firstName lastName')
        .populate('branchId', 'name')
        .sort({ updatedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.cases.countDocuments(filter),
    ]);
    const tasks = await this.tasks
      .find({ caseId: { $in: items.map((x) => x._id) }, status: 'open' })
      .select('caseId title dueAt escalated kind')
      .sort({ dueAt: 1 })
      .lean();
    return {
      items: items.map((c) => ({
        ...c,
        nextTask: tasks.find((t) => String(t.caseId) === String(c._id)),
        openTasks: tasks.filter((t) => String(t.caseId) === String(c._id))
          .length,
      })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }
  async alertSummary(u: AuthUser) {
    const branch = await this.scope.buildBranchFilter(u);
    const rows = await this.tasks.aggregate<{
      _id: null;
      pending: number;
      overdue: number;
    }>([
      { $match: { ...branch, status: 'open' } },
      {
        $lookup: {
          from: 'carecases',
          localField: 'caseId',
          foreignField: '_id',
          as: 'person',
        },
      },
      { $unwind: '$person' },
      {
        $match: {
          'person.mergedInto': { $exists: false },
          'person.stopContact': false,
          'person.stage': { $nin: ['closed', 'paused'] },
          ...(!careAdmin(u)
            ? {
                $or: [
                  { assignedTo: new Types.ObjectId(u.sub) },
                  { 'person.ownerId': new Types.ObjectId(u.sub) },
                  { 'person.backupId': new Types.ObjectId(u.sub) },
                ],
              }
            : {}),
        },
      },
      {
        $group: {
          _id: null,
          pending: { $sum: 1 },
          overdue: { $sum: { $cond: [{ $lt: ['$dueAt', new Date()] }, 1, 0] } },
        },
      },
    ]);
    const [cases, unassigned] = await Promise.all([
      this.cases.countDocuments(await this.filter(u)),
      careAdmin(u)
        ? this.cases.countDocuments({
            ...branch,
            mergedInto: { $exists: false },
            ownerId: { $exists: false },
            stage: { $nin: ['closed', 'paused'] },
            stopContact: false,
          })
        : Promise.resolve(0),
    ]);
    return {
      cases,
      pending: rows[0]?.pending || 0,
      overdue: rows[0]?.overdue || 0,
      unassigned,
    };
  }
  async overview(
    u: AuthUser,
    branchId?: string,
  ): Promise<Record<string, unknown>> {
    const filter = await this.filter(u, branchId);
    const ids = await this.cases.find(filter).distinct('_id');
    const activeIds = await this.cases
      .find({
        ...filter,
        stage: { $nin: ['closed', 'paused'] },
        stopContact: false,
      })
      .distinct('_id');
    const taskFilter = { caseId: { $in: activeIds }, status: 'open' };
    const since = new Date(Date.now() - 30 * 86400000);
    const [
      total,
      unassigned,
      overdue,
      escalated,
      retention,
      cohort,
      connected,
      contacts,
      stages,
      plans,
    ] = await Promise.all([
      this.cases.countDocuments(filter),
      this.cases.countDocuments({
        ...filter,
        ownerId: { $exists: false },
        stage: { $nin: ['closed', 'paused'] },
      }),
      this.tasks.countDocuments({ ...taskFilter, dueAt: { $lt: new Date() } }),
      this.tasks.countDocuments({ ...taskFilter, escalated: true }),
      this.tasks.countDocuments({ ...taskFilter, kind: 'absence_check' }),
      this.cases
        .find({
          ...filter,
          guestId: { $exists: true },
          sourceCreatedAt: { $gte: since },
        })
        .select('sourceCreatedAt firstContactAt lastReturnAt memberId')
        .lean(),
      this.cases.countDocuments({ ...filter, connectedAt: { $gte: since } }),
      this.events.countDocuments({
        caseId: { $in: ids },
        kind: 'contact',
        createdAt: { $gte: since },
      }),
      this.cases.aggregate([
        { $match: { _id: { $in: ids } } },
        { $group: { _id: '$stage', count: { $sum: 1 } } },
      ]),
      this.plans
        .find(await this.scope.buildBranchFilter(u, branchId))
        .select('branchId enabled attendanceReliable')
        .lean(),
    ]);
    const cohorts = await this.cases.aggregate([
      {
        $match: {
          _id: { $in: ids },
          sourceCreatedAt: { $gte: new Date(Date.now() - 90 * 86400000) },
          guestId: { $exists: true },
        },
      },
      {
        $project: {
          week: {
            $dateToString: { date: '$sourceCreatedAt', format: '%G-W%V' },
          },
          contact24h: {
            $cond: [
              {
                $and: [
                  { $ne: [{ $ifNull: ['$firstContactAt', null] }, null] },
                  { $gte: ['$firstContactAt', '$sourceCreatedAt'] },
                  {
                    $lte: [
                      { $subtract: ['$firstContactAt', '$sourceCreatedAt'] },
                      24 * 3600000,
                    ],
                  },
                ],
              },
              1,
              0,
            ],
          },
          returned30: {
            $cond: [
              {
                $and: [
                  { $ne: [{ $ifNull: ['$firstReturnAt', null] }, null] },
                  { $gte: ['$firstReturnAt', '$sourceCreatedAt'] },
                  {
                    $lte: [
                      { $subtract: ['$firstReturnAt', '$sourceCreatedAt'] },
                      30 * 86400000,
                    ],
                  },
                ],
              },
              1,
              0,
            ],
          },
          member: {
            $cond: [{ $ne: [{ $ifNull: ['$memberId', null] }, null] }, 1, 0],
          },
        },
      },
      {
        $group: {
          _id: '$week',
          guests: { $sum: 1 },
          contacted24h: { $sum: '$contact24h' },
          returned30: { $sum: '$returned30' },
          members: { $sum: '$member' },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 14 },
    ]);
    return {
      cohorts,
      total,
      unassigned,
      overdue,
      escalated,
      retention,
      connected,
      contacts,
      stages,
      plans,
      cohort: {
        guests: cohort.length,
        contacted24h: cohort.filter(
          (c) =>
            c.firstContactAt &&
            c.sourceCreatedAt &&
            +c.firstContactAt - +c.sourceCreatedAt <= 24 * 3600000 &&
            +c.firstContactAt >= +c.sourceCreatedAt,
        ).length,
        returned: cohort.filter(
          (c) =>
            c.lastReturnAt &&
            c.sourceCreatedAt &&
            +c.lastReturnAt >= +c.sourceCreatedAt,
        ).length,
        becameMembers: cohort.filter((c) => c.memberId).length,
      },
      briefing: [
        `${overdue} care tasks are overdue.`,
        `${unassigned} people have no care owner.`,
        `${retention} attendance gaps need a human check-in.`,
        `${connected} connections were confirmed in the last 30 days.`,
      ],
    };
  }
  async flush(c: CaseRecord) {
    for (const raw of c.pendingEvents || []) {
      const intent = raw as unknown as Intent;
      const effects = (intent.data?.effects || {}) as Record<string, unknown>;
      if (effects.reassignTasks) {
        const assignment = effects.reassignTasks as {
          from: string;
          to: string;
        };
        await this.tasks.updateMany(
          {
            caseId: c._id,
            status: 'open',
            ...(assignment.from
              ? { assignedTo: assignment.from }
              : { assignedTo: { $exists: false } }),
          },
          { $set: { assignedTo: new Types.ObjectId(assignment.to) } },
        );
      }
      if (effects.cancelWelcomeTasks)
        await this.tasks.updateMany(
          {
            caseId: c._id,
            status: 'open',
            kind: { $in: ['first_contact', 'callback'] },
          },
          { $set: { status: 'cancelled' } },
        );
      if (effects.cancelTasks)
        await this.tasks.updateMany(
          { caseId: c._id, status: 'open' },
          { $set: { status: 'cancelled' } },
        );
      if (effects.completeTask)
        await this.tasks.updateOne(
          { _id: effects.completeTask, caseId: c._id, status: 'open' },
          {
            $set: {
              status: 'done',
              completedAt: new Date(intent.at || Date.now()),
              outcome: intent.data?.outcome || 'resolved',
            },
          },
        );
      if (effects.newTask) {
        const task = effects.newTask as Record<string, unknown>;
        await this.tasks.updateOne(
          { caseId: c._id, key: task.key },
          { $setOnInsert: { ...task, caseId: c._id, branchId: c.branchId } },
          { upsert: true },
        );
      }
      if (effects.cancelEmails)
        await this.jobs.updateMany(
          { caseId: c._id, kind: 'care_email', status: 'queued' },
          {
            $set: {
              status: 'cancelled',
              result: 'Care preferences or progress changed.',
            },
          },
        );
      const data = { ...(intent.data || {}) };
      delete data.effects;
      await this.events.updateOne(
        { key: intent.key },
        {
          $setOnInsert: {
            caseId: c._id,
            branchId: c.branchId,
            key: intent.key,
            kind: intent.kind,
            text: intent.text,
            visibility: intent.visibility,
            actorId: intent.actorId
              ? new Types.ObjectId(intent.actorId)
              : undefined,
            data,
            createdAt: new Date(intent.at || Date.now()),
          },
        },
        { upsert: true },
      );
      await this.cases.updateOne(
        { _id: c._id },
        { $pull: { pendingEvents: { key: intent.key } } },
      );
    }
  }
  async details(
    u: AuthUser,
    id: string,
    page = '1',
    filters: CareEventFilters = {},
  ): Promise<Record<string, unknown>> {
    let c = await this.context(u, id);
    await this.flush(c);
    c = await this.context(u, id);
    const currentPage = Math.max(1, Math.min(100000, Number(page) || 1));
    const eventFilter = {
      ...careEventFilters(filters),
      caseId: c._id,
      ...(!careAdmin(u) ? { visibility: 'team' } : {}),
    };
    const [events, eventTotal, tasks, people, units, jobs] = await Promise.all([
      this.events
        .find(eventFilter)
        .populate('actorId', 'firstName lastName')
        .sort({ createdAt: -1, _id: -1 })
        .skip((currentPage - 1) * 20)
        .limit(20)
        .lean(),
      this.events.countDocuments(eventFilter),
      this.tasks
        .find({ caseId: c._id, status: 'open' })
        .sort({ dueAt: 1 })
        .limit(100)
        .lean(),
      this.users
        .find({
          _id: {
            $in: [c.ownerId, c.backupId, c.handover?.to].filter(
              (x) => x && Types.ObjectId.isValid(String(x)),
            ),
          },
        })
        .select('_id firstName lastName')
        .lean(),
      this.units
        .find({ branchId: c.branchId, isActive: true })
        .select('_id name leaderMemberId')
        .lean(),
      this.jobs
        .find({ caseId: c._id })
        .select('kind status dueAt result')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);
    const record = { ...c } as Partial<CaseRecord>;
    delete record.pendingEvents;
    return {
      ...record,
      events,
      eventTotal,
      eventPage: currentPage,
      tasks,
      people,
      units,
      jobs,
      isAdmin: careAdmin(u),
      canManage:
        careAdmin(u) ||
        [String(c.ownerId || ''), String(c.backupId || '')].includes(u.sub),
      canAccept: c.handover?.to === u.sub && c.handover.status === 'pending',
      summary: `${c.firstName} ${c.lastName} is in ${c.journey.replaceAll('_', ' ')} (${c.stage}). ${tasks.filter((t) => t.status === 'open').length} open tasks. ${c.lastContactAt ? 'Last recorded contact: ' + c.lastContactAt.toISOString() + '.' : 'No contact has been recorded in the care hub.'} ${c.lastAttendanceAt ? 'Last individual attendance: ' + c.lastAttendanceAt.toISOString() + '.' : 'No individual attendance observation is linked.'}`,
    };
  }
  async change(
    u: AuthUser,
    id: string,
    dto: CareChangeDto,
  ): Promise<Record<string, unknown>> {
    const c = await this.context(
      u,
      id,
      !['accept', 'decline', 'complete'].includes(dto.operation),
    );
    if (
      dto.operation === 'complete' &&
      !careAdmin(u) &&
      ![String(c.ownerId || ''), String(c.backupId || '')].includes(u.sub) &&
      !(await this.tasks.exists({
        _id: dto.taskId,
        caseId: c._id,
        assignedTo: u.sub,
        status: 'open',
      }))
    )
      throw new ForbiddenException(
        'You can complete only your assigned tasks.',
      );
    if (dto.operation === 'accept' || dto.operation === 'decline') {
      if (c.handover?.to !== u.sub || c.handover.status !== 'pending')
        throw new ForbiddenException('There is no handover for you to accept.');
      await this.validateUser(u.sub, String(c.branchId));
    }
    if (
      c.stopContact &&
      ['contact', 'task', 'enroll', 'resume'].includes(dto.operation)
    )
      throw new BadRequestException(
        'Contact is stopped. Record renewed permission before taking contact actions.',
      );
    if (dto.operation === 'retry_messages') {
      if (!careAdmin(u) && String(c.ownerId || '') !== u.sub)
        throw new ForbiddenException();
      await this.jobs.updateMany(
        { caseId: c._id, kind: 'care_email', status: 'failed' },
        { $set: { status: 'queued', result: 'Retry requested.' } },
      );
      return this.details(u, id);
    }
    if (dto.visibility === 'pastoral' && !careAdmin(u))
      throw new ForbiddenException(
        'Only leadership can add restricted pastoral notes.',
      );
    const set: Record<string, unknown> = {};
    const unset: Record<string, string> = {};
    const data: Record<string, unknown> = {};
    const effects: Record<string, unknown> = {};
    let text = dto.note?.trim() || '';
    const kind = dto.operation;
    const eventKey = randomUUID();
    const now = new Date();
    if (['note', 'contact', 'handover'].includes(dto.operation) && !text)
      throw new BadRequestException('Add a note describing the action.');
    if (dto.operation === 'assign') {
      if (dto.userId) await this.validateUser(dto.userId, String(c.branchId));
      if (dto.backupId)
        await this.validateUser(dto.backupId, String(c.branchId));
      if (!careAdmin(u) && dto.userId !== u.sub)
        throw new ForbiddenException('Only leadership can reassign ownership.');
      if (dto.userId) {
        set.ownerId = new Types.ObjectId(dto.userId);
        effects.reassignTasks = {
          from: String(c.ownerId || ''),
          to: dto.userId,
        };
      } else unset.ownerId = '';
      if (dto.backupId) set.backupId = new Types.ObjectId(dto.backupId);
      else unset.backupId = '';
      text = 'Care ownership updated.';
    }
    if (dto.operation === 'preferences') {
      if (
        ((dto.emailAllowed === true && !c.emailAllowed) ||
          (dto.stopContact === false && c.stopContact)) &&
        !dto.note?.trim()
      )
        throw new BadRequestException(
          'Record how and when contact permission was given.',
        );
      if (dto.emailAllowed === true && c.stopContact && !careAdmin(u))
        throw new ForbiddenException(
          'Leadership must record renewed permission after an opt-out.',
        );
      if (dto.emailAllowed !== undefined) {
        set.emailAllowed = dto.emailAllowed;
        set.permissionRecordedAt = now;
        set.permissionRecordedBy = u.sub;
      }
      if (dto.language) set.language = dto.language;
      if (dto.stopContact !== undefined) {
        if (!dto.stopContact && c.stopContact && !careAdmin(u))
          throw new ForbiddenException(
            'Leadership must record renewed permission.',
          );
        set.stopContact = dto.stopContact;
      }
      if (dto.stopContact || dto.emailAllowed === false)
        effects.cancelEmails = true;
      if (dto.stopContact) {
        effects.cancelTasks = true;
        set.stage = 'closed';
      }
      text = text || 'Contact preferences updated.';
    }
    if (dto.operation === 'pause') {
      if (
        !dto.until ||
        +new Date(dto.until) <= Date.now() ||
        +new Date(dto.until) > Date.now() + 180 * 86400000
      )
        throw new BadRequestException(
          'Choose a pause end within the next 180 days.',
        );
      set.stage = 'paused';
      set.pausedUntil = new Date(dto.until);
      set.absenceExplanation = text || 'Temporarily unavailable';
      effects.cancelEmails = true;
      text = text || 'Care paused until ' + dto.until;
    }
    if (dto.operation === 'resume') {
      if (c.stopContact)
        throw new BadRequestException('Renew contact permission first.');
      set.stage = 'connecting';
      unset.pausedUntil = '';
      set.absenceExplanation = '';
      text = 'Care resumed.';
    }
    if (dto.operation === 'journey') {
      if (!dto.stage) throw new BadRequestException('Choose a stage.');
      if (c.stopContact && dto.stage !== 'closed')
        throw new BadRequestException('Renew contact permission first.');
      set.stage = dto.stage;
      if (dto.stage === 'connected') {
        set.connectedAt = now;
        effects.cancelWelcomeTasks = true;
        effects.cancelEmails = true;
      }
      if (dto.stage === 'closed') {
        effects.cancelTasks = true;
        effects.cancelEmails = true;
      }
      text = text || 'Journey moved to ' + dto.stage + '.';
    }
    if (dto.operation === 'handover') {
      if (!dto.userId || dto.userId === String(c.ownerId))
        throw new BadRequestException('Choose a different receiving worker.');
      await this.validateUser(dto.userId, String(c.branchId));
      set.handover = {
        to: dto.userId,
        from: u.sub,
        requestedAt: now.toISOString(),
        status: 'pending',
      };
      data.to = dto.userId;
    }
    if (dto.operation === 'accept') {
      effects.reassignTasks = { from: String(c.ownerId || ''), to: u.sub };
      set.ownerId = new Types.ObjectId(u.sub);
      set.handover = { ...c.handover, status: 'accepted' };
      text = 'Handover accepted; responsibility transferred.';
    }
    if (dto.operation === 'decline') {
      set.handover = { ...c.handover, status: 'declined' };
      text =
        text || 'Handover declined; previous owner retains responsibility.';
    }
    if (dto.operation === 'enroll') {
      const plan = await this.plans.findOne({ branchId: c.branchId }).lean();
      if (!plan?.enabled)
        throw new BadRequestException(
          'Enable this branch’s care plan in automation settings first.',
        );
      if (c.automationEnrolledAt)
        throw new BadRequestException(
          'This person is already enrolled. Add a next task or resume care instead.',
        );
      if (!careAllowed(c))
        throw new BadRequestException(
          'Resume care and confirm permission before enrolling.',
        );
      unset.automationEnrolledAt = '';
      data.enroll = true;
      text = 'Care plan enrollment requested.';
      set.enrollmentRequestedAt = now;
    }
    if (dto.operation === 'task') {
      if (!dto.title?.trim() || !dto.nextActionAt)
        throw new BadRequestException('A task needs a title and due date.');
      if (dto.userId) await this.validateUser(dto.userId, String(c.branchId));
      if (dto.serviceUnitId) {
        const unit = await this.units
          .findOne({
            _id: dto.serviceUnitId,
            branchId: c.branchId,
            isActive: true,
          })
          .lean();
        if (!unit)
          throw new BadRequestException(
            'Choose an active group from this branch.',
          );
      }
      effects.newTask = {
        key: 'manual:' + eventKey,
        title: dto.title.trim(),
        kind: dto.serviceUnitId ? 'group_introduction' : 'care_action',
        dueAt: new Date(dto.nextActionAt),
        assignedTo: dto.userId ? new Types.ObjectId(dto.userId) : c.ownerId,
        serviceUnitId: dto.serviceUnitId
          ? new Types.ObjectId(dto.serviceUnitId)
          : undefined,
      };
      text = text || 'Next step: ' + dto.title;
    }
    if (dto.operation === 'contact' || dto.operation === 'complete') {
      const task = dto.taskId
        ? await this.tasks
            .findOne({ _id: dto.taskId, caseId: c._id, status: 'open' })
            .lean()
        : null;
      if (dto.taskId && !task)
        throw new BadRequestException('Task is no longer open.');
      if (!dto.outcome) throw new BadRequestException('Record an outcome.');
      data.outcome = dto.outcome;
      data.method = dto.method || 'administrative';
      if (task) effects.completeTask = String(task._id);
      const plan = await this.plans.findOne({ branchId: c.branchId }).lean();
      const attempts =
        Math.max(task?.attempts || 0, c.unansweredAttempts || 0) + 1;
      if (dto.outcome === 'no_answer') set.unansweredAttempts = attempts;
      else set.unansweredAttempts = 0;
      if (
        [
          'contacted',
          'callback_requested',
          'needs_help',
          'connected',
          'resolved',
        ].includes(dto.outcome)
      ) {
        set.lastContactAt = now;
        if (!c.firstContactAt) set.firstContactAt = now;
        effects.cancelEmails = true;
      }
      if (dto.outcome === 'connected') {
        set.stage = 'connected';
        set.connectedAt = now;
      }
      if (dto.outcome === 'declined') {
        set.stopContact = true;
        set.stage = 'closed';
        effects.cancelEmails = true;
        effects.cancelTasks = true;
      }
      if (
        dto.outcome === 'no_answer' ||
        dto.outcome === 'callback_requested' ||
        dto.outcome === 'needs_help'
      ) {
        const exhausted =
          dto.outcome === 'no_answer' && attempts >= (plan?.maxAttempts || 3);
        if (exhausted) effects.cancelEmails = true;
        effects.newTask = {
          key: 'next:' + eventKey,
          title: exhausted
            ? 'Review unsuccessful contact attempts'
            : dto.outcome === 'needs_help'
              ? 'Respond to requested help'
              : 'Follow up ' +
                (dto.outcome === 'no_answer'
                  ? 'after no answer'
                  : 'at the requested time'),
          kind: exhausted ? 'escalation' : 'callback',
          dueAt: exhausted
            ? now
            : new Date(
                dto.nextActionAt ||
                  Date.now() + (plan?.retryHours || 48) * 3600000,
              ),
          assignedTo: exhausted ? plan?.leaderId || c.ownerId : c.ownerId,
          attempts,
          escalated: exhausted,
        };
      } else if (dto.nextActionAt)
        effects.newTask = {
          key: 'next:' + eventKey,
          title: 'Follow up on the conversation',
          kind: 'care_action',
          dueAt: new Date(dto.nextActionAt),
          assignedTo: c.ownerId,
        };
      text =
        text || 'Task completed: ' + dto.outcome.replaceAll('_', ' ') + '.';
    }
    if (['note', 'contact'].includes(dto.operation) && dto.nextActionAt) {
      data.nextActionAt = dto.nextActionAt;
      if (dto.operation === 'note')
        effects.newTask = {
          key: 'next:' + eventKey,
          title: 'Follow up on the care note',
          kind: 'care_action',
          dueAt: new Date(dto.nextActionAt),
          assignedTo: c.ownerId,
        };
    }
    data.effects = effects;
    const intent: Intent = {
      key: eventKey,
      kind,
      text: text || 'Care updated.',
      visibility: dto.visibility || 'team',
      actorId: u.sub,
      data,
      at: now.toISOString(),
    };
    const result = await this.cases.updateOne(
      {
        _id: c._id,
        revision: dto.expectedRevision,
        ...(['contact', 'task', 'enroll', 'resume'].includes(dto.operation)
          ? { stopContact: false }
          : {}),
      },
      {
        $set: set,
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
        $push: { pendingEvents: intent },
        $inc: { revision: 1 },
      },
    );
    if (!result.modifiedCount)
      throw new ConflictException(
        'This care record changed. Reload before saving.',
      );
    await this.flush({ ...c, ...set, pendingEvents: [intent] } as CaseRecord);
    return this.details(u, id);
  }
  tokenHash(token: string) {
    if (!/^[a-f0-9]{64}$/.test(token))
      throw new NotFoundException('This link is invalid or expired.');
    return createHash('sha256').update(token).digest('hex');
  }
  baseUrl() {
    const configured =
      this.config.get<string>('webUrl') ||
      this.config.get<string>('frontendUrl') ||
      'https://chuflow.com';
    return configured.replace(/\/$/, '');
  }
  async issueToken(c: CaseRecord, kind = 'checkin', days = 14) {
    const raw = randomBytes(32).toString('hex');
    await this.tokens.create({
      hash: this.tokenHash(raw),
      caseId: c._id,
      kind,
      expiresAt: new Date(Date.now() + days * 86400000),
    });
    return this.baseUrl() + '/care-check-in/' + raw;
  }
  async makeLink(u: AuthUser, id: string) {
    const c = await this.context(u, id, true);
    return { url: await this.issueToken(c) };
  }
  async publicInfo(token: string) {
    const row = await this.tokens
      .findOne({
        hash: this.tokenHash(token),
        expiresAt: { $gt: new Date() },
        usedAt: { $exists: false },
      })
      .lean();
    if (!row)
      throw new NotFoundException('This link is invalid, used, or expired.');
    const c = await this.cases.findById(row.caseId).lean();
    if (!c || c.mergedInto) throw new NotFoundException();
    const branch = await this.branches
      .findById(c.branchId)
      .select('name')
      .lean();
    return { churchName: branch?.name || 'Your church', kind: row.kind };
  }
  async publicReply(token: string, dto: CarePublicDto) {
    if (
      dto.until &&
      (+new Date(dto.until) <= Date.now() ||
        +new Date(dto.until) > Date.now() + 180 * 86400000)
    )
      throw new BadRequestException('Choose a future date within 180 days.');
    await this.publicInfo(token);
    const row = await this.tokens
      .findOneAndUpdate(
        {
          hash: this.tokenHash(token),
          expiresAt: { $gt: new Date() },
          usedAt: { $exists: false },
        },
        {
          $set: {
            usedAt: new Date(),
            processingAt: new Date(),
            payload: dto,
            expiresAt: new Date(Date.now() + 90 * 86400000),
          },
        },
        { new: true },
      )
      .lean();
    if (!row) throw new ConflictException('This link has already been used.');
    try {
      await this.applyPublicReply(row, dto);
      return { success: true };
    } catch {
      return { success: true, pending: true };
    }
  }
  async applyPublicReply(
    row: CareToken & { _id: Types.ObjectId },
    dto: CarePublicDto,
  ) {
    const info = { kind: row.kind };
    const key = 'public:' + String(row._id);
    if (await this.events.exists({ key })) {
      await this.tokens.updateOne(
        { _id: row._id },
        { $set: { processedAt: new Date() } },
      );
      return { success: true };
    }
    const c = await this.cases.findById(row.caseId).lean();
    if (!c) throw new NotFoundException();
    if ((c.pendingEvents || []).some((event) => event.key === key)) {
      await this.flush(c);
      await this.tokens.updateOne(
        { _id: row._id },
        { $set: { processedAt: new Date() } },
      );
      return { success: true };
    }
    const set: Record<string, unknown> = { language: dto.language };
    const effects: Record<string, unknown> = {};
    if (info.kind === 'unsubscribe' || dto.stopContact === true) {
      set.stopContact = true;
      set.emailAllowed = false;
      set.stage = 'closed';
      effects.cancelEmails = true;
      effects.cancelTasks = true;
    } else {
      if (dto.contactRequested) set.stopContact = false;
      if (dto.emailAllowed !== undefined) set.emailAllowed = dto.emailAllowed;
      if (dto.emailAllowed === false) effects.cancelEmails = true;
      set.permissionRecordedAt = new Date();
      set.permissionRecordedBy = 'member_checkin';
      if (c.stage === 'closed') set.stage = 'connecting';
      if (dto.until) {
        const until = new Date(dto.until);
        if (+until <= Date.now() || +until > Date.now() + 180 * 86400000)
          throw new BadRequestException(
            'Choose a future date within 180 days.',
          );
        set.stage = 'paused';
        set.pausedUntil = until;
        set.absenceExplanation = dto.response;
        effects.cancelEmails = true;
      }
      if (
        dto.contactRequested &&
        ['request_call', 'prayer', 'other'].includes(dto.response)
      )
        effects.newTask = {
          key: 'checkin:' + String(row._id),
          title:
            dto.response === 'prayer'
              ? 'Respond to prayer / pastoral request'
              : 'Respond to requested personal check-in',
          kind: 'pastoral_request',
          dueAt: new Date(Date.now() + 24 * 3600000),
          assignedTo: c.ownerId,
        };
    }
    const intent: Intent = {
      key: 'public:' + String(row._id),
      kind: 'member_checkin',
      text:
        info.kind === 'unsubscribe' || dto.stopContact === true
          ? 'Contact stopped at the person’s request.'
          : `Member check-in: ${dto.response.replaceAll('_', ' ')}${dto.note ? ' — ' + dto.note : ''}`,
      visibility: dto.response === 'prayer' ? 'pastoral' : 'team',
      data: { response: dto.response, effects },
      at: new Date().toISOString(),
    };
    await this.cases.updateOne(
      { _id: c._id, 'pendingEvents.key': { $ne: key } },
      { $set: set, $push: { pendingEvents: intent }, $inc: { revision: 1 } },
    );
    await this.flush({ ...c, ...set, pendingEvents: [intent] } as CaseRecord);
    await this.tokens.updateOne(
      { _id: row._id },
      { $set: { processedAt: new Date() } },
    );
    return { success: true };
  }
}
