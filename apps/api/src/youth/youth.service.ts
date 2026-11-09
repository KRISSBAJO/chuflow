import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { Branch } from '../branches/schemas/branch.schema';
import { ChildProfile } from '../children/children.schema';
import { BRANCH_LEADERSHIP_ROLES, BRANCH_SUPPORT_ROLES, LEADERSHIP_ROLES, YOUTH_ROLES } from '../common/constants/roles.constants';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { GuestFieldsService, MinistryFormKind } from '../guests/guest-fields.service';
import { Member } from '../members/schemas/member.schema';
import { User } from '../users/schemas/user.schema';
import { getWorkspace } from '../workspaces/workspace-boundary';
import { YouthAttendanceDto, YouthCampDto, YouthCampFinanceDto, YouthCampFollowUpDto, YouthCampLogisticsDto, YouthEventDto, YouthGroupDto, YouthGroupSettingsDto, YouthLeaderDto, YouthRegistrationDto, YouthReviewDto, YouthTransitionDto } from './youth.dto';
import { YouthCampDelegation, YouthEnrollment, YouthGroup, YouthSession } from './youth.schema';

const day = () => new Date().toISOString().slice(0, 10);
const duplicate = (error: unknown) => (error as { code?: number })?.code === 11000;
const leaderRoles = [...BRANCH_LEADERSHIP_ROLES, ...BRANCH_SUPPORT_ROLES, ...YOUTH_ROLES];
const followUpRoles = [...BRANCH_LEADERSHIP_ROLES, 'youth_pastor'];
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
    private readonly access: AccessScopeService,
    private readonly forms: GuestFieldsService,
    private readonly config: ConfigService,
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
    const [people, session, leaders, link, recentSessions, cleared, destinations] = await Promise.all([
      this.enrollments.find({ groupId: group._id, state: showRegistration ? { $in: ['active', 'pending'] } : 'active' })
        .select(showRegistration ? '+guardianName +contact +birthDate +customAnswers' : 'firstName lastName state welcomedAt').sort({ firstName: 1, lastName: 1 }).lean(),
      this.sessions.findOne({ groupId: group._id, date }).lean(),
      showRegistration ? this.users.find({ branchId: group.branchId, isActive: true, role: { $in: leaderRoles } }).select('firstName lastName').sort({ firstName: 1 }).lean() : [],
      showRegistration ? this.groups.findById(group._id).select('+registrationToken').lean() : null,
      this.sessions.find({ groupId: group._id }).sort({ date: -1 }).limit(12).lean(),
      this.cleared(group),
      showRegistration && !group.eventDate ? this.groups.find({ branchId: group.branchId, eventDate: { $exists: false }, _id: { $ne: group._id } }).select('name minAge maxAge guardianUnderAge').sort({ name: 1 }).lean() : [],
    ]);
    return {
      group, manager, date, people, leaders, destinations, canRecord: cleared,
      registrationAvailable: cleared && this.registrationInTime(group),
      registrationToken: link?.registrationToken ?? null,
      present: session?.present ?? [],
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
    try {
      await this.enrollments.create({ ...enrollment, branchId, customAnswers,
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
        .select('+guardianName +contact +transportConsent +campTransport +campRoom +campFollowUp' + (finance ? ' +campPaid +campScholarship +campFinanceRevision +campLedger' : ''))
        .sort({ firstName: 1, lastName: 1 }).lean() : [],
      selected ? this.sessions.findOne({ groupId: group._id, date }).lean() : null,
      selected ? this.delegations.findById(selected._id).select('+token').lean() : null,
      coordinator ? this.users.find({ branchId: group.branchId, isActive: true, role: { $in: leaderRoles } }).select('firstName lastName').sort({ firstName: 1 }).lean() : [],
      this.cleared(group),
      selected ? this.users.find({ branchId: selected.branchId, isActive: true, role: { $in: followUpRoles } })
        .select('firstName lastName').sort({ firstName: 1, lastName: 1 }).lean() : [],
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
    if (dto.date < group.eventDate! || dto.date > group.campEndDate! || dto.date > day() || dto.dueDate < dto.date) {
      throw new BadRequestException('Choose a recorded camp day and a due date on or after it.');
    }
    const filter = { _id: id(personId), groupId: group._id, branchId: branch.branchId, state: 'active' };
    const person = await this.enrollments.findOne(filter).select('+campFollowUp').lean();
    if (!person) throw new NotFoundException();
    if (!await this.users.exists({ _id: id(dto.ownerId), branchId: branch.branchId, isActive: true, role: { $in: followUpRoles } })) {
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
