import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { User } from '../users/schemas/user.schema';
import { YouthDevelopment, YouthDevelopmentProgress } from './youth-development.schema';
import { YouthMentoringCheckInDto, YouthMentoringDto, YouthMentoringReminderDto, YouthProgressDto, YouthProjectDto, YouthServiceMinutesDto, YouthTrackDto } from './youth-development.dto';
import { YouthEnrollment } from './youth.schema';
import { YouthService } from './youth.service';

const today = () => new Date().toISOString().slice(0, 10);
const duplicate = (error: unknown) => (error as { code?: number })?.code === 11000;
const objectId = (id: string) => {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundException();
  return new Types.ObjectId(id);
};

@Injectable()
export class YouthDevelopmentService {
  constructor(
    @InjectModel(YouthDevelopment.name) private readonly activities: Model<YouthDevelopment>,
    @InjectModel(YouthDevelopmentProgress.name) private readonly progress: Model<YouthDevelopmentProgress>,
    @InjectModel(YouthEnrollment.name) private readonly enrollments: Model<YouthEnrollment>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly youth: YouthService,
  ) {}

  async overview(user: AuthUser, groupId: string) {
    const { group, manager, screenedLeader } = await this.youth.developmentScope(user, groupId);
    const [people, activities, posts] = await Promise.all([
      this.enrollments.find({ groupId: group._id, state: 'active' }).select('firstName lastName needsGuardian')
        .sort({ firstName: 1, lastName: 1 }).lean(),
      this.activities.find({
        groupId: group._id,
        ...(manager ? {} : { $or: [{ kind: { $in: ['track', 'project'] } }, { kind: 'mentoring', mentorId: user.sub, active: true }] }),
      }).select('-createdBy').sort({ _id: -1 }).lean(),
      manager ? this.youth.groupPosts([group._id]) : [],
    ]);
    const activeIds = new Set(people.map(person => String(person._id)));
    const visible = activities.filter(item => item.kind !== 'mentoring' || activeIds.has(String(item.enrollmentId)));
    const [progress, mentors] = await Promise.all([this.progress.find({
      activityId: { $in: visible.filter(({ kind }) => kind !== 'mentoring').map(({ _id }) => _id) },
      enrollmentId: { $in: people.map(({ _id }) => _id) },
      $or: [{ 'completed.0': { $exists: true } }, { signedUpAt: { $exists: true } }],
    }).select('activityId enrollmentId completed signedUpAt serviceMinutes').lean(),
    this.users.find({ _id: { $in: visible.flatMap(({ mentorId }) => mentorId ? [mentorId] : []) }, branchId: group.branchId })
      .select('firstName lastName').lean()]);
    const mentorNames = new Map(mentors.map(mentor => [String(mentor._id), [mentor.firstName, mentor.lastName].filter(Boolean).join(' ')]));
    return { groupName: group.name, manager, screenedLeader, people, progress, posts,
      activities: visible.map(({ mentorId, ...item }) => ({
        ...item,
        ...(mentorId ? {
          mentorName: mentorNames.get(String(mentorId)),
          canCheckIn: item.active && screenedLeader && String(mentorId) === String(group.leaderId),
        } : {}),
      })),
    };
  }

  async createTrack(user: AuthUser, groupId: string, dto: YouthTrackDto) {
    const { group } = await this.youth.developmentScope(user, groupId, true);
    const milestones = dto.milestones.map(item => item.trim());
    if (new Set(milestones.map(item => item.toLowerCase())).size !== milestones.length) throw new BadRequestException('Use distinct milestones.');
    const activity = await this.activities.create({ groupId: group._id, kind: 'track', title: dto.title.trim(), milestones, createdBy: user.sub });
    return { id: activity.id };
  }

  async createProject(user: AuthUser, groupId: string, dto: YouthProjectDto) {
    const { group } = await this.youth.developmentScope(user, groupId, true);
    const activity = await this.activities.create({
      groupId: group._id, kind: 'project', title: dto.title.trim(), date: dto.date, location: dto.location.trim(), createdBy: user.sub,
    });
    return { id: activity.id };
  }

  private async activeEnrollment(groupId: Types.ObjectId, enrollmentId: string) {
    const person = await this.enrollments.exists({ _id: objectId(enrollmentId), groupId, state: 'active' });
    if (!person) throw new NotFoundException();
    return person._id;
  }

  async createMentoring(user: AuthUser, groupId: string, dto: YouthMentoringDto) {
    const { group, screenedLeader } = await this.youth.developmentScope(user, groupId, true);
    if (!screenedLeader || !group.leaderId) throw new ForbiddenException();
    const enrollmentId = await this.activeEnrollment(group._id, dto.enrollmentId);
    await this.activities.init();
    try {
      const activity = await this.activities.create({
        groupId: group._id, kind: 'mentoring', enrollmentId, mentorId: group.leaderId,
        title: dto.title.trim(), permissionConfirmedAt: new Date(), createdBy: user.sub, active: true,
      });
      return { id: activity.id };
    } catch (error) {
      if (duplicate(error)) throw new ConflictException('An active mentoring assignment already exists.');
      throw error;
    }
  }

  async mark(user: AuthUser, groupId: string, activityId: string, dto: YouthProgressDto) {
    const { group } = await this.youth.developmentScope(user, groupId);
    const activity = await this.activities.findOne({ _id: objectId(activityId), groupId: group._id, kind: { $in: ['track', 'project'] } }).lean();
    if (!activity) throw new NotFoundException();
    if (dto.milestone >= (activity.milestones?.length ?? 1) || (activity.date && activity.date > today())) throw new BadRequestException();
    const enrollmentId = await this.activeEnrollment(group._id, dto.enrollmentId);
    const query = { activityId: activity._id, enrollmentId };
    if (!dto.completed) await this.progress.updateOne(query, {
      $pull: { completed: dto.milestone },
      ...(activity.kind === 'project' ? { $unset: { serviceMinutes: 1, serviceVerifiedBy: 1, serviceVerifiedAt: 1 } } : {}),
    });
    else {
      await this.progress.init();
      try {
        await this.progress.updateOne(query, { $addToSet: { completed: dto.milestone } }, { upsert: true });
      } catch (error) {
        if (!duplicate(error)) throw error;
        await this.progress.updateOne(query, { $addToSet: { completed: dto.milestone } });
      }
    }
    return { saved: true };
  }

  async verifyService(user: AuthUser, groupId: string, activityId: string, dto: YouthServiceMinutesDto) {
    const { group } = await this.youth.developmentScope(user, groupId, true);
    const project = await this.activities.findOne({ _id: objectId(activityId), groupId: group._id,
      kind: 'project', date: { $lte: today() } }).select('_id').lean();
    if (!project) throw new NotFoundException();
    const enrollmentId = await this.activeEnrollment(group._id, dto.enrollmentId);
    const result = await this.progress.updateOne({ activityId: project._id, enrollmentId, completed: 0 },
      dto.minutes ? { $set: { serviceMinutes: dto.minutes, serviceVerifiedBy: objectId(user.sub), serviceVerifiedAt: new Date() } } :
        { $unset: { serviceMinutes: 1, serviceVerifiedBy: 1, serviceVerifiedAt: 1 } });
    if (!result.matchedCount) throw new ConflictException('Mark the project complete before verifying service time.');
    return { saved: true };
  }

  async checkIn(user: AuthUser, groupId: string, activityId: string, dto: YouthMentoringCheckInDto) {
    const { group, screenedLeader, manager } = await this.youth.developmentScope(user, groupId);
    const query = { _id: objectId(activityId), groupId: group._id, kind: 'mentoring', active: true,
      mentorId: group.leaderId, ...(manager ? {} : { mentorId: user.sub }) };
    if (!screenedLeader || (!manager && String(group.leaderId) !== user.sub)) throw new ForbiddenException();
    const assignment = await this.activities.findOne(query).lean();
    if (!assignment?.enrollmentId || !assignment.permissionConfirmedAt) throw new NotFoundException();
    await this.activeEnrollment(group._id, String(assignment.enrollmentId));
    if (dto.date > today() || dto.date < assignment.permissionConfirmedAt.toISOString().slice(0, 10)) throw new BadRequestException();
    if (!(await this.activities.updateOne(query, { $addToSet: { checkIns: dto.date } })).matchedCount) throw new ConflictException();
    await this.activities.updateOne({ ...query, nextCheckIn: dto.date }, { $unset: { nextCheckIn: 1, participantNextStep: 1 } });
    return { saved: true };
  }

  async mentoringReminder(user: AuthUser, groupId: string, activityId: string, dto: YouthMentoringReminderDto) {
    const { group, screenedLeader, manager } = await this.youth.developmentScope(user, groupId);
    if (!screenedLeader || (!manager && String(group.leaderId) !== user.sub)) throw new ForbiddenException();
    if (dto.date && dto.date < today()) throw new BadRequestException('Choose today or a future check-in date.');
    const query = { _id: objectId(activityId), groupId: group._id, kind: 'mentoring', active: true,
      mentorId: group.leaderId, permissionConfirmedAt: { $exists: true } };
    const assignment = await this.activities.findOne(query).select('enrollmentId').lean();
    if (!assignment?.enrollmentId) throw new NotFoundException();
    await this.activeEnrollment(group._id, String(assignment.enrollmentId));
    const result = await this.activities.updateOne({ ...query, ...(dto.date ? { checkIns: { $ne: dto.date } } : {}) },
      dto.date ? { $set: { nextCheckIn: dto.date, participantNextStep: dto.nextStep?.trim() ?? '' } } :
        { $unset: { nextCheckIn: 1, participantNextStep: 1 } });
    if (!result.matchedCount) throw new ConflictException();
    return { saved: true };
  }

  async endMentoring(user: AuthUser, groupId: string, activityId: string) {
    const { group } = await this.youth.developmentScope(user, groupId, true);
    const query = { _id: objectId(activityId), groupId: group._id, kind: 'mentoring', active: true };
    if (!(await this.activities.updateOne(query, { $set: { active: false, endedAt: new Date() },
      $unset: { nextCheckIn: 1, participantNextStep: 1 } })).matchedCount) throw new NotFoundException();
    return { saved: true };
  }
}
