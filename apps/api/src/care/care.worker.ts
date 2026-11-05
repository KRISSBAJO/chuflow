import { NotFoundException } from '@nestjs/common';
import {
  BRANCH_LEADERSHIP_ROLES,
  type AppRole,
} from '../common/constants/roles.constants';
import {
  Communication,
  CommunicationDocument,
} from '../communications/schemas/communication.schema';
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { CareService } from './care.service';
import {
  CareCase,
  CarePlan,
  CareState,
  CareStateDocument,
} from './care.schema';
import {
  FollowUp,
  FollowUpDocument,
} from '../follow-ups/schemas/follow-up.schema';
import { Visit, VisitDocument } from '../visits/schemas/visit.schema';
import {
  Attendance,
  AttendanceDocument,
} from '../attendance/schemas/attendance.schema';
import { MailService } from '../mail/mail.service';
import { PushService } from '../push/push.service';
import {
  CARE_ROLES,
  careAllowed,
  contactWindow,
  normalizeCareEmail,
  renderCareTemplate,
  retentionEvidence,
} from './care.policy';
type RecordCase = CareCase & { _id: Types.ObjectId };
type Source = Record<string, unknown> & {
  _id: Types.ObjectId;
  updatedAt?: Date;
  createdAt?: Date;
};
function sourceText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Types.ObjectId) return value.toHexString();
  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
    ? String(value)
    : '';
}
@Injectable()
export class CareWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CareWorker.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private owner = randomUUID();
  constructor(
    private readonly care: CareService,
    @InjectModel(CareState.name)
    private readonly state: Model<CareStateDocument>,
    @InjectModel(FollowUp.name)
    private readonly followups: Model<FollowUpDocument>,
    @InjectModel(Visit.name) private readonly visits: Model<VisitDocument>,
    @InjectModel(Attendance.name)
    private readonly attendance: Model<AttendanceDocument>,
    @InjectModel(Communication.name)
    private readonly communications: Model<CommunicationDocument>,
    private readonly mail: MailService,
    private readonly push: PushService,
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick().catch(() =>
        this.logger.error('Care worker failed; pending work is retained.'),
      );
    }, 30000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  private async lease() {
    try {
      const row = await this.state
        .findOneAndUpdate(
          {
            key: 'care-worker',
            $or: [
              { 'value.expiresAt': { $lt: Date.now() } },
              { 'value.owner': this.owner },
              { 'value.expiresAt': { $exists: false } },
            ],
          },
          {
            $set: {
              value: { owner: this.owner, expiresAt: Date.now() + 120000 },
            },
          },
          { upsert: true, new: true },
        )
        .lean();
      return row?.value.owner === this.owner;
    } catch (e) {
      if ((e as { code?: number }).code === 11000) return false;
      throw e;
    }
  }
  private async renew() {
    await this.state.updateOne(
      { key: 'care-worker', 'value.owner': this.owner },
      { $set: { 'value.expiresAt': Date.now() + 120000 } },
    );
  }
  private async event(
    c: RecordCase,
    key: string,
    kind: string,
    text: string,
    data: Record<string, unknown> = {},
  ) {
    await this.care.events.updateOne(
      { key },
      {
        $setOnInsert: {
          key,
          caseId: c._id,
          branchId: c.branchId,
          kind,
          text,
          data,
          visibility: 'team',
        },
      },
      { upsert: true },
    );
  }
  private async task(
    c: RecordCase,
    key: string,
    title: string,
    kind: string,
    dueAt: Date,
    more: Record<string, unknown> = {},
  ) {
    return this.care.tasks.updateOne(
      { caseId: c._id, key },
      {
        $setOnInsert: {
          caseId: c._id,
          branchId: c.branchId,
          key,
          title,
          kind,
          dueAt,
          assignedTo: c.ownerId,
          ...more,
        },
      },
      { upsert: true },
    );
  }
  private async memberMilestones(c: RecordCase, source: Source) {
    const milestones: string[] = [];
    for (const [key, name] of [
      ['believerFoundationClassStatus', 'foundation_recorded'],
      ['bccStatus', 'bcc_recorded'],
      ['lccStatus', 'lcc_recorded'],
      ['lcdStatus', 'lcd_recorded'],
    ] as const)
      if (sourceText(source[key]).toLowerCase() === 'yes')
        milestones.push(name);
    const groups = Array.isArray(source.serviceUnitIds)
      ? source.serviceUnitIds
      : source.serviceUnitId
        ? [source.serviceUnitId]
        : [];
    if (groups.length) milestones.push('service_group_joined');
    if (milestones.length)
      await this.care.cases.updateOne(
        { _id: c._id },
        { $addToSet: { milestones: { $each: milestones } } },
      );
  }
  private async ensure(
    source: Source,
    type: 'guest' | 'member' | 'outreach',
  ): Promise<RecordCase | null> {
    const branchId = source.branchId;
    if (!branchId || !Types.ObjectId.isValid(sourceText(branchId))) return null;
    const guestId = type === 'guest' ? source._id : source.guestId;
    if (type !== 'guest' && guestId) {
      const guest = await this.care.guests
        .findOne({ _id: guestId, branchId })
        .lean();
      if (guest) {
        const c = await this.ensure(guest as unknown as Source, 'guest');
        if (!c) return null;
        if (type === 'member') {
          await this.memberMilestones(c, source);
          await this.care.cases.updateOne(
            { _id: c._id },
            {
              $set: {
                memberId: source._id,
                personType: 'member',
                journey: 'member_connection',
                firstName: sourceText(source.firstName) || c.firstName,
                lastName: sourceText(source.lastName) || c.lastName,
                email: normalizeCareEmail(sourceText(source.email)) || '',
                phone: sourceText(source.phone),
              },
              $addToSet: { milestones: 'membership_recorded' },
            },
          );
          await this.care.tasks.updateMany(
            {
              caseId: c._id,
              status: 'open',
              kind: { $in: ['first_contact', 'pastoral_call'] },
            },
            { $set: { status: 'cancelled' } },
          );
          await this.care.jobs.updateMany(
            { caseId: c._id, kind: 'care_email', status: 'queued' },
            { $set: { status: 'cancelled', result: 'Guest became a member.' } },
          );
          if (c.journey === 'guest_welcome' && c.automationEnrolledAt)
            await this.task(
              c,
              'member_connection',
              'Help this member connect to a group or next step',
              'group_introduction',
              new Date(Date.now() + 7 * 86400000),
            );
        } else {
          await this.care.cases.updateOne(
            { _id: c._id },
            {
              $set: {
                outreachId: source._id,
                ...(source.stage === 'do_not_contact'
                  ? { stopContact: true, emailAllowed: false, stage: 'closed' }
                  : {}),
              },
            },
          );
          const old = await this.care.cases
            .findOne({
              branchId,
              personKey: 'outreach:' + sourceText(source._id),
              mergedInto: { $exists: false },
            })
            .lean();
          if (old && sourceText(old._id) !== sourceText(c._id)) {
            await this.care.flush(old);
            await this.care.cases.updateOne(
              { _id: old._id },
              {
                $set: { mergedInto: c._id, stage: 'closed', stopContact: true },
                $inc: { revision: 1 },
              },
            );
            await this.care.events.updateMany(
              { caseId: old._id },
              { $set: { caseId: c._id } },
            );
            await this.care.tasks.updateMany(
              { caseId: old._id, status: 'open' },
              { $set: { status: 'cancelled' } },
            );
            await this.care.jobs.updateMany(
              { caseId: old._id, status: 'queued' },
              {
                $set: { status: 'cancelled', result: 'Care identity merged.' },
              },
            );
            if (old.stopContact)
              await this.care.cases.updateOne(
                { _id: c._id },
                { $set: { stopContact: true, emailAllowed: false } },
              );
            if (!c.ownerId && old.ownerId)
              await this.care.cases.updateOne(
                { _id: c._id, ownerId: { $exists: false } },
                { $set: { ownerId: old.ownerId } },
              );
            await this.event(
              c,
              'merged:' + sourceText(old._id),
              'identity_linked',
              'Evangelism history linked to the guest care record.',
            );
          }
        }
        return await this.care.cases.findById(c._id).lean();
      }
    }
    const personKey = type + ':' + sourceText(source._id);
    const defaults = {
      branchId,
      personKey,
      personType: type,
      journey:
        type === 'guest'
          ? 'guest_welcome'
          : type === 'member'
            ? 'member_connection'
            : 'outreach_connection',
      sourceCreatedAt: source.createdAt || null,
      emailAllowed:
        type === 'outreach' &&
        source.consentToContact === true &&
        source.preferredContactMethod === 'email',
      stopContact: source.stage === 'do_not_contact',
      ...(type === 'guest'
        ? { guestId: source._id }
        : type === 'member'
          ? { memberId: source._id }
          : { outreachId: source._id }),
    };
    const fields = {
      firstName: sourceText(source.firstName || 'Unknown'),
      lastName: sourceText(source.lastName || ''),
      email: typeof source.email === 'string' ? source.email.trim() : '',
      phone: typeof source.phone === 'string' ? source.phone : '',
      ...(type === 'guest'
        ? { wantsPastoralCall: source.wantsPastoralCall === true }
        : {}),
      ...(source.stage === 'do_not_contact'
        ? { stopContact: true, emailAllowed: false, stage: 'closed' }
        : {}),
    };
    const { stopContact, emailAllowed, ...insertDefaults } = defaults;
    const c = await this.care.cases
      .findOneAndUpdate(
        { branchId, personKey },
        {
          $set: fields,
          $setOnInsert: {
            ...insertDefaults,
            ...(!('stopContact' in fields)
              ? { stopContact, emailAllowed }
              : {}),
          },
        },
        { upsert: true, new: true },
      )
      .lean();
    if (c) {
      if (type === 'member') {
        await this.memberMilestones(c, source);
        const groupIds = Array.isArray(source.serviceUnitIds)
          ? source.serviceUnitIds
          : source.serviceUnitId
            ? [source.serviceUnitId]
            : [];
        if (groupIds.length)
          await this.care.cases.updateOne(
            { _id: c._id },
            { $addToSet: { milestones: 'service_group_joined' } },
          );
      }
      await this.event(
        c,
        'source:' + personKey,
        'registered',
        type === 'outreach'
          ? 'Outreach details received. No church visit is implied.'
          : type === 'guest'
            ? 'Guest care record linked.'
            : 'Member care record linked.',
      );
    }
    return c;
  }
  private async scan(
    name: string,
    model: { find: (q: Record<string, unknown>) => unknown },
    handler: (row: Source) => Promise<void>,
  ) {
    const cursor = await this.state.findOne({ key: 'cursor:' + name }).lean();
    const at = cursor?.value.at
      ? new Date(sourceText(cursor.value.at))
      : new Date(0);
    const last = cursor?.value.id
      ? new Types.ObjectId(sourceText(cursor.value.id))
      : new Types.ObjectId('000000000000000000000000');
    const query = {
      $or: [{ updatedAt: { $gt: at } }, { updatedAt: at, _id: { $gt: last } }],
    };
    const finder = model.find(query) as {
      sort: (s: Record<string, number>) => {
        limit: (n: number) => { lean: () => Promise<Source[]> };
      };
    };
    const rows = await finder.sort({ updatedAt: 1, _id: 1 }).limit(100).lean();
    for (const row of rows) {
      await this.renew();
      await handler(row);
      await this.state.updateOne(
        { key: 'cursor:' + name },
        {
          $set: {
            value: {
              at: (row.updatedAt || row.createdAt || new Date()).toISOString(),
              id: sourceText(row._id),
            },
          },
        },
        { upsert: true },
      );
    }
    return rows.length;
  }
  private async syncSources() {
    await this.scan('guests', this.care.guests, async (row) => {
      await this.ensure(row, 'guest');
    });
    await this.renew();
    await this.scan('members', this.care.members, async (row) => {
      await this.ensure(row, 'member');
    });
    await this.scan('outreach', this.care.outreach, async (row) => {
      const c = await this.ensure(row, 'outreach');
      if (!c) return;
      const activities = Array.isArray(row.activities)
        ? (row.activities as Record<string, unknown>[])
        : [];
      for (let i = 0; i < activities.length; i++) {
        const activity = activities[i];
        await this.event(
          c,
          `outreach:${sourceText(row._id)}:${sourceText(activity.createdAt)}:${i}`,
          'outreach_activity',
          sourceText(activity.note || 'Outreach activity recorded.'),
          { stage: activity.stage, method: activity.contactMethod },
        );
      }
    });
    await this.scan('followups', this.followups, async (row) => {
      const guest = await this.care.guests.findById(row.guestId).lean();
      if (!guest) return;
      const c = await this.ensure(guest as unknown as Source, 'guest');
      if (!c) return;
      if (row.assignedTo && !c.ownerId) {
        const owner = await this.care.users
          .findOne({
            _id: row.assignedTo,
            branchId: c.branchId,
            isActive: true,
            role: { $in: CARE_ROLES },
          })
          .lean();
        if (owner)
          await this.care.cases.updateOne(
            { _id: c._id, ownerId: { $exists: false } },
            { $set: { ownerId: owner._id }, $inc: { revision: 1 } },
          );
      }
      await this.event(
        c,
        'legacy:' +
          sourceText(row._id) +
          ':' +
          sourceText(+new Date(sourceText(row.updatedAt || row.createdAt))),
        'legacy_followup',
        sourceText(row.note || 'Existing follow-up record linked.'),
        { stage: row.status, method: row.contactMethod },
      );
      if (
        !['returned', 'converted'].includes(sourceText(row.status)) &&
        !c.memberId
      )
        await this.task(
          c,
          'legacy:' + sourceText(row._id),
          'Review existing guest follow-up',
          'legacy_followup',
          row.nextActionDate
            ? new Date(sourceText(row.nextActionDate))
            : new Date(Date.now() + 86400000),
          { assignedTo: row.assignedTo || c.ownerId },
        );
    });
    await this.scan('visits', this.visits, async (row) => {
      if (+new Date(sourceText(row.visitDate)) > Date.now()) return;
      const guest = await this.care.guests.findById(row.guestId).lean();
      if (!guest) return;
      const c = await this.ensure(guest as unknown as Source, 'guest');
      if (!c) return;
      const prior = await this.visits.exists({
        guestId: row.guestId,
        $or: [
          { visitDate: { $lt: new Date(sourceText(row.visitDate)) } },
          {
            visitDate: new Date(sourceText(row.visitDate)),
            _id: { $lt: row._id },
          },
        ],
      });
      if (prior) {
        await this.care.cases.updateOne(
          { _id: c._id },
          {
            $min: { firstReturnAt: new Date(sourceText(row.visitDate)) },
            $max: { lastReturnAt: new Date(sourceText(row.visitDate)) },
            $addToSet: { milestones: 'return_visit_recorded' },
          },
        );
        await this.care.tasks.updateMany(
          { caseId: c._id, status: 'open', kind: 'first_contact' },
          { $set: { status: 'cancelled' } },
        );
        await this.care.jobs.updateMany(
          { caseId: c._id, status: 'queued', kind: 'care_email' },
          {
            $set: {
              status: 'cancelled',
              result: 'A return visit was recorded.',
            },
          },
        );
        await this.event(
          c,
          'return:' + sourceText(row._id),
          'return_recorded',
          'A return church visit was recorded.',
        );
        if (c.automationEnrolledAt && !c.lastReturnAt)
          await this.task(
            c,
            'return_next_step',
            'Offer a next step after the return visit',
            'next_step',
            new Date(Date.now() + 3 * 86400000),
          );
      }
    });
    await this.scan('communications', this.communications, async (row) => {
      let c: RecordCase | null = null;
      if (row.memberId) {
        const m = await this.care.members.findById(row.memberId).lean();
        if (m) c = await this.ensure(m as unknown as Source, 'member');
      } else if (row.guestId) {
        const g = await this.care.guests.findById(row.guestId).lean();
        if (g) c = await this.ensure(g as unknown as Source, 'guest');
      }
      if (c)
        await this.event(
          c,
          'communication:' + sourceText(row._id),
          'communication_record',
          `${sourceText(row.channel)} recorded (${sourceText(row.deliveryMode || row.status)}): ${sourceText(row.message || '')}`,
          { status: row.status, deliveryMode: row.deliveryMode },
        );
    });
    await this.scan('individual-attendance', this.attendance, async (row) => {
      if (
        row.entryMode !== 'individual' ||
        row.personType !== 'member' ||
        !row.memberId ||
        +new Date(sourceText(row.serviceDate)) > Date.now()
      )
        return;
      const m = await this.care.members.findById(row.memberId).lean();
      if (!m || sourceText(m.branchId) !== sourceText(row.branchId)) return;
      const c = await this.ensure(m as unknown as Source, 'member');
      if (!c) return;
      const at = new Date(sourceText(row.serviceDate));
      if (!c.lastAttendanceAt || +at > +c.lastAttendanceAt) {
        const open = await this.care.tasks.exists({
          caseId: c._id,
          kind: 'absence_check',
          status: 'open',
        });
        await this.care.cases.updateOne(
          { _id: c._id },
          { $max: { lastAttendanceAt: at } },
        );
        await this.care.tasks.updateMany(
          { caseId: c._id, kind: 'absence_check', status: 'open' },
          {
            $set: {
              status: 'done',
              outcome: 'attendance_recorded',
              completedAt: new Date(),
            },
          },
        );
        if (open)
          await this.event(
            c,
            'reconnected:' + sourceText(row._id),
            'attendance_recorded',
            'A newer individual church attendance record resolved a participation-gap check.',
          );
      }
    });
  }
  private async chooseOwner(plan: CarePlan) {
    const ids = plan.teamIds.filter(
      (id) =>
        !plan.unavailableUntil?.[id] ||
        +new Date(plan.unavailableUntil[id]) < Date.now(),
    );
    const users = await this.care.users
      .find({
        _id: { $in: ids },
        branchId: plan.branchId,
        isActive: true,
        role: { $in: CARE_ROLES },
      })
      .select('_id')
      .lean();
    const loads = await this.care.cases.aggregate<{
      _id: Types.ObjectId;
      n: number;
    }>([
      {
        $match: {
          branchId: plan.branchId,
          ownerId: { $in: users.map((x) => x._id) },
          stage: { $in: ['new', 'connecting'] },
          mergedInto: { $exists: false },
        },
      },
      { $group: { _id: '$ownerId', n: { $sum: 1 } } },
    ]);
    return users
      .map((u) => ({
        id: u._id,
        n: loads.find((x) => sourceText(x._id) === sourceText(u._id))?.n || 0,
      }))
      .filter((x) => x.n < plan.capacity)
      .sort(
        (a, b) => a.n - b.n || sourceText(a.id).localeCompare(sourceText(b.id)),
      )[0]?.id;
  }
  private async enqueue(
    c: RecordCase,
    plan: CarePlan,
    kind: string,
    key: string,
    dueAt: Date,
    data: Record<string, unknown> = {},
  ) {
    await this.care.jobs.updateOne(
      { key },
      {
        $setOnInsert: {
          key,
          caseId: c._id,
          branchId: c.branchId,
          kind,
          dueAt,
          data,
        },
      },
      { upsert: true },
    );
  }
  private async enroll(plan: CarePlan) {
    const rows = await this.care.cases
      .find({
        branchId: plan.branchId,
        mergedInto: { $exists: false },
        enrollmentCompletedAt: { $exists: false },
        $or: [
          { sourceCreatedAt: { $gte: plan.enabledAt || new Date() } },
          { enrollmentRequestedAt: { $exists: true } },
        ],
        stage: { $nin: ['closed', 'paused'] },
        stopContact: false,
      })
      .sort({ _id: 1 })
      .limit(100)
      .lean();
    for (const c of rows) {
      const owner = c.ownerId || (await this.chooseOwner(plan));
      const startedAt = c.automationEnrolledAt || new Date();
      const result = await this.care.cases.updateOne(
        {
          _id: c._id,
          revision: c.revision,
          enrollmentCompletedAt: { $exists: false },
        },
        {
          $set: {
            automationEnrolledAt: startedAt,
            ...(owner ? { ownerId: owner } : {}),
            ...(!c.automationEnrolledAt && owner
              ? { stage: 'connecting' }
              : {}),
            ...(plan.leaderId ? { backupId: plan.leaderId } : {}),
          },
          $inc: { revision: 1 },
        },
      );
      if (!result.modifiedCount) continue;
      const updated = { ...c, ownerId: owner };
      const existing = await this.care.tasks.exists({
        caseId: c._id,
        status: 'open',
      });
      if (!existing)
        await this.task(
          updated,
          'first_contact',
          c.wantsPastoralCall
            ? 'Arrange the requested pastoral call'
            : c.personType === 'member'
              ? 'Help this member take a connection step'
              : 'Make the first personal contact',
          c.wantsPastoralCall
            ? 'pastoral_call'
            : c.personType === 'member'
              ? 'next_step'
              : 'first_contact',
          new Date(
            +startedAt +
              (c.wantsPastoralCall
                ? Math.min(plan.firstContactHours, 6)
                : plan.firstContactHours) *
                3600000,
          ),
        );
      await this.event(
        c,
        'enroll:' + sourceText(c._id),
        'automation',
        'Care plan started' +
          (owner ? ' with a named owner.' : '; awaiting an available worker.'),
      );
      if (
        c.emailAllowed &&
        plan.emailEnabled &&
        normalizeCareEmail(c.email) &&
        c.journey !== 'member_connection'
      ) {
        for (const day of [0, 3, 7]) {
          const due = contactWindow(
            new Date(+startedAt + day * 86400000),
            plan.timeZone,
            plan.quietStart,
            plan.quietEnd,
          );
          const email = normalizeCareEmail(c.email)!;
          await this.enqueue(
            c,
            plan,
            'care_email',
            `care-email:${sourceText(c.branchId)}:${email}:${due.toISOString().slice(0, 10)}`,
            due,
            { journey: c.journey, step: day, email },
          );
        }
      }
      await this.care.cases.updateOne(
        { _id: c._id },
        { $set: { enrollmentCompletedAt: new Date() } },
      );
    }
  }
  private async maintain(plan: CarePlan) {
    const paused = await this.care.cases
      .find({
        branchId: plan.branchId,
        stage: 'paused',
        pausedUntil: { $lte: new Date() },
        stopContact: false,
      })
      .limit(100)
      .lean();
    for (const c of paused) {
      await this.care.cases.updateOne(
        { _id: c._id, stage: 'paused', revision: c.revision },
        {
          $set: { stage: 'connecting', absenceExplanation: '' },
          $unset: { pausedUntil: '' },
          $inc: { revision: 1 },
        },
      );
      await this.care.tasks.updateMany(
        { caseId: c._id, status: 'open', dueAt: { $lt: new Date() } },
        { $set: { dueAt: new Date(Date.now() + 86400000) } },
      );
      await this.event(
        c,
        'resume:' +
          sourceText(c._id) +
          ':' +
          sourceText(+new Date(c.pausedUntil!)),
        'automation',
        'Care resumed after the agreed pause.',
      );
    }
    const unassigned = await this.care.cases
      .find({
        branchId: plan.branchId,
        ownerId: { $exists: false },
        stage: { $in: ['new', 'connecting'] },
        stopContact: false,
        automationEnrolledAt: { $exists: true },
      })
      .limit(50)
      .lean();
    for (const c of unassigned) {
      const owner = await this.chooseOwner(plan);
      if (!owner) break;
      const res = await this.care.cases.updateOne(
        { _id: c._id, ownerId: { $exists: false }, revision: c.revision },
        {
          $set: { ownerId: owner, stage: 'connecting' },
          $inc: { revision: 1 },
        },
      );
      if (res.modifiedCount) {
        await this.care.tasks.updateMany(
          { caseId: c._id, status: 'open', assignedTo: { $exists: false } },
          { $set: { assignedTo: owner } },
        );
        await this.event(
          c,
          'assign:' + sourceText(c._id),
          'assignment',
          'An available branch care worker was assigned.',
        );
      }
    }
    const reminderCursor = await this.state
      .findOne({ key: 'reminder-cursor:' + sourceText(plan.branchId) })
      .lean();
    const reminderId =
      typeof reminderCursor?.value.id === 'string'
        ? reminderCursor.value.id
        : '';
    const due = await this.care.tasks
      .find({
        branchId: plan.branchId,
        status: 'open',
        dueAt: { $lte: new Date() },
        ...(reminderId ? { _id: { $gt: new Types.ObjectId(reminderId) } } : {}),
      })
      .sort({ _id: 1 })
      .limit(100)
      .lean();
    for (const task of due) {
      const c = await this.care.cases.findById(task.caseId).lean();
      if (!c || !careAllowed(c)) continue;
      const owner = task.assignedTo || c.ownerId;
      const covering =
        owner &&
        plan.unavailableUntil?.[sourceText(owner)] &&
        +new Date(plan.unavailableUntil[sourceText(owner)]) > Date.now()
          ? c.backupId || plan.leaderId
          : owner;
      if (covering)
        await this.enqueue(
          c,
          plan,
          'staff_reminder',
          `remind:${sourceText(plan.branchId)}:${sourceText(covering)}:${new Date().toISOString().slice(0, 10)}`,
          new Date(),
          { userId: sourceText(covering) },
        );
      if (
        !task.escalated &&
        Date.now() - +task.dueAt >= plan.escalationHours * 3600000
      ) {
        await this.care.tasks.updateOne(
          { _id: task._id, status: 'open' },
          { $set: { escalated: true } },
        );
        await this.event(
          c,
          'escalate:' + sourceText(task._id),
          'escalation',
          'An overdue care commitment was escalated to branch leadership.',
        );
        if (plan.leaderId)
          await this.enqueue(
            c,
            plan,
            'staff_escalation',
            `escalate:${sourceText(plan.branchId)}:${sourceText(plan.leaderId)}:${new Date().toISOString().slice(0, 10)}`,
            new Date(),
            { userId: sourceText(plan.leaderId) },
          );
      }
    }
    await this.state.updateOne(
      { key: 'reminder-cursor:' + sourceText(plan.branchId) },
      {
        $set: {
          value: {
            id: due.length === 100 ? sourceText(due[due.length - 1]._id) : '',
          },
        },
      },
      { upsert: true },
    );
  }
  private async retention(plan: CarePlan) {
    if (!plan.attendanceReliable || !plan.coverageFrom) return;
    const day = new Date().toISOString().slice(0, 10);
    const key = 'retention:' + sourceText(plan.branchId);
    const state = await this.state.findOne({ key }).lean();
    const sameRun =
      state?.value.day === day && state.value.revision === plan.revision;
    if (sameRun && state.value.done) return;
    const cursor =
      sameRun && state.value.cursor
        ? new Types.ObjectId(sourceText(state.value.cursor))
        : null;
    const since = new Date(
      Math.max(+plan.coverageFrom, Date.now() - 90 * 86400000),
    );
    const observations = await this.attendance.aggregate<{
      _id: Types.ObjectId;
      last: Date;
      count: number;
    }>([
      {
        $match: {
          branchId: plan.branchId,
          entryMode: 'individual',
          personType: 'member',
          memberId: { $exists: true },
          serviceDate: { $gte: since, $lte: new Date() },
        },
      },
      {
        $group: {
          _id: {
            memberId: '$memberId',
            service: {
              $ifNull: [
                '$serviceInstanceId',
                {
                  $concat: [
                    {
                      $dateToString: {
                        format: '%Y-%m-%d',
                        date: '$serviceDate',
                      },
                    },
                    ' ',
                    '$serviceType',
                  ],
                },
              ],
            },
          },
          at: { $max: '$serviceDate' },
        },
      },
      {
        $group: {
          _id: '$_id.memberId',
          last: { $max: '$at' },
          count: { $sum: 1 },
        },
      },
      {
        $match: {
          last: { $lte: new Date(Date.now() - plan.absenceDays * 86400000) },
          count: { $gte: plan.minAttendanceRecords },
          ...(cursor ? { _id: { $gt: cursor } } : {}),
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 200 },
    ]);
    for (const observation of observations) {
      await this.renew();
      const member = await this.care.members
        .findOne({
          _id: observation._id,
          branchId: plan.branchId,
          membershipStatus: 'active',
        })
        .lean();
      if (!member) continue;
      const c = await this.ensure(member as unknown as Source, 'member');
      if (!c) continue;
      const evidence = retentionEvidence({
        reliable: plan.attendanceReliable,
        coverageFrom: plan.coverageFrom,
        count: observation.count,
        minimum: plan.minAttendanceRecords,
        last: observation.last,
        gapDays: plan.absenceDays,
        paused: !careAllowed(c) || !!c.absenceExplanation,
      });
      if (!c.lastAttendanceAt || +observation.last > +c.lastAttendanceAt) {
        await this.care.cases.updateOne(
          { _id: c._id },
          { $set: { lastAttendanceAt: observation.last } },
        );
        await this.care.tasks.updateMany(
          { caseId: c._id, kind: 'absence_check', status: 'open' },
          {
            $set: {
              status: 'done',
              outcome: 'attendance_recorded',
              completedAt: new Date(),
            },
          },
        );
      }
      if (evidence.eligible) {
        if (!c.ownerId) {
          const owner = await this.chooseOwner(plan);
          await this.care.cases.updateOne(
            { _id: c._id, ownerId: { $exists: false }, revision: c.revision },
            {
              $set: {
                ...(owner ? { ownerId: owner } : {}),
                automationEnrolledAt: c.automationEnrolledAt || new Date(),
                ...(plan.leaderId ? { backupId: plan.leaderId } : {}),
                stage: 'connecting',
              },
              $inc: { revision: 1 },
            },
          );
          const current = await this.care.cases.findById(c._id).lean();
          if (current) c.ownerId = current.ownerId;
        }
        const createdSignal = await this.task(
          c,
          'absence:' + observation.last.toISOString(),
          'Check in about a change in recorded participation',
          'absence_check',
          new Date(),
          { evidence: evidence.reason },
        );
        if (
          createdSignal.upsertedCount &&
          plan.retentionEmailEnabled &&
          plan.emailEnabled &&
          c.emailAllowed &&
          normalizeCareEmail(c.email)
        ) {
          const cycle = 'retention:' + observation.last.toISOString();
          await this.care.cases.updateOne(
            { _id: c._id },
            { $set: { automatedCycle: cycle, automatedAttempts: 0 } },
          );
          const due = contactWindow(
            new Date(),
            plan.timeZone,
            plan.quietStart,
            plan.quietEnd,
          );
          const email = normalizeCareEmail(c.email)!;
          await this.enqueue(
            c,
            plan,
            'care_email',
            `care-email:${sourceText(c.branchId)}:${email}:${due.toISOString().slice(0, 10)}`,
            due,
            { journey: c.journey, purpose: 'retention', email, cycle },
          );
        }
        await this.event(
          c,
          'signal:' + sourceText(c._id) + ':' + observation.last.toISOString(),
          'retention_signal',
          evidence.reason +
            ' This is a prompt to ask, not a conclusion that the person has disengaged.',
        );
      }
    }
    await this.state.updateOne(
      { key },
      {
        $set: {
          value: {
            day,
            revision: plan.revision,
            done: observations.length < 200,
            cursor: observations.length
              ? sourceText(observations[observations.length - 1]._id)
              : '',
          },
        },
      },
      { upsert: true },
    );
  }
  private async digests(plan: CarePlan) {
    if (!plan.weeklyDigest || !plan.leaderId) return;
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: plan.timeZone,
      weekday: 'short',
      hour: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    if (
      parts.find((x) => x.type === 'weekday')?.value !== 'Mon' ||
      Number(parts.find((x) => x.type === 'hour')?.value) < 8
    )
      return;
    const week = new Date().toISOString().slice(0, 10);
    await this.care.jobs.updateOne(
      { key: 'digest:' + sourceText(plan.branchId) + ':' + week },
      {
        $setOnInsert: {
          key: 'digest:' + sourceText(plan.branchId) + ':' + week,
          branchId: plan.branchId,
          kind: 'staff_digest',
          dueAt: new Date(),
          data: { userId: sourceText(plan.leaderId) },
        },
      },
      { upsert: true },
    );
  }
  private async recoverPublicReplies() {
    const pending = await this.care.tokens
      .find({
        usedAt: { $exists: true },
        processedAt: { $exists: false },
        payload: { $exists: true },
        $or: [
          { processingAt: { $exists: false } },
          { processingAt: { $lt: new Date(Date.now() - 5 * 60000) } },
        ],
      })
      .limit(50)
      .lean();
    for (const token of pending) {
      const claimed = await this.care.tokens
        .findOneAndUpdate(
          {
            _id: token._id,
            processedAt: { $exists: false },
            $or: [
              { processingAt: { $exists: false } },
              { processingAt: { $lt: new Date(Date.now() - 5 * 60000) } },
            ],
          },
          { $set: { processingAt: new Date() } },
          { new: true },
        )
        .lean();
      if (claimed)
        try {
          await this.care.applyPublicReply(
            claimed,
            claimed.payload as unknown as import('./care.dto').CarePublicDto,
          );
        } catch (error) {
          if (error instanceof NotFoundException)
            await this.care.tokens.updateOne(
              { _id: claimed._id },
              { $set: { processedAt: new Date() } },
            );
          else
            this.logger.error(
              'A saved member reply could not be applied; it remains available for retry.',
            );
        }
    }
  }
  private async dispatch() {
    await this.recoverPublicReplies();
    await this.care.jobs.updateMany(
      {
        status: 'sending',
        claimedAt: { $lt: new Date(Date.now() - 5 * 60000) },
      },
      {
        $set: {
          status: 'uncertain',
          result: 'Interrupted delivery; check the provider before resending.',
        },
      },
    );
    for (let n = 0; n < 20; n++) {
      await this.renew();
      const job = await this.care.jobs
        .findOneAndUpdate(
          { status: 'queued', dueAt: { $lte: new Date() } },
          { $set: { status: 'sending', claimedAt: new Date() } },
          { new: true, sort: { dueAt: 1 } },
        )
        .lean();
      if (!job) break;
      try {
        const plan = await this.care.plans
          .findOne({ branchId: job.branchId })
          .lean();
        const c = job.caseId
          ? await this.care.cases.findById(job.caseId).lean()
          : null;
        let status = 'cancelled',
          result =
            'Automation is disabled or the care case is no longer eligible.';
        if (plan?.enabled && (!job.caseId || (c && careAllowed(c)))) {
          if (job.kind === 'care_email' && c) {
            const email = normalizeCareEmail(c.email);
            const source = c.outreachId
              ? await this.care.outreach
                  .findById(c.outreachId)
                  .select('consentToContact stage email branchId')
                  .lean()
              : null;
            const guest = c.guestId
              ? await this.care.guests
                  .findById(c.guestId)
                  .select('convertedToMember email branchId')
                  .lean()
              : null;
            const member = c.memberId
              ? await this.care.members
                  .findById(c.memberId)
                  .select('email branchId')
                  .lean()
              : null;
            const authoritative = member || guest || source;
            const emailIsCurrent =
              !!authoritative &&
              sourceText(authoritative.branchId) === sourceText(c.branchId) &&
              normalizeCareEmail(authoritative.email) === email;
            const recent = await this.communications.exists({
              branchId: c.branchId,
              $or: [
                ...(c.guestId ? [{ guestId: c.guestId }] : []),
                ...(c.memberId ? [{ memberId: c.memberId }] : []),
                { recipient: email },
              ],
              status: 'sent',
              createdAt: { $gte: new Date(Date.now() - 48 * 3600000) },
            });
            const recentCare = await this.care.jobs.exists({
              _id: { $ne: job._id },
              branchId: c.branchId,
              kind: 'care_email',
              status: 'sent',
              'data.email': email,
              updatedAt: { $gte: new Date(Date.now() - 48 * 3600000) },
            });
            const pendingStop = await this.care.tokens.exists({
              caseId: c._id,
              usedAt: { $exists: true },
              processedAt: { $exists: false },
              $or: [
                { kind: 'unsubscribe' },
                { 'payload.stopContact': true },
                { 'payload.emailAllowed': false },
              ],
            });
            const allowed =
              !pendingStop &&
              emailIsCurrent &&
              !recent &&
              !recentCare &&
              plan.emailEnabled &&
              c.emailAllowed &&
              !!email &&
              (!job.data.budgetReserved ||
                c.automatedAttempts <= plan.maxAutomatedMessages) &&
              (!source ||
                (source.consentToContact &&
                  source.stage !== 'do_not_contact')) &&
              (job.data.purpose === 'retention'
                ? plan.retentionEmailEnabled &&
                  (!c.lastContactAt ||
                    +c.lastContactAt <
                      +new Date(job.createdAt || job.claimedAt || 0)) &&
                  c.automatedCycle === job.data.cycle
                : !guest?.convertedToMember &&
                  !c.lastContactAt &&
                  !c.lastReturnAt) &&
              c.journey === job.data.journey;
            if (allowed) {
              const window = contactWindow(
                new Date(),
                plan.timeZone,
                plan.quietStart,
                plan.quietEnd,
              );
              if (+window > Date.now() + 60000) {
                await this.care.jobs.updateOne(
                  { _id: job._id, status: 'sending' },
                  { $set: { status: 'queued', dueAt: window } },
                );
                continue;
              }
              let reserved = !!job.data.budgetReserved;
              if (!reserved) {
                const claim = await this.care.cases.updateOne(
                  {
                    _id: c._id,
                    automatedAttempts: { $lt: plan.maxAutomatedMessages },
                    stopContact: false,
                    emailAllowed: true,
                  },
                  { $inc: { automatedAttempts: 1 } },
                );
                reserved = claim.modifiedCount > 0;
                if (reserved)
                  await this.care.jobs.updateOne(
                    { _id: job._id },
                    { $set: { 'data.budgetReserved': true } },
                  );
              }
              if (reserved) {
                const branch = await this.care.branches
                  .findById(c.branchId)
                  .select('name')
                  .lean();
                const checkInUrl = await this.care.issueToken(c);
                const stop = await this.care.issueToken(c, 'unsubscribe', 365);
                const values = {
                  firstName: c.firstName,
                  churchName: branch?.name || 'Your church',
                  checkInUrl,
                };
                const es = c.language === 'es';
                const delivery = await this.mail.sendAppEmail({
                  to: email,
                  subject: renderCareTemplate(
                    job.data.purpose === 'retention'
                      ? es
                        ? plan.retentionSubjectEs
                        : plan.retentionSubject
                      : es
                        ? plan.subjectEs
                        : plan.subject,
                    values,
                  ).replace(/[\r\n]/g, ' '),
                  text:
                    renderCareTemplate(
                      job.data.purpose === 'retention'
                        ? es
                          ? plan.retentionMessageEs
                          : plan.retentionMessage
                        : es
                          ? plan.messageEs
                          : plan.message,
                      values,
                    ) +
                    '\n\n' +
                    (es
                      ? 'Dejar de recibir mensajes: '
                      : 'Stop these messages: ') +
                    stop,
                });
                status = delivery.delivered ? 'sent' : 'failed';
                result = delivery.delivered
                  ? 'Accepted by the email provider.'
                  : 'Email delivery is not configured.';
                await this.event(
                  c,
                  'message:' + sourceText(job._id),
                  'message',
                  result,
                  { channel: 'email', status },
                );
              } else result = 'Automatic contact attempt limit reached.';
            }
          } else if (job.kind === 'staff_digest') {
            const user = await this.care.users
              .findOne({
                _id: sourceText(job.data.userId),
                branchId: job.branchId,
                isActive: true,
                role: { $in: BRANCH_LEADERSHIP_ROLES },
              })
              .lean();
            if (user && normalizeCareEmail(user.email)) {
              const report = await this.care.overview(
                {
                  sub: sourceText(user._id),
                  email: user.email,
                  role: user.role as AppRole,
                  branchId: sourceText(job.branchId),
                },
                sourceText(job.branchId),
              );
              const sent = await this.mail.sendAppEmail({
                to: user.email,
                subject: 'Your weekly ChuFlow care briefing',
                text:
                  (report.briefing as string[]).join('\n') +
                  '\n\n' +
                  this.care.baseUrl() +
                  '/care',
              });
              status = sent.delivered ? 'sent' : 'failed';
              result = sent.delivered
                ? 'Accepted by the email provider.'
                : 'Email delivery is not configured.';
            }
          } else if (c) {
            const user = await this.care.users
              .findOne({
                _id: sourceText(job.data.userId),
                branchId: job.branchId,
                isActive: true,
                role: { $in: CARE_ROLES },
              })
              .select('_id')
              .lean();
            const task = job.data.taskId
              ? await this.care.tasks
                  .findOne({ _id: job.data.taskId, status: 'open' })
                  .lean()
              : null;
            if (user && (!job.data.taskId || task)) {
              this.push.notifyUsers([sourceText(user._id)], {
                title:
                  job.kind === 'staff_escalation'
                    ? 'Care needs leadership attention'
                    : 'Care commitment is due',
                body: 'Open ChuFlow to review the next action.',
                url: '/care/' + sourceText(c._id),
                tag: sourceText(job._id),
              });
              status = 'dispatched';
              result =
                'Staff notification requested; device receipt is not confirmed.';
            }
          }
        }
        await this.care.jobs.updateOne(
          { _id: job._id, status: 'sending' },
          { $set: { status, result } },
        );
      } catch {
        await this.care.jobs.updateOne(
          { _id: job._id, status: 'sending' },
          {
            $set: {
              status: 'uncertain',
              result:
                'Delivery or processing could not be confirmed. Review before resending.',
            },
          },
        );
      }
    }
  }
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      if (!(await this.lease())) return;
      await this.syncSources();
      await this.renew();
      const pending = await this.care.cases
        .find({ 'pendingEvents.0': { $exists: true } })
        .limit(100)
        .lean();
      for (const c of pending) await this.care.flush(c);
      const plans = await this.care.plans.find({ enabled: true }).lean();
      for (const plan of plans) {
        await this.renew();
        await this.enroll(plan);
        await this.maintain(plan);
        await this.retention(plan);
        await this.digests(plan);
      }
      await this.dispatch();
    } finally {
      await this.state
        .updateOne(
          { key: 'care-worker', 'value.owner': this.owner },
          { $set: { 'value.expiresAt': Date.now() - 1 } },
        )
        .catch(() => {});
      this.running = false;
    }
  }
}
