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
import { YouthAttendanceDto, YouthEventDto, YouthGroupDto, YouthGroupSettingsDto, YouthLeaderDto, YouthRegistrationDto, YouthReviewDto, YouthTransitionDto } from './youth.dto';
import { YouthEnrollment, YouthGroup, YouthSession } from './youth.schema';

const day = () => new Date().toISOString().slice(0, 10);
const duplicate = (error: unknown) => (error as { code?: number })?.code === 11000;
const leaderRoles = [...BRANCH_LEADERSHIP_ROLES, ...BRANCH_SUPPORT_ROLES, ...YOUTH_ROLES];
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
    const groups = await this.groups.find(query).sort({ program: 1, name: 1 }).lean();
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
        canOpen: this.managesGroup(user, group) || (String(group.leaderId) === user.sub && Boolean(group.clearanceUntil && group.clearanceUntil >= day())),
        eventDate: group.eventDate, venue: group.venue, capacity: group.capacity,
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

  private async saveGroup(branchId: Types.ObjectId, dto: YouthGroupDto & Partial<Pick<YouthGroup, 'eventDate' | 'registrationDeadline' | 'venue' | 'capacity' | 'districtManaged'>>) {
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
    if (enable && !await this.cleared(group)) throw new ForbiddenException('Assign a screened group leader with current clearance first.');
    if (enable && !this.registrationInTime(group)) throw new BadRequestException('Registration has closed or screening expires before the event.');
    await this.groups.updateOne({ _id: group._id, ...(enable ? { registrationToken: { $exists: false } } : {}) }, enable
      ? { $set: { registrationToken: randomBytes(24).toString('hex') } }
      : { $unset: { registrationToken: 1 } });
    return { saved: true };
  }

  private registrationInTime(group: YouthGroup) {
    return !group.eventDate || Boolean(group.registrationDeadline && group.registrationDeadline >= day() &&
      group.clearanceUntil && group.clearanceUntil >= group.eventDate);
  }

  private async publicGroup(token: string) {
    await this.forms.assertPublicEnabled();
    if (!/^[a-f0-9]{48}$/.test(token ?? '')) throw new NotFoundException();
    const group = await this.groups.findOne({ registrationToken: token }).lean();
    if (!group || !this.registrationInTime(group) || !await this.cleared(group)) throw new NotFoundException();
    return group;
  }

  async publicInfo(token: string) {
    const { name, program, minAge, maxAge, guardianUnderAge, eventDate, venue, registrationDeadline } = await this.publicGroup(token);
    return { name, program, minAge, maxAge, guardianUnderAge, eventDate, venue, registrationDeadline, consentVersion: 1, form: await this.forms.publicForm(MinistryFormKind.Youth) };
  }

  async register(token: string, dto: YouthRegistrationDto, ip: string) {
    this.forms.limitPublicSubmission(ip);
    const group = await this.publicGroup(token);
    const customAnswers = await this.forms.prepare(MinistryFormKind.Youth, dto, undefined, 'public');
    const enrollment = this.enrollmentData(group, dto);
    try {
      await this.enrollments.create({ ...enrollment, customAnswers });
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
    const query = { _id: id(enrollmentId), groupId: group._id, state: 'pending' };
    const record = await this.enrollments.findOne(query).select('+birthDate').lean();
    if (!record) throw new NotFoundException();
    if (dto.state === 'active' && record.needsGuardian && dto.guardianVerified !== true) {
      throw new BadRequestException('Confirm the guardian’s permission before approving.');
    }
    if (dto.state === 'active' && group.eventDate && (group.eventDate < day() || !group.clearanceUntil || group.clearanceUntil < group.eventDate || !await this.cleared(group))) {
      throw new ForbiddenException('Event approval requires an upcoming event and a screened leader.');
    }
    if (dto.memberId && dto.childId) throw new BadRequestException('Choose one existing record.');
    if (dto.memberId || dto.childId) {
      const options = await this.matches(user, groupId, enrollmentId);
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
    if (!await this.cleared(group)) throw new ForbiddenException('Assign a screened group leader with current clearance first.');
    if (group.eventDate && dto.date !== group.eventDate) throw new BadRequestException('Use the event date for attendance.');
    if (dto.date > day()) throw new BadRequestException('Attendance cannot be entered for a future date.');
    const enrollmentId = id(dto.enrollmentId);
    if (!await this.enrollments.exists({ _id: enrollmentId, groupId: group._id, state: 'active' })) throw new NotFoundException();
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
    const saved = await this.enrollments.updateOne({ _id: id(enrollmentId), groupId: group._id, state: 'active' },
      { $set: { state: 'withdrawn', withdrawnBy: user.sub, withdrawnAt: new Date() } });
    if (!saved.modifiedCount) throw new NotFoundException();
    return { saved: true };
  }

  async welcome(user: AuthUser, groupId: string, enrollmentId: string) {
    const group = await this.scopedGroup(user, groupId);
    const saved = await this.enrollments.updateOne({ _id: id(enrollmentId), groupId: group._id, state: 'active', welcomedAt: { $exists: false } },
      { $set: { welcomedAt: new Date() } });
    return { saved: saved.modifiedCount === 1 };
  }
}
