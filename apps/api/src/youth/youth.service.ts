import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isEmail } from 'class-validator';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { Model, Types } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { Branch } from '../branches/schemas/branch.schema';
import { ChildProfile } from '../children/children.schema';
import { BRANCH_LEADERSHIP_ROLES, BRANCH_SUPPORT_ROLES, LEADERSHIP_ROLES, YOUTH_ROLES } from '../common/constants/roles.constants';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { GuestFieldsService, MinistryFormKind } from '../guests/guest-fields.service';
import { Member } from '../members/schemas/member.schema';
import { User } from '../users/schemas/user.schema';
import { getWorkspace, workspaceWebLink } from '../workspaces/workspace-boundary';
import { MailService } from '../mail/mail.service';
import { YouthDevelopment, YouthDevelopmentProgress, YouthPost } from './youth-development.schema';
import { YouthMentoringConsentDto, YouthPostDto, YouthRolloutDto } from './youth-development.dto';
import { YouthAttendanceDto, YouthCampDto, YouthCampFinanceDto, YouthCampFollowUpDto, YouthCampLogisticsDto, YouthEventDto, YouthGroupDto, YouthGroupSettingsDto, YouthLeaderDto, YouthRegistrationDto, YouthReviewDto, YouthTransitionDto } from './youth.dto';
import { YouthCampDelegation, YouthEnrollment, YouthGroup, YouthSession } from './youth.schema';
import { YouthParticipantInviteDto } from './youth.dto';

const day = () => new Date().toISOString().slice(0, 10);
const duplicate = (error: unknown) => (error as { code?: number })?.code === 11000;
const leaderRoles = [...BRANCH_LEADERSHIP_ROLES, ...BRANCH_SUPPORT_ROLES, ...YOUTH_ROLES];
const followUpRoles = [...BRANCH_LEADERSHIP_ROLES, 'youth_pastor'];
const emailAddress = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
const reminderCopy = {
  en: ['Youth event reminder', 'Event', 'Date', 'Location', 'Stop these reminders'],
  es: ['Recordatorio del evento juvenil', 'Evento', 'Fecha', 'Lugar', 'Dejar de recibir estos recordatorios'],
  fr: ['Rappel de l’événement jeunesse', 'Événement', 'Date', 'Lieu', 'Ne plus recevoir ces rappels'],
  pt: ['Lembrete do evento de jovens', 'Evento', 'Data', 'Local', 'Parar de receber estes lembretes'],
} as const;
const mentoringCopy = {
  en: ['Youth mentoring reminder', 'A mentoring check-in is scheduled for', 'Stop mentoring emails'],
  es: ['Recordatorio de mentoría juvenil', 'Hay una reunión de mentoría programada para el', 'Dejar de recibir correos de mentoría'],
  fr: ['Rappel de mentorat jeunesse', 'Un rendez-vous de mentorat est prévu le', 'Ne plus recevoir les e-mails de mentorat'],
  pt: ['Lembrete de mentoria de jovens', 'Há um encontro de mentoria marcado para', 'Parar de receber e-mails de mentoria'],
} as const;
const id = (value: string) => {
  if (!Types.ObjectId.isValid(value)) throw new NotFoundException();
  return new Types.ObjectId(value);
};

@Injectable()
export class YouthService {
  constructor(
    @InjectModel(YouthGroup.name) private readonly groups: Model<YouthGroup>,
    @InjectModel(YouthEnrollment.name) private readonly enrollments: Model<YouthEnrollment>,
    @InjectModel(YouthSession.name) private readonly sessions: Model<YouthSession>,
    @InjectModel(YouthCampDelegation.name) private readonly delegations: Model<YouthCampDelegation>,
    @InjectModel(Branch.name) private readonly branches: Model<Branch>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Member.name) private readonly members: Model<Member>,
    @InjectModel(ChildProfile.name) private readonly children: Model<ChildProfile>,
    @InjectModel(YouthDevelopment.name) private readonly activities: Model<YouthDevelopment>,
    @InjectModel(YouthDevelopmentProgress.name) private readonly progress: Model<YouthDevelopmentProgress>,
    @InjectModel(YouthPost.name) private readonly posts: Model<YouthPost>,
    private readonly access: AccessScopeService,
    private readonly forms: GuestFieldsService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  private canManage(user: AuthUser) {
    return user.role === 'super_admin' || user.role === 'youth_pastor' || BRANCH_LEADERSHIP_ROLES.includes(user.role);
  }

  private canManageEvents(user: AuthUser) {
    return this.canManage(user) || user.role === 'district_admin' || user.role === 'district_pastor';
  }

  private managesGroup(user: AuthUser, group: YouthGroup) {
    return this.canManage(user) || Boolean(group.eventDate && group.districtManaged && this.canManageEvents(user));
  }

  private get pilotAvailable() {
    return getWorkspace(this.config).id === 'winners-chapel-international';
  }

  private async manageBranch(user: AuthUser, branchId: string, event = false) {
    if (!(event ? this.canManageEvents(user) : this.canManage(user))) throw new ForbiddenException();
    const branch = id(branchId);
    await this.access.ensureBranchAccess(user, branchId);
    if (!await this.branches.exists({ _id: branch })) throw new NotFoundException();
    return branch;
  }

  private async scopedGroup(user: AuthUser, groupId: string, management = false) {
    const group = await this.groups.findById(id(groupId)).lean();
    if (!group) throw new NotFoundException();
    await this.access.ensureBranchAccess(user, String(group.branchId));
    if (!this.managesGroup(user, group) && (management || String(group.leaderId) !== user.sub || !await this.cleared(group))) {
      throw new ForbiddenException();
    }
    return group;
  }

  async developmentScope(user: AuthUser, groupId: string, management = false) {
    const group = await this.scopedGroup(user, groupId, management);
    if (group.eventDate) throw new NotFoundException();
    return { group, manager: this.managesGroup(user, group), screenedLeader: await this.cleared(group) };
  }

  async overview(user: AuthUser) {
    const scope = await this.access.buildBranchObjectIdFilter(user);
    const query = LEADERSHIP_ROLES.includes(user.role) || user.role === 'youth_pastor' ? scope : { ...scope, leaderId: id(user.sub) };
    const own = this.canManage(user) && user.branchId ? await this.access.resolveScopedBranchId(user) : undefined;
    const delegated = own ? await this.delegations.distinct('groupId', { branchId: own }) : [];
    const groups = await this.groups.find({ $or: [query, { _id: { $in: delegated } }] }).sort({ program: 1, name: 1 }).lean();
    const groupIds = groups.map(({ _id }) => _id);
    const [counts, sessionCounts, visibleBranches] = await Promise.all([
      this.enrollments.aggregate<{ _id: { group: Types.ObjectId; state: string }; count: number }>([
        { $match: { groupId: { $in: groupIds } } },
        { $group: { _id: { group: '$groupId', state: '$state' }, count: { $sum: 1 } } },
      ]),
      this.sessions.aggregate<{ _id: Types.ObjectId; sessions: number; visits: number }>([
        { $match: { groupId: { $in: groupIds } } },
        { $group: { _id: '$groupId', sessions: { $sum: 1 }, visits: { $sum: { $size: '$present' } } } },
      ]),
      this.branches.find(await this.access.getBranchDocumentQuery(user)).select('name').sort({ name: 1 }).lean(),
    ]);
    const branchNames = new Map(visibleBranches.map(branch => [String(branch._id), branch.name]));
    return {
      canManage: this.canManage(user),
      canManageEvents: this.canManageEvents(user),
      canPreviewHome: this.canManage(user) && Boolean(user.branchId),
      pilotAvailable: this.canManage(user) && this.pilotAvailable,
      branches: this.canManageEvents(user) ? visibleBranches : [],
      groups: groups.map(group => ({
        _id: group._id, program: group.program, name: group.name,
        branchName: branchNames.get(String(group.branchId)),
        canOpen: this.managesGroup(user, group) || (!group.campEndDate && String(group.leaderId) === user.sub && Boolean(group.clearanceUntil && group.clearanceUntil >= day())),
        eventDate: group.eventDate, venue: group.venue, capacity: group.capacity,
        campEndDate: group.campEndDate,
        active: counts.find(row => String(row._id.group) === String(group._id) && row._id.state === 'active')?.count ?? 0,
        pending: counts.find(row => String(row._id.group) === String(group._id) && row._id.state === 'pending')?.count ?? 0,
        sessions: sessionCounts.find(row => String(row._id) === String(group._id))?.sessions ?? 0,
        visits: sessionCounts.find(row => String(row._id) === String(group._id))?.visits ?? 0,
      })),
    };
  }

  async homePreview(user: AuthUser) {
    if (!this.canManage(user) || !user.branchId) throw new ForbiddenException();
    const branchId = await this.access.resolveScopedBranchId(user);
    const branch = await this.branches.findById(branchId).select('name').lean();
    if (!branch) throw new NotFoundException();

    const [groups, events, delegations] = await Promise.all([
      this.groups.find({ branchId, eventDate: { $exists: false } }).select('name program youthFeedEnabled').sort({ name: 1 }).lean(),
      this.groups.find({ branchId, eventDate: { $gte: day() }, registrationToken: { $exists: true }, campEndDate: { $exists: false } })
        .select('name program venue eventDate registrationDeadline leaderId clearanceUntil branchId').sort({ eventDate: 1 }).limit(12).lean(),
      this.delegations.find({ branchId, token: { $exists: true } }).select('groupId').lean(),
    ]);
    const [activities, camps, posts] = await Promise.all([
      this.activities.find({ groupId: { $in: groups.map(group => group._id) }, kind: { $in: ['track', 'project'] },
        $or: [{ kind: 'track' }, { date: { $gte: day() } }] })
        .select('groupId kind title date location milestones').sort({ date: 1, _id: -1 }).lean(),
      this.groups.find({ _id: { $in: delegations.map(row => row.groupId) }, campEndDate: { $exists: true }, eventDate: { $gte: day() } })
        .select('name program venue eventDate campEndDate registrationDeadline leaderId clearanceUntil branchId').sort({ eventDate: 1 }).limit(12).lean(),
      this.groupPosts(groups.filter(group => group.youthFeedEnabled !== false).map(group => group._id)),
    ]);
    const upcoming = [...events, ...camps].sort((a, b) => a.eventDate!.localeCompare(b.eventDate!));
    const open = await Promise.all(upcoming.map(async event => this.registrationInTime(event) && await this.cleared(event)));
    return {
      branch: branch.name,
      posts,
      groups: groups.map(({ _id, name, program }) => ({ id: _id, name, program })),
      events: upcoming.filter((_, index) => open[index]).slice(0, 12)
        .map(({ _id, name, program, venue, eventDate, campEndDate }) => ({ id: _id, name, program, venue, date: eventDate, endDate: campEndDate })),
      tracks: activities.filter(item => item.kind === 'track').map(({ _id, title, groupId, milestones }) => ({ id: _id, title, groupId, milestones })),
      projects: activities.filter(item => item.kind === 'project').map(({ _id, title, groupId, date, location }) => ({ id: _id, title, groupId, date, location })),
    };
  }

  groupPosts(groupIds: Types.ObjectId[]) {
    return this.posts.find({ groupId: { $in: groupIds }, archivedAt: { $exists: false } })
      .select('groupId kind title body createdAt').sort({ createdAt: -1, _id: -1 }).limit(30).lean();
  }

  async saveRollout(user: AuthUser, groupId: string, dto: YouthRolloutDto) {
    const { group } = await this.developmentScope(user, groupId, true);
    await this.groups.updateOne({ _id: group._id }, { $set: {
      mentoringEmailEnabled: dto.mentoringEmailEnabled, youthFeedEnabled: dto.youthFeedEnabled,
    } });
    return { saved: true };
  }

  private mentoringConsentToken(personId: Types.ObjectId, nonce: string) {
    const secret = this.config.getOrThrow<string>('jwtSecret');
    const signature = createHmac('sha256', secret).update(
      JSON.stringify(['youth-mentoring-email', getWorkspace(this.config).id, String(personId), nonce]),
    ).digest('hex');
    return String(personId) + signature;
  }

  private mentoringConsentLink(personId: Types.ObjectId, nonce: string, unsubscribe = false) {
    return workspaceWebLink(this.config, '/youth-register/' + this.mentoringConsentToken(personId, nonce),
      { mentoring: unsubscribe ? 'off' : 'on' });
  }

  async inviteMentoringConsent(user: AuthUser, groupId: string, enrollmentId: string) {
    const { group } = await this.developmentScope(user, groupId, true);
    if (!group.mentoringEmailEnabled) throw new ForbiddenException();
    const nonce = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 86400000);
    const person = await this.enrollments.findOneAndUpdate({
      _id: id(enrollmentId), groupId: group._id, state: 'active', contact: emailAddress,
      mentoringEmailConsentAt: { $exists: false },
    }, { $set: { mentoringConsentNonce: nonce, mentoringConsentExpiresAt: expiresAt } }).select('needsGuardian').lean();
    if (!person) throw new ConflictException('An active enrollment with an email and no existing consent is required.');
    return { link: this.mentoringConsentLink(person._id, nonce), guardian: person.needsGuardian };
  }

  async setMentoringConsent(token: string | undefined, dto: YouthMentoringConsentDto, ip: string) {
    this.forms.limitPublicSubmission(ip);
    if (!token || !/^[a-f0-9]{88}$/.test(token)) throw new BadRequestException();
    const person = await this.enrollments.findById(id(token.slice(0, 24)))
      .select('groupId state +mentoringConsentNonce').lean();
    const nonce = person?.mentoringConsentNonce;
    if (!person || !nonce || !timingSafeEqual(Buffer.from(token), Buffer.from(this.mentoringConsentToken(person._id, nonce)))) {
      throw new NotFoundException();
    }
    const filter = { _id: person._id, mentoringConsentNonce: nonce };
    if (dto.enabled) {
      if (!await this.groups.exists({ _id: person.groupId, mentoringEmailEnabled: true })) throw new ForbiddenException();
      const consent = await this.enrollments.updateOne({ ...filter, state: 'active', mentoringConsentExpiresAt: { $gt: new Date() } },
        { $set: { mentoringEmailConsentAt: new Date(), mentoringEmailLocale: dto.locale }, $unset: { mentoringConsentExpiresAt: 1 } });
      if (!consent.matchedCount) throw new ConflictException();
    } else {
      await this.enrollments.updateOne(filter, { $unset: { mentoringEmailConsentAt: 1, mentoringConsentExpiresAt: 1, mentoringEmailLocale: 1 } });
    }
    return { saved: true };
  }

  async sendMentoringEmail(user: AuthUser, groupId: string, activityId: string) {
    const { group, screenedLeader } = await this.developmentScope(user, groupId, true);
    if (!group.mentoringEmailEnabled || !screenedLeader || !group.leaderId) throw new ForbiddenException();
    const query = { _id: id(activityId), groupId: group._id, kind: 'mentoring', active: true,
      mentorId: group.leaderId, permissionConfirmedAt: { $exists: true } };
    const assignment = await this.activities.findOne(query).select('enrollmentId nextCheckIn').lean();
    if (!assignment?.enrollmentId || !assignment.nextCheckIn || assignment.nextCheckIn < day()) throw new NotFoundException();
    const date = assignment.nextCheckIn;
    const person = await this.enrollments.findOne({ _id: assignment.enrollmentId, groupId: group._id, state: 'active',
      mentoringEmailConsentAt: { $exists: true }, contact: emailAddress })
      .select('+contact +mentoringConsentNonce +mentoringEmailLocale').lean();
    if (!person?.mentoringConsentNonce || !isEmail(person.contact)) throw new ConflictException('Mentoring email consent is required.');
    const claim = await this.activities.updateOne({ ...query, nextCheckIn: date, checkIns: { $ne: date }, mentoringEmailDates: { $ne: date } },
      { $addToSet: { mentoringEmailDates: date } });
    if (!claim.matchedCount) throw new ConflictException();
    const locale = person.mentoringEmailLocale && Object.hasOwn(mentoringCopy, person.mentoringEmailLocale)
      ? person.mentoringEmailLocale as keyof typeof mentoringCopy : 'en';
    const [subject, message, optOut] = mentoringCopy[locale];
    const formattedDate = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(date));
    let result;
    try {
      result = await this.mail.sendAppEmail({ to: person.contact, subject,
        text: [getWorkspace(this.config).name, `${message} ${formattedDate}.`,
          `${optOut}: ${this.mentoringConsentLink(person._id, person.mentoringConsentNonce, true)}`].join('\n'),
        idempotencyKey: `youth-mentoring-${assignment._id}-${date}` });
    } catch { throw new ServiceUnavailableException(); }
    if (!result.delivered) {
      await this.activities.updateOne({ _id: assignment._id }, { $pull: { mentoringEmailDates: date } });
      throw new ServiceUnavailableException();
    }
    return { accepted: true };
  }

  async publishPost(user: AuthUser, groupId: string, dto: YouthPostDto) {
    const { group } = await this.developmentScope(user, groupId, true);
    const post = await this.posts.create({ groupId: group._id, createdBy: id(user.sub),
      kind: dto.kind, title: dto.title.trim(), body: dto.body.trim() });
    return { id: post.id };
  }

  async archivePost(user: AuthUser, groupId: string, postId: string) {
    const { group } = await this.developmentScope(user, groupId, true);
    const post = await this.posts.updateOne({ _id: id(postId), groupId: group._id, archivedAt: { $exists: false } },
      { $set: { archivedAt: new Date() } });
    if (!post.matchedCount) throw new NotFoundException();
    return { saved: true };
  }

  async inviteParticipant(user: AuthUser, groupId: string, enrollmentId: string, dto: YouthParticipantInviteDto) {
    const { group } = await this.developmentScope(user, groupId, true);
    const person = await this.enrollments.findOne({ _id: id(enrollmentId), groupId: group._id, state: 'active' }).lean();
    if (!person) throw new NotFoundException();
    const email = dto.email.trim().toLowerCase();
    const token = randomBytes(32).toString('hex');
    const passwordResetToken = createHash('sha256').update(token).digest('hex');
    const passwordResetExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    try {
      await this.users.create({ email, password: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
        firstName: person.firstName, lastName: person.lastName, role: 'youth_participant',
        branchId: group.branchId, youthEnrollmentId: person._id, passwordResetToken, passwordResetExpiresAt });
    } catch (error) {
      if (duplicate(error)) throw new ConflictException('This email or enrollment already has an account.');
      throw error;
    }
    return { invitation: workspaceWebLink(this.config, '/reset-password', { token }), expiresAt: passwordResetExpiresAt };
  }

  private async participantEnrollment(user: AuthUser) {
    const account = await this.users.findOne({ _id: id(user.sub), isActive: true, role: 'youth_participant' }).select('+youthEnrollmentId branchId').lean();
    if (!account?.youthEnrollmentId || !account.branchId) throw new ForbiddenException();
    const person = await this.enrollments.findOne({ _id: account.youthEnrollmentId, branchId: account.branchId, state: 'active' })
      .select('+birthDate +registrationKey').lean();
    if (!person) throw new ForbiddenException();
    return person;
  }

  async participantHome(user: AuthUser) {
    const person = await this.participantEnrollment(user);
    const [group, branch, activities, events, delegations, registrations, posts] = await Promise.all([
      this.groups.findOne({ _id: person.groupId, branchId: person.branchId, eventDate: { $exists: false } }).select('name program branchId leaderId clearanceUntil youthFeedEnabled').lean(),
      this.branches.findById(person.branchId).select('name').lean(),
      this.activities.find({ groupId: person.groupId, kind: { $in: ['track', 'project'] } })
        .select('kind title date location milestones').sort({ date: 1 }).lean(),
      this.groups.find({ branchId: person.branchId, eventDate: { $gte: day() }, campEndDate: { $exists: false } }).select('+registrationToken').sort({ eventDate: 1 }).limit(40).lean(),
      this.delegations.find({ branchId: person.branchId }).select('+token').lean(),
      this.enrollments.find({ branchId: person.branchId, registrationKey: person.registrationKey, groupId: { $ne: person.groupId } }).select('groupId state').lean(),
      this.groupPosts([person.groupId]),
    ]);
    if (!group || !branch) throw new ForbiddenException();
    const assignment = group.leaderId && await this.cleared(group) ? await this.activities.findOne({
      groupId: group._id, enrollmentId: person._id, kind: 'mentoring', active: true, mentorId: group.leaderId,
      permissionConfirmedAt: { $exists: true }, nextCheckIn: { $exists: true },
    }).select('nextCheckIn participantNextStep checkIns').lean() : null;
    const reminder = assignment?.nextCheckIn && !assignment.checkIns?.includes(assignment.nextCheckIn)
      ? { date: assignment.nextCheckIn, nextStep: assignment.participantNextStep } : undefined;
    const camps = await this.groups.find({ _id: { $in: delegations.map(item => item.groupId) }, eventDate: { $gte: day() }, campEndDate: { $exists: true } }).sort({ eventDate: 1 }).limit(40).lean();
    const progress = await this.progress.find({ enrollmentId: person._id, activityId: { $in: activities.map(item => item._id) } })
      .select('activityId completed signedUpAt serviceMinutes').lean();
    const personalProgress = new Map(progress.map(record => [String(record.activityId), record]));
    const serviceHistory = activities.filter(item => item.kind === 'project').flatMap(item => {
      const record = personalProgress.get(String(item._id));
      return record?.completed.includes(0) && record.serviceMinutes
        ? [{ id: item._id, title: item.title, date: item.date, minutes: record.serviceMinutes }] : [];
    }).reverse();
    const states = new Map(registrations.map(item => [String(item.groupId), item.state]));
    const rows = await Promise.all([...events, ...camps].map(async event => {
      const token = event.campEndDate ? delegations.find(item => item.groupId.equals(event._id))?.token : event.registrationToken;
      const state = states.get(String(event._id));
      const date = event.eventDate!;
      const age = Number(date.slice(0, 4)) - Number(person.birthDate.slice(0, 4)) - (date.slice(5) < person.birthDate.slice(5) ? 1 : 0);
      if (!state && (age < event.minAge || age > event.maxAge || !token || !this.registrationInTime(event) || !await this.cleared(event))) return null;
      return { id: event._id, name: event.name, date: event.eventDate, endDate: event.campEndDate, venue: event.venue, state,
        registrationUrl: !state && token ? workspaceWebLink(this.config, '/youth-register/' + token) : undefined };
    }));
    return {
      posts: group.youthFeedEnabled === false ? [] : posts,
      serviceHistory,
      mentoringReminder: reminder,
      branch: branch.name, groups: [{ id: group._id, name: group.name, program: group.program }],
      events: rows.filter(row => row !== null).sort((a, b) => a.date!.localeCompare(b.date!)),
      tracks: activities.filter(item => item.kind === 'track').map(item => ({ id: item._id, title: item.title,
        groupId: group._id, milestones: item.milestones, completed: personalProgress.get(String(item._id))?.completed ?? [] })),
      projects: activities.filter(item => item.kind === 'project' && item.date && item.date >= day()).map(item => ({
        id: item._id, title: item.title, groupId: group._id, date: item.date, location: item.location,
        signedUp: Boolean(personalProgress.get(String(item._id))?.signedUpAt) })),
    };
  }

  async participantServe(user: AuthUser, activityId: string) {
    const person = await this.participantEnrollment(user);
    const activity = await this.activities.findOne({ _id: id(activityId), groupId: person.groupId, kind: 'project', date: { $gte: day() } }).select('_id').lean();
    if (!activity) throw new NotFoundException();
    try {
      await this.progress.updateOne({ activityId: activity._id, enrollmentId: person._id },
        { $set: { signedUpAt: new Date() }, $setOnInsert: { completed: [] } }, { upsert: true });
    } catch (error) {
      if (!duplicate(error)) throw error;
      await this.progress.updateOne({ activityId: activity._id, enrollmentId: person._id }, { $set: { signedUpAt: new Date() } });
    }
    return { saved: true };
  }

  async reports(user: AuthUser) {
    if (!this.canManageEvents(user)) throw new ForbiddenException();
    const branches = await this.branches.find(await this.access.getBranchDocumentQuery(user)).select('name').sort({ name: 1 }).lean();
    const branchIds = branches.map(branch => branch._id);
    const [followUps, attendance, tracks, engagement] = await Promise.all([
      this.enrollments.aggregate<{ _id: Types.ObjectId; open: number; closed: number; overdue: number }>([
        { $match: { branchId: { $in: branchIds }, 'campFollowUp.outcome': { $exists: true } } },
        { $group: { _id: '$branchId',
          open: { $sum: { $cond: [{ $and: [{ $eq: ['$state', 'active'] }, { $eq: ['$campFollowUp.outcome', 'open'] }] }, 1, 0] } },
          closed: { $sum: { $cond: [{ $ne: ['$campFollowUp.outcome', 'open'] }, 1, 0] } },
          overdue: { $sum: { $cond: [{ $and: [{ $eq: ['$state', 'active'] }, { $eq: ['$campFollowUp.outcome', 'open'] }, { $lt: ['$campFollowUp.dueDate', day()] }] }, 1, 0] } },
        } },
      ]),
      this.enrollments.aggregate<{ _id: Types.ObjectId; checkIns: number; returned: number }>([
        { $match: { branchId: { $in: branchIds } } },
        { $lookup: { from: this.groups.collection.name, localField: 'groupId', foreignField: '_id', as: 'group' } },
        { $match: { 'group.eventDate': { $exists: true } } },
        { $lookup: { from: this.sessions.collection.name, localField: 'groupId', foreignField: 'groupId',
          let: { participant: '$_id' }, pipeline: [{ $match: { $expr: { $in: ['$$participant', '$present'] } } }, { $project: { _id: 1 } }], as: 'visits' } },
        { $match: { 'visits.0': { $exists: true } } },
        { $group: { _id: { branch: '$branchId', key: '$registrationKey' }, events: { $addToSet: '$groupId' }, checkIns: { $sum: { $size: '$visits' } } } },
        { $group: { _id: '$_id.branch', checkIns: { $sum: '$checkIns' }, returned: { $sum: { $cond: [{ $gt: [{ $size: '$events' }, 1] }, 1, 0] } } } },
      ]),
      this.enrollments.aggregate<{ _id: Types.ObjectId; started: number }>([
        { $match: { branchId: { $in: branchIds } } },
        { $lookup: { from: this.progress.collection.name, localField: '_id', foreignField: 'enrollmentId',
          pipeline: [{ $match: { 'completed.0': { $exists: true } } },
            { $lookup: { from: this.activities.collection.name, localField: 'activityId', foreignField: '_id', as: 'activity' } },
            { $match: { 'activity.kind': 'track' } }, { $limit: 1 }], as: 'tracks' } },
        { $match: { 'tracks.0': { $exists: true } } },
        { $group: { _id: '$branchId', started: { $sum: 1 } } },
      ]),
      this.enrollments.aggregate<{ _id: Types.ObjectId; signedIn: number; completedTracks: number; serviceSignups: number; serviceMinutes: number }>([
        { $match: { branchId: { $in: branchIds } } },
        { $lookup: { from: this.users.collection.name, localField: '_id', foreignField: 'youthEnrollmentId',
          pipeline: [{ $match: { role: 'youth_participant', isActive: true, lastLoginAt: { $type: 'date' } } }, { $project: { _id: 1 } }], as: 'accounts' } },
        { $lookup: { from: this.progress.collection.name, localField: '_id', foreignField: 'enrollmentId',
          pipeline: [
            { $lookup: { from: this.activities.collection.name, localField: 'activityId', foreignField: '_id', as: 'activity' } },
            { $unwind: '$activity' },
            { $group: { _id: null,
              completedTracks: { $sum: { $cond: [{ $and: [{ $eq: ['$activity.kind', 'track'] }, { $gt: [{ $size: { $ifNull: ['$activity.milestones', []] } }, 0] },
                { $setIsSubset: [{ $range: [0, { $size: { $ifNull: ['$activity.milestones', []] } }] }, { $ifNull: ['$completed', []] }] } ] }, 1, 0] } },
              serviceSignups: { $sum: { $cond: [{ $and: [{ $eq: ['$activity.kind', 'project'] }, { $eq: [{ $type: '$signedUpAt' }, 'date'] }] }, 1, 0] } },
              serviceMinutes: { $sum: { $cond: [{ $and: [{ $eq: ['$activity.kind', 'project'] }, { $in: [0, { $ifNull: ['$completed', []] }] }] }, { $ifNull: ['$serviceMinutes', 0] }, 0] } },
            } },
          ], as: 'engagement' } },
        { $group: { _id: '$branchId',
          signedIn: { $sum: { $cond: [{ $eq: ['$state', 'active'] }, { $size: '$accounts' }, 0] } },
          completedTracks: { $sum: { $sum: '$engagement.completedTracks' } },
          serviceSignups: { $sum: { $sum: '$engagement.serviceSignups' } },
          serviceMinutes: { $sum: { $sum: '$engagement.serviceMinutes' } },
        } },
      ]),
    ]);
    return branches.map(branch => {
      const tasks = followUps.find(row => row._id.equals(branch._id));
      const visits = attendance.find(row => row._id.equals(branch._id));
      const activity = engagement.find(row => row._id.equals(branch._id));
      return { branchId: branch._id, name: branch.name, open: tasks?.open ?? 0, overdue: tasks?.overdue ?? 0,
        closed: tasks?.closed ?? 0, checkIns: visits?.checkIns ?? 0, returned: visits?.returned ?? 0,
        started: tracks.find(row => row._id.equals(branch._id))?.started ?? 0,
        signedIn: activity?.signedIn ?? 0, completedTracks: activity?.completedTracks ?? 0,
        serviceSignups: activity?.serviceSignups ?? 0, serviceMinutes: activity?.serviceMinutes ?? 0 };
    });
  }

  async createGroup(user: AuthUser, dto: YouthGroupDto) {
    const branchId = await this.manageBranch(user, dto.branchId);
    return this.saveGroup(branchId, dto);
  }

  async createEvent(user: AuthUser, dto: YouthEventDto) {
    const branchId = await this.manageBranch(user, dto.branchId, true);
    if (dto.registrationDeadline < day() || dto.registrationDeadline > dto.eventDate) {
      throw new BadRequestException('Choose a registration deadline between today and the event date.');
    }
    return this.saveGroup(branchId, { ...dto, districtManaged: !this.canManage(user), venue: dto.venue.trim(), meetingDay: new Date(dto.eventDate).getUTCDay() });
  }

  async createCamp(user: AuthUser, dto: YouthCampDto) {
    const branchId = await this.manageBranch(user, dto.branchId, true);
    if (dto.registrationDeadline < day() || dto.registrationDeadline > dto.eventDate || dto.campEndDate < dto.eventDate ||
        Date.parse(dto.campEndDate) - Date.parse(dto.eventDate) > 30 * 86400000 ||
        dto.depositMinor > dto.feeMinor || !Intl.supportedValuesOf('currency').includes(dto.currency)) throw new BadRequestException();
    return this.saveGroup(branchId, { ...dto, districtManaged: !this.canManage(user), venue: dto.venue.trim(), meetingDay: new Date(dto.eventDate).getUTCDay() });
  }

  private async saveGroup(branchId: Types.ObjectId, dto: YouthGroupDto & Partial<Pick<YouthGroup, 'eventDate' | 'registrationDeadline' | 'venue' | 'capacity' | 'districtManaged' | 'campEndDate' | 'currency' | 'feeMinor' | 'depositMinor'>>) {
    if (dto.maxAge < dto.minAge) throw new BadRequestException('Check the program age range.');
    const { program, name } = dto;
    const key = createHash('sha256').update(JSON.stringify([program.trim().toLowerCase(), name.trim().toLowerCase(), ...(dto.eventDate ? [dto.eventDate] : [])])).digest('hex');
    try {
      const group = await this.groups.create({ ...dto, branchId, key, program: program.trim(), name: name.trim() });
      return { id: group.id };
    } catch (error) {
      if (duplicate(error)) throw new ConflictException('This group already exists.');
      throw error;
    }
  }

  async seedPilot(user: AuthUser, requestedBranchId: string) {
    if (!this.pilotAvailable) throw new NotFoundException();
    const branchId = await this.manageBranch(user, requestedBranchId);
    const presets = [
      { key: 'pilot-teens', program: 'Teens Church', name: 'Teens Church', minAge: 13, maxAge: 17 },
      { key: 'pilot-youth-alive', program: 'Youth Alive', name: 'Youth Alive Fellowship', minAge: 18, maxAge: 35 },
    ];
    for (const preset of presets) {
      try {
        await this.groups.updateOne({ branchId, key: preset.key },
          { $setOnInsert: { ...preset, branchId, meetingDay: 0, guardianUnderAge: 18 } }, { upsert: true });
      } catch (error) {
        if (!duplicate(error)) throw error;
      }
    }
    return { created: true };
  }

  async groupSettings(user: AuthUser, groupId: string, dto: YouthGroupSettingsDto) {
    const group = await this.scopedGroup(user, groupId, true);
    if (group.eventDate) throw new BadRequestException('Event settings are fixed after creation.');
    if (dto.maxAge < dto.minAge) throw new BadRequestException('Check the program age range.');
    const eligibilityChanged = dto.minAge !== group.minAge || dto.maxAge !== group.maxAge || dto.guardianUnderAge !== group.guardianUnderAge;
    if (eligibilityChanged && await this.enrollments.exists({ groupId: group._id })) {
      throw new ConflictException('Create a new group to change eligibility once registrations exist.');
    }
    const saved = await this.groups.updateOne({
      _id: group._id, ...(eligibilityChanged ? { registrationToken: { $exists: false } } : {}),
    }, { $set: { ...dto, name: dto.name.trim(), program: dto.program.trim() } });
    if (!saved.matchedCount) throw new ConflictException('Close registration before changing eligibility.');
    return { saved: true };
  }

  async details(user: AuthUser, groupId: string, date = day(), attendanceOnly = false) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException();
    const group = await this.scopedGroup(user, groupId);
    if (group.campEndDate) throw new NotFoundException();
    date = group.eventDate ?? date;
    const manager = this.managesGroup(user, group);
    const showRegistration = manager && !attendanceOnly;
    const showFollowUp = Boolean(group.eventDate && showRegistration && this.canManage(user));
    const [people, session, leaders, link, recentSessions, cleared, destinations, followUpOwners] = await Promise.all([
      this.enrollments.find({ groupId: group._id, state: showRegistration ? { $in: ['active', 'pending'] } : 'active' })
        .select(showRegistration ? '+guardianName +contact +birthDate +customAnswers' + (showFollowUp ? ' +campFollowUp +guardianEmailOptIn +guardianReminderStatus' : '') : 'firstName lastName state welcomedAt').sort({ firstName: 1, lastName: 1 }).lean(),
      this.sessions.findOne({ groupId: group._id, date }).lean(),
      showRegistration ? this.users.find({ branchId: group.branchId, isActive: true, role: { $in: leaderRoles } }).select('firstName lastName').sort({ firstName: 1 }).lean() : [],
      showRegistration ? this.groups.findById(group._id).select('+registrationToken').lean() : null,
      this.sessions.find({ groupId: group._id }).sort({ date: -1 }).limit(12).lean(),
      this.cleared(group),
      showRegistration && !group.eventDate ? this.groups.find({ branchId: group.branchId, eventDate: { $exists: false }, _id: { $ne: group._id } }).select('name minAge maxAge guardianUnderAge').sort({ name: 1 }).lean() : [],
      showFollowUp ? this.followUpOwners(group.branchId) : undefined,
    ]);
    return {
      group, manager, date, people, leaders, destinations, canRecord: cleared,
      registrationAvailable: cleared && this.registrationInTime(group),
      registrationToken: link?.registrationToken ?? null,
      present: session?.present ?? [],
      followUpOwners, attendanceRecorded: showFollowUp && Boolean(session),
      recentSessions: recentSessions.map(({ date, present }) => ({ date, count: present.length })),
    };
  }

  async assign(user: AuthUser, groupId: string, dto: YouthLeaderDto) {
    const group = await this.scopedGroup(user, groupId, true);
    if (dto.clearanceUntil < day()) throw new BadRequestException('The screening must still be valid.');
    if (!await this.users.exists({ _id: id(dto.leaderId), branchId: group.branchId, isActive: true, role: { $in: leaderRoles } })) throw new BadRequestException('Choose an active staff member from this branch.');
    await this.groups.updateOne({ _id: group._id }, {
      leaderId: dto.leaderId, clearanceUntil: dto.clearanceUntil, clearanceVerifiedBy: user.sub, clearanceVerifiedAt: new Date(),
    });
    return { saved: true };
  }

  private async cleared(group: YouthGroup) {
    return Boolean(group.leaderId && group.clearanceUntil && group.clearanceUntil >= day() &&
      await this.users.exists({ _id: group.leaderId, branchId: group.branchId, isActive: true, role: { $in: leaderRoles } }));
  }

  async registrationLink(user: AuthUser, groupId: string, enable: boolean) {
    const group = await this.scopedGroup(user, groupId, true);
    if (group.campEndDate) throw new NotFoundException();
    if (enable && !await this.cleared(group)) throw new ForbiddenException('Assign a screened group leader with current clearance first.');
    if (enable && !this.registrationInTime(group)) throw new BadRequestException('Registration has closed or screening expires before the event.');
    await this.groups.updateOne({ _id: group._id, ...(enable ? { registrationToken: { $exists: false } } : {}) }, enable
      ? { $set: { registrationToken: randomBytes(24).toString('hex') } }
      : { $unset: { registrationToken: 1 } });
    return { saved: true };
  }

  private registrationInTime(group: YouthGroup) {
    return !group.eventDate || Boolean(group.registrationDeadline && group.registrationDeadline >= day() &&
      group.clearanceUntil && group.clearanceUntil >= (group.campEndDate ?? group.eventDate));
  }

  private async publicGroup(token: string) {
    await this.forms.assertPublicEnabled();
    if (!/^[a-f0-9]{48}$/.test(token ?? '')) throw new NotFoundException();
    const delegation = await this.delegations.findOne({ token }).lean();
    const group = await this.groups.findOne(delegation ? { _id: delegation.groupId, campEndDate: { $exists: true } } :
      { registrationToken: token, campEndDate: { $exists: false } }).lean();
    if (!group || !this.registrationInTime(group) || !await this.cleared(group)) throw new NotFoundException();
    return { group, branchId: delegation?.branchId ?? group.branchId };
  }

  async publicInfo(token: string) {
    const { group: { name, program, minAge, maxAge, guardianUnderAge, eventDate, venue, registrationDeadline, campEndDate, currency, feeMinor, depositMinor }, branchId } = await this.publicGroup(token);
    const branch = campEndDate ? await this.branches.findById(branchId).select('name').lean() : null;
    return { name, program, minAge, maxAge, guardianUnderAge, eventDate, venue, registrationDeadline, campEndDate, currency, feeMinor,
      depositMinor, branchName: branch?.name, consentVersion: 1, form: await this.forms.publicForm(MinistryFormKind.Youth) };
  }

  async register(token: string, dto: YouthRegistrationDto, ip: string) {
    this.forms.limitPublicSubmission(ip);
    const { group, branchId } = await this.publicGroup(token);
    const customAnswers = await this.forms.prepare(MinistryFormKind.Youth, dto, undefined, 'public');
    const enrollment = this.enrollmentData(group, dto);
    const optIn = dto.guardianEmailOptIn === true;
    if (optIn && (!group.eventDate || !enrollment.needsGuardian || !emailAddress.test(enrollment.contact) || !isEmail(enrollment.contact))) {
      throw new BadRequestException('Guardian reminders require a guardian email address for an event.');
    }
    try {
      await this.enrollments.create({ ...enrollment, branchId, customAnswers, guardianEmailOptIn: optIn,
        ...(group.campEndDate ? { transportConsent: dto.transportConsent === true } : {}) });
    } catch (error) {
      if (!duplicate(error)) throw error;
    }
    return { received: true };
  }

  private enrollmentData(group: YouthGroup & { _id: Types.ObjectId }, dto: Pick<YouthRegistrationDto, 'firstName' | 'lastName' | 'birthDate' | 'contact' | 'guardianName' | 'consentVersion' | 'locale'>) {
    const today = day();
    const ageAt = (date: string) => Number(date.slice(0, 4)) - Number(dto.birthDate.slice(0, 4)) - (date.slice(5) < dto.birthDate.slice(5) ? 1 : 0);
    const ageAtEvent = ageAt(group.eventDate ?? today);
    if (dto.birthDate > today || ageAtEvent < group.minAge || ageAtEvent > group.maxAge) throw new BadRequestException('The participant is outside this group’s age range.');
    const needsGuardian = ageAt(today) < group.guardianUnderAge;
    if (needsGuardian && !dto.guardianName) throw new BadRequestException('A guardian must complete this registration.');
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    const contact = dto.contact.trim();
    const digits = contact.replace(/[^\d]/g, '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) && !(/^[+\d\s().-]+$/.test(contact) && digits.length >= 7 && digits.length <= 15)) {
      throw new BadRequestException('Enter an email address or phone number.');
    }
    const registrationKey = createHash('sha256')
      .update(JSON.stringify([firstName.toLowerCase(), lastName.toLowerCase(), dto.birthDate, contact.includes('@') ? contact.toLowerCase() : digits]))
      .digest('hex');
    return {
      groupId: group._id, branchId: group.branchId, firstName, lastName, birthDate: dto.birthDate, contact,
      registrationKey, needsGuardian, guardianName: needsGuardian ? dto.guardianName?.trim() : undefined,
      consentVersion: dto.consentVersion, consentLocale: dto.locale, consentAt: new Date(),
    };
  }

  async transition(user: AuthUser, groupId: string, enrollmentId: string, dto: YouthTransitionDto) {
    const sourceGroup = await this.scopedGroup(user, groupId, true);
    if (sourceGroup.eventDate) throw new BadRequestException('Use the regular group roster for transitions.');
    const destination = await this.groups.findOne({
      $and: [{ _id: id(dto.destinationId) }, { _id: { $ne: sourceGroup._id } }], branchId: sourceGroup.branchId, eventDate: { $exists: false },
    }).lean();
    if (!destination) throw new NotFoundException();
    if (!await this.cleared(destination)) throw new ForbiddenException('Assign a screened leader to the receiving group first.');
    const source = await this.enrollments.findOne({ _id: id(enrollmentId), groupId: sourceGroup._id, state: 'active' })
      .select('firstName lastName memberId childId +birthDate +linkedEnrollmentId').lean();
    if (!source) throw new NotFoundException();
    const enrollment = this.enrollmentData(destination, { ...dto, firstName: source.firstName, lastName: source.lastName, birthDate: source.birthDate });
    try {
      await this.enrollments.create({
        ...enrollment, memberId: source.memberId, childId: source.childId, linkedEnrollmentId: source.linkedEnrollmentId ?? source._id,
        consentSource: 'staff', state: 'active', reviewedBy: user.sub, reviewedAt: new Date(),
      });
    } catch (error) {
      if (duplicate(error)) throw new ConflictException('This person already has a place in the group.');
      throw error;
    }
    return { saved: true };
  }

  async matches(user: AuthUser, groupId: string, enrollmentId: string) {
    const group = await this.scopedGroup(user, groupId, true);
    if (group.campEndDate) throw new NotFoundException();
    const record = await this.enrollments.findOne({ _id: id(enrollmentId), groupId: group._id, state: 'pending' }).select('+birthDate').lean();
    if (!record) throw new NotFoundException();
    const query = { branchId: group.branchId, firstName: record.firstName, lastName: record.lastName };
    const [members, children] = await Promise.all([
      this.members.find(query).collation({ locale: 'en', strength: 2 }).select('firstName lastName').limit(8).lean(),
      this.children.find({ ...query, birthDate: record.birthDate, isActive: true }).collation({ locale: 'en', strength: 2 }).select('firstName lastName').limit(8).lean(),
    ]);
    return { members, children };
  }

  async review(user: AuthUser, groupId: string, enrollmentId: string, dto: YouthReviewDto) {
    const group = await this.scopedGroup(user, groupId, true);
    if (group.campEndDate) throw new NotFoundException();
    return this.reviewEnrollment(user, group, enrollmentId, dto);
  }

  private async reviewEnrollment(user: AuthUser, group: YouthGroup & { _id: Types.ObjectId }, enrollmentId: string, dto: YouthReviewDto, branchId?: Types.ObjectId) {
    const query = { _id: id(enrollmentId), groupId: group._id, state: 'pending', ...(branchId ? { branchId } : {}) };
    const record = await this.enrollments.findOne(query).select('+birthDate').lean();
    if (!record) throw new NotFoundException();
    if (dto.state === 'active' && record.needsGuardian && dto.guardianVerified !== true) {
      throw new BadRequestException('Confirm the guardian’s permission before approving.');
    }
    const end = group.campEndDate ?? group.eventDate;
    if (dto.state === 'active' && end && (end < day() || !group.clearanceUntil || group.clearanceUntil < end || !await this.cleared(group))) {
      throw new ForbiddenException('Event approval requires an upcoming event and a screened leader.');
    }
    if (dto.memberId && dto.childId) throw new BadRequestException('Choose one existing record.');
    if (dto.memberId || dto.childId) {
      if (group.campEndDate) throw new BadRequestException();
      const options = await this.matches(user, String(group._id), enrollmentId);
      const choices = dto.memberId ? options.members : options.children;
      if (!choices.some(option => String(option._id) === (dto.memberId ?? dto.childId))) throw new BadRequestException('Choose a matching record in this branch.');
    }
    try {
      const change = { state: dto.state, memberId: dto.memberId, childId: dto.childId, reviewedBy: user.sub, reviewedAt: new Date() };
      if (dto.state === 'active' && group.capacity) await this.approveEventSeat(query, change, group.capacity);
      else if (!(await this.enrollments.updateOne(query, { $set: change })).modifiedCount) throw new ConflictException();
    } catch (error) {
      if (duplicate(error)) throw new ConflictException('This person already has a place in the group.');
      throw error;
    }
    return { saved: true };
  }

  private async approveEventSeat(query: { _id: Types.ObjectId; groupId: Types.ObjectId; state: string }, change: object, capacity: number) {
    await this.enrollments.init();
    const occupied = new Set(await this.enrollments.distinct('eventSeat', { groupId: query.groupId, state: 'active' }));
    for (let seat = 1; seat <= capacity; seat++) {
      if (occupied.has(seat)) continue;
      try {
        const saved = await this.enrollments.updateOne(query, { $set: { ...change, eventSeat: seat } });
        if (!saved.modifiedCount) throw new ConflictException();
        return;
      } catch (error) {
        if (!duplicate(error) || !(error as { keyPattern?: { eventSeat?: number } }).keyPattern?.eventSeat) throw error;
      }
    }
    throw new ConflictException({ code: 'youth_event_full', message: 'This event is full. The registration remains pending.' });
  }

  async attendance(user: AuthUser, groupId: string, dto: YouthAttendanceDto) {
    const group = await this.scopedGroup(user, groupId);
    if (group.campEndDate) throw new NotFoundException();
    return this.recordAttendance(group, dto);
  }

  private async recordAttendance(group: YouthGroup & { _id: Types.ObjectId }, dto: YouthAttendanceDto, branchId?: Types.ObjectId) {
    if (!await this.cleared(group)) throw new ForbiddenException('Assign a screened group leader with current clearance first.');
    if (group.eventDate && (dto.date < group.eventDate || dto.date > (group.campEndDate ?? group.eventDate))) throw new BadRequestException('Use the event dates for attendance.');
    if (dto.date > day()) throw new BadRequestException('Attendance cannot be entered for a future date.');
    const enrollmentId = id(dto.enrollmentId);
    if (!await this.enrollments.exists({ _id: enrollmentId, groupId: group._id, state: 'active', ...(branchId ? { branchId } : {}) })) throw new NotFoundException();
    const query = { groupId: group._id, date: dto.date };
    if (!dto.present) await this.sessions.updateOne(query, { $pull: { present: enrollmentId } });
    else {
      try {
        await this.sessions.updateOne(query, { $addToSet: { present: enrollmentId } }, { upsert: true });
      } catch (error) {
        if (!duplicate(error)) throw error;
        await this.sessions.updateOne(query, { $addToSet: { present: enrollmentId } });
      }
    }
    return { saved: true };
  }

  async withdraw(user: AuthUser, groupId: string, enrollmentId: string) {
    const group = await this.scopedGroup(user, groupId, true);
    if (group.campEndDate) throw new NotFoundException();
    const saved = await this.enrollments.updateOne({ _id: id(enrollmentId), groupId: group._id, state: 'active' },
      { $set: { state: 'withdrawn', withdrawnBy: user.sub, withdrawnAt: new Date() } });
    if (!saved.modifiedCount) throw new NotFoundException();
    return { saved: true };
  }

  async welcome(user: AuthUser, groupId: string, enrollmentId: string) {
    const group = await this.scopedGroup(user, groupId);
    if (group.campEndDate) throw new NotFoundException();
    const saved = await this.enrollments.updateOne({ _id: id(enrollmentId), groupId: group._id, state: 'active', welcomedAt: { $exists: false } },
      { $set: { welcomedAt: new Date() } });
    return { saved: saved.modifiedCount === 1 };
  }

  private async campScope(user: AuthUser, groupId: string) {
    const group = await this.groups.findOne({ _id: id(groupId), campEndDate: { $exists: true } }).lean();
    if (!group) throw new NotFoundException();
    const branches = await this.access.getAccessibleBranchObjectIds(user);
    const canReach = (branchId: Types.ObjectId) => branches === null || branches.some(branch => String(branch) === String(branchId));
    const coordinator = this.managesGroup(user, group) && canReach(group.branchId);
    const delegations = await this.delegations.find({ groupId: group._id }).lean();
    const local = this.canManage(user) ? delegations.filter(row => canReach(row.branchId)) : [];
    if (!coordinator && !local.length) throw new ForbiddenException();
    return { group, coordinator, delegations, local };
  }

  private async campBranch(user: AuthUser, groupId: string, branchId: string) {
    const scope = await this.campScope(user, groupId);
    const branch = scope.local.find(row => String(row.branchId) === branchId);
    if (!branch) throw new ForbiddenException();
    return { ...scope, branch };
  }

  private async campBranchOptions(user: AuthUser, group: YouthGroup) {
    const host = await this.branches.findById(group.branchId).select('district oversightRegion').lean();
    const scope = await this.access.getBranchDocumentQuery(user);
    const district = host?.district && host?.oversightRegion ?
      { district: host.district, oversightRegion: host.oversightRegion } : { _id: group.branchId };
    return this.branches.find({ $and: [scope, district] }).select('name').sort({ name: 1 }).lean();
  }

  async campOverview(user: AuthUser, groupId: string, requested?: string, selectedDate?: string) {
    const { group, coordinator, delegations, local } = await this.campScope(user, groupId);
    const available = coordinator ? delegations : local;
    const selected = requested ? local.find(row => String(row.branchId) === requested) : local.length === 1 && !coordinator ? local[0] : undefined;
    if (requested && !selected) throw new ForbiddenException();
    const date = selectedDate ?? group.eventDate!;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < group.eventDate! || date > group.campEndDate!) throw new BadRequestException();
    const finance = Boolean(selected && this.campFinanceRole(user));
    const [branches, options, totals, people, session, link, leaders, screened, followUpOwners] = await Promise.all([
      this.branches.find({ _id: { $in: available.map(row => row.branchId) } }).select('name').lean(),
      coordinator ? this.campBranchOptions(user, group) : [],
      this.enrollments.aggregate<{ _id: { branch: Types.ObjectId; state: string }; count: number; guardians: number }>([
        { $match: { groupId: group._id, branchId: { $in: available.map(row => row.branchId) } } },
        { $group: { _id: { branch: '$branchId', state: '$state' }, count: { $sum: 1 }, guardians: { $sum: { $cond: ['$needsGuardian', 1, 0] } } } },
      ]),
      selected ? this.enrollments.find({ groupId: group._id, branchId: selected.branchId })
        .select('+guardianName +contact +transportConsent +campTransport +campRoom +campFollowUp +guardianEmailOptIn +guardianReminderStatus' + (finance ? ' +campPaid +campScholarship +campFinanceRevision +campLedger' : ''))
        .sort({ firstName: 1, lastName: 1 }).lean() : [],
      selected ? this.sessions.findOne({ groupId: group._id, date }).lean() : null,
      selected ? this.delegations.findById(selected._id).select('+token').lean() : null,
      coordinator ? this.users.find({ branchId: group.branchId, isActive: true, role: { $in: leaderRoles } }).select('firstName lastName').sort({ firstName: 1 }).lean() : [],
      this.cleared(group),
      selected ? this.followUpOwners(selected.branchId) : [],
    ]);
    const ownIds = new Set(people.map(person => String(person._id)));
    const localBranches = new Set(local.map(row => String(row.branchId)));
    return {
      group, coordinator, options, leaders, date, people, finance, screened, followUpOwners, attendanceRecorded: Boolean(session),
      registrationAvailable: screened && this.registrationInTime(group),
      token: link?.token ?? null, selectedBranch: selected?.branchId,
      present: (session?.present ?? []).filter(person => ownIds.has(String(person))),
      branches: branches.map(branch => {
        const rows = totals.filter(row => String(row._id.branch) === String(branch._id));
        return { _id: branch._id, name: branch.name, local: localBranches.has(String(branch._id)),
          approved: rows.find(row => row._id.state === 'active')?.count ?? 0,
          pending: rows.find(row => row._id.state === 'pending')?.count ?? 0,
          guardianPending: rows.find(row => row._id.state === 'pending')?.guardians ?? 0 };
      }),
    };
  }

  async campFollowUp(user: AuthUser, groupId: string, branchId: string, personId: string, dto: YouthCampFollowUpDto) {
    const { group, branch } = await this.campBranch(user, groupId, branchId);
    return this.saveEventFollowUp(user, group, branch.branchId, personId, dto);
  }

  async eventFollowUp(user: AuthUser, groupId: string, personId: string, dto: YouthCampFollowUpDto) {
    const group = await this.scopedGroup(user, groupId, true);
    if (!group.eventDate || group.campEndDate) throw new NotFoundException();
    if (!this.canManage(user)) throw new ForbiddenException();
    return this.saveEventFollowUp(user, group, group.branchId, personId, dto);
  }

  async eventGuardianReminder(user: AuthUser, groupId: string, personId: string, branchId?: string) {
    const group = branchId ? (await this.campBranch(user, groupId, branchId)).group : await this.scopedGroup(user, groupId, true);
    if (!this.canManage(user)) throw new ForbiddenException();
    if (!group.eventDate || (!branchId && group.campEndDate) || group.eventDate < day()) throw new BadRequestException();
    const token = randomBytes(24).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const claimed = await this.enrollments.findOneAndUpdate({
      _id: id(personId), groupId: group._id, branchId: branchId ? id(branchId) : group.branchId,
      state: 'active', needsGuardian: true, guardianEmailOptIn: true, guardianReminderStatus: { $exists: false },
      contact: emailAddress,
    }, { $set: { guardianReminderStatus: 'sending', guardianEmailTokenHash: tokenHash } })
      .select('+contact').lean();
    if (!claimed) throw new ConflictException();
    const locale = claimed.consentLocale in reminderCopy ? claimed.consentLocale as keyof typeof reminderCopy : 'en';
    const [subject, event, date, venue, unsubscribe] = reminderCopy[locale];
    const formatDate = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(value));
    const dates = group.campEndDate && group.campEndDate !== group.eventDate
      ? formatDate(group.eventDate) + ' – ' + formatDate(group.campEndDate) : formatDate(group.eventDate);
    const link = workspaceWebLink(this.config, '/youth-register/' + token, { unsubscribe: '1' });
    let result;
    try {
      result = await this.mail.sendAppEmail({ to: claimed.contact, subject,
        text: [getWorkspace(this.config).name, `${event}: ${group.name}`, `${date}: ${dates}`, `${venue}: ${group.venue ?? ''}`, `${unsubscribe}: ${link}`].join('\n'),
        idempotencyKey: 'youth-guardian-reminder-' + claimed._id });
    } catch {
      await this.enrollments.updateOne({ _id: claimed._id }, { $set: { guardianReminderStatus: 'unconfirmed' } });
      throw new ServiceUnavailableException();
    }
    if (!result.delivered) {
      await this.enrollments.updateOne({ _id: claimed._id }, { $unset: { guardianReminderStatus: 1, guardianEmailTokenHash: 1 } });
      throw new ServiceUnavailableException();
    }
    await this.enrollments.updateOne({ _id: claimed._id }, { $set: { guardianReminderStatus: 'accepted' } });
    return { accepted: true };
  }

  async unsubscribeGuardian(token: string | undefined, ip: string) {
    this.forms.limitPublicSubmission(ip);
    if (!token || !/^[a-f0-9]{48}$/.test(token)) throw new BadRequestException();
    const guardianEmailTokenHash = createHash('sha256').update(token).digest('hex');
    await this.enrollments.updateOne({ guardianEmailTokenHash }, { $set: { guardianEmailOptIn: false } });
    return { saved: true };
  }

  private followUpOwners(branchId: Types.ObjectId) {
    return this.users.find({ branchId, isActive: true, role: { $in: followUpRoles } })
      .select('firstName lastName').sort({ firstName: 1 }).lean();
  }

  private async saveEventFollowUp(user: AuthUser, group: YouthGroup & { _id: Types.ObjectId }, branchId: Types.ObjectId, personId: string, dto: YouthCampFollowUpDto) {
    if (!group.eventDate || dto.date < group.eventDate || dto.date > (group.campEndDate ?? group.eventDate) || dto.date > day() || dto.dueDate < dto.date) {
      throw new BadRequestException('Choose a recorded event day and a due date on or after it.');
    }
    const filter = { _id: id(personId), groupId: group._id, branchId, state: 'active' };
    const person = await this.enrollments.findOne(filter).select('+campFollowUp').lean();
    if (!person) throw new NotFoundException();
    if (!await this.users.exists({ _id: id(dto.ownerId), branchId, isActive: true, role: { $in: followUpRoles } })) {
      throw new BadRequestException('Choose an active youth manager in this branch.');
    }
    if (dto.revision !== (person.campFollowUp?.revision ?? 0)) throw new ConflictException();
    if (dto.date !== person.campFollowUp?.date || dto.reason !== person.campFollowUp?.reason) {
      const session = await this.sessions.findOne({ groupId: group._id, date: dto.date }).lean();
      const attended = session?.present.some(entry => entry.equals(person._id));
      if (!session || attended !== (dto.reason !== 'missed')) {
        throw new BadRequestException('The reason must match the recorded attendance.');
      }
    }
    const result = await this.enrollments.updateOne({
      ...filter, ...(dto.revision ? { 'campFollowUp.revision': dto.revision } : { campFollowUp: { $exists: false } }),
    }, { $set: { campFollowUp: { ...dto, revision: dto.revision + 1, updatedBy: user.sub, updatedAt: new Date() } } });
    if (!result.matchedCount) throw new ConflictException();
    return { saved: true };
  }

  async addCampBranch(user: AuthUser, groupId: string, branchId: string) {
    const { group, coordinator } = await this.campScope(user, groupId);
    if (!coordinator) throw new ForbiddenException();
    const branch = (await this.campBranchOptions(user, group)).find(option => String(option._id) === branchId);
    if (!branch) throw new ForbiddenException();
    const query = { groupId: group._id, branchId: branch._id };
    await this.delegations.init();
    try { await this.delegations.updateOne(query, { $setOnInsert: query }, { upsert: true }); }
    catch (error) { if (!duplicate(error)) throw error; }
    return { saved: true };
  }

  async campLink(user: AuthUser, groupId: string, branchId: string, enabled: boolean) {
    const { group, branch } = await this.campBranch(user, groupId, branchId);
    if (enabled && (!this.registrationInTime(group) || !await this.cleared(group))) throw new ForbiddenException();
    await this.delegations.updateOne({ _id: branch._id, ...(enabled ? { token: { $exists: false } } : {}) },
      enabled ? { $set: { token: randomBytes(24).toString('hex') } } : { $unset: { token: 1 } });
    return { saved: true };
  }

  async campReview(user: AuthUser, groupId: string, branchId: string, personId: string, dto: YouthReviewDto) {
    const { group, branch } = await this.campBranch(user, groupId, branchId);
    return this.reviewEnrollment(user, group, personId, dto, branch.branchId);
  }

  async campAttendance(user: AuthUser, groupId: string, branchId: string, dto: YouthAttendanceDto) {
    const { group, branch } = await this.campBranch(user, groupId, branchId);
    return this.recordAttendance(group, dto, branch.branchId);
  }

  async campWithdraw(user: AuthUser, groupId: string, branchId: string, personId: string) {
    const { group, branch } = await this.campBranch(user, groupId, branchId);
    const result = await this.enrollments.updateOne({ _id: id(personId), groupId: group._id, branchId: branch.branchId, state: 'active' },
      { $set: { state: 'withdrawn', withdrawnBy: user.sub, withdrawnAt: new Date() } });
    if (!result.modifiedCount) throw new NotFoundException();
    return { saved: true };
  }

  async campLogistics(user: AuthUser, groupId: string, branchId: string, personId: string, dto: YouthCampLogisticsDto) {
    const { group, branch } = await this.campBranch(user, groupId, branchId);
    const transport = dto.transport.trim();
    const query = { _id: id(personId), groupId: group._id, branchId: branch.branchId, state: 'active',
      ...(transport ? { transportConsent: true } : {}) };
    const result = await this.enrollments.updateOne(query, { $set: { campTransport: transport, campRoom: dto.room.trim() } });
    if (!result.matchedCount) throw new BadRequestException('Transport requires consent and an approved enrollment.');
    return { saved: true };
  }

  private campFinanceRole(user: AuthUser) {
    return user.role === 'super_admin' || user.role === 'branch_admin';
  }

  async campFinance(user: AuthUser, groupId: string, branchId: string, personId: string, dto: YouthCampFinanceDto) {
    if (!this.campFinanceRole(user)) throw new ForbiddenException();
    const { group, branch } = await this.campBranch(user, groupId, branchId);
    const query = { _id: id(personId), groupId: group._id, branchId: branch.branchId };
    const record = await this.enrollments.findOne(query).select('+campPaid +campScholarship +campFinanceRevision +campLedger').lean();
    if (!record) throw new NotFoundException();
    const existing = record.campLedger?.find(entry => entry.requestId === dto.requestId);
    if (existing) {
      if (existing.amount !== dto.amount || existing.kind !== dto.kind) throw new ConflictException();
      return { saved: true };
    }
    if ((record.campFinanceRevision ?? 0) !== dto.revision) throw new ConflictException();
    if ((record.campLedger?.length ?? 0) >= 200) throw new ConflictException('This ledger has reached its entry limit.');
    if (record.state !== 'active' && record.state !== 'pending' && ['payment', 'scholarship'].includes(dto.kind)) throw new BadRequestException();
    const paid = (record.campPaid ?? 0) + (dto.kind === 'payment' ? dto.amount : dto.kind === 'refund' ? -dto.amount : 0);
    const scholarship = (record.campScholarship ?? 0) + (dto.kind === 'scholarship' ? dto.amount : dto.kind === 'scholarship_reversal' ? -dto.amount : 0);
    if (paid < 0 || scholarship < 0 || paid + scholarship > (group.feeMinor ?? 0)) throw new BadRequestException();
    const saved = await this.enrollments.updateOne({
      ...query, state: record.state,
      ...(dto.revision ? { campFinanceRevision: dto.revision } : { $or: [{ campFinanceRevision: 0 }, { campFinanceRevision: { $exists: false } }] }),
    }, {
      $set: { campPaid: paid, campScholarship: scholarship },
      $inc: { campFinanceRevision: 1 },
      $push: { campLedger: { requestId: dto.requestId, kind: dto.kind, amount: dto.amount, at: new Date(), actorId: user.sub } },
    });
    if (!saved.modifiedCount) throw new ConflictException();
    return { saved: true };
  }
}
