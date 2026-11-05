import { MeetingInvitationsService } from './meeting-invitations.service';
import { collectExport } from '../../../web/src/lib/exporting/data';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Model, Types, model } from 'mongoose';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AccessScopeService } from '../access-scope/access-scope.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { MemberDocument } from '../members/schemas/member.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { BranchDocument } from '../branches/schemas/branch.schema';
import { ServiceUnitDocument } from '../service-units/schemas/service-unit.schema';
import {
  MeetingDocument,
  MeetingGroupDocument,
  MeetingFileDocument,
  MeetingSchema,
  MeetingGroupSchema,
} from './meetings.schema';
import {
  MeetingsService,
  validateMeetingTimes,
  validateDocument,
  minutesOverdue,
} from './meetings.service';
import { CreateMeetingDto, MeetingListDto } from './meetings.dto';
const id = () => String(new Types.ObjectId());
const branch = id(),
  groupId = id(),
  meetingId = id(),
  organizer = id(),
  attendee = id(),
  reviewer = id(),
  stranger = id(),
  fileId = id();
const user = (
  sub = organizer,
  role: AuthUser['role'] = 'follow_up',
): AuthUser => ({ sub, role, email: 'test@example.test', branchId: branch });
function fixture() {
  const group = {
    _id: groupId,
    branchId: branch,
    enabled: true,
    minutesRequired: true,
    minutesDueHours: 72,
    submitterUserIds: [organizer],
    reviewerUserIds: [reviewer],
  };
  const meeting = {
    _id: meetingId,
    groupId,
    branchId: branch,
    organizerUserId: organizer,
    title: 'Team meeting',
    startsAt: new Date('2026-11-01T10:00:00Z'),
    endsAt: new Date('2026-11-01T11:00:00Z'),
    minutesDueAt: new Date('2026-11-04T11:00:00Z'),
    minutesRequired: true,
    minutesStatus: 'draft',
    minutesBody: '',
    minutesLinks: [] as string[],
    minutesHistory: [],
    attendeeUserIds: [attendee],
    presentUserIds: [],
    attendeeMemberIds: [],
    presentMemberIds: [],
    attachmentIds: [] as string[],
    actions: [
      {
        id: 'a',
        title: 'Call team',
        ownerUserId: attendee,
        status: 'open' as 'open' | 'done',
      },
    ],
    status: 'completed',
    revision: 4,
  };
  const meetings = {
    findById: jest.fn(() => ({ lean: async () => meeting })),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    create: jest.fn().mockImplementation((x: unknown) => Promise.resolve(x)),
  };
  const groups = {
    findById: jest.fn(() => ({ lean: async () => group })),
    findOneAndUpdate: jest
      .fn()
      .mockResolvedValue({
        toObject: () => ({ ...group, minutesRequired: false }),
      }),
  };
  const files = {
    create: jest.fn().mockResolvedValue({ _id: fileId }),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    findOne: jest.fn(),
  };
  const users = {
    find: jest.fn((filter: { _id: { $in: string[] } }) => ({
      select: () => ({
        lean: async () =>
          filter._id.$in.includes(attendee)
            ? [{ _id: attendee, branchId: branch }]
            : [],
      }),
    })),
  };
  const scope = {
    ensureBranchAccess: jest.fn().mockResolvedValue(undefined),
    resolveScopedBranchId: jest.fn().mockResolvedValue(branch),
  };
  const members = {
    countDocuments: jest.fn().mockResolvedValue(0),
    find: jest.fn(() => ({
      select: () => ({
        limit: () => ({
          lean: async () => [{ _id: attendee }, { _id: reviewer }],
        }),
      }),
    })),
  };
  const units = { countDocuments: jest.fn().mockResolvedValue(2) };
  const invitationService = {
    recipients: jest
      .fn()
      .mockResolvedValue({ recipients: [], missingEmail: 0 }),
  };
  const service = new MeetingsService(
    members as unknown as Model<MemberDocument>,
    meetings as unknown as Model<MeetingDocument>,
    groups as unknown as Model<MeetingGroupDocument>,
    files as unknown as Model<MeetingFileDocument>,
    users as unknown as Model<UserDocument>,
    units as unknown as Model<ServiceUnitDocument>,
    {} as Model<BranchDocument>,
    scope as unknown as AccessScopeService,
    invitationService as unknown as MeetingInvitationsService,
  );
  jest.spyOn(service, 'details').mockResolvedValue({});
  return {
    service,
    meeting,
    group,
    meetings,
    scope,
    files,
    users,
    members,
    units,
    invitationService,
  };
}
describe('Meeting scheduling and access', () => {
  it('rejects inverted, invalid, or overlong meeting times', () => {
    expect(() => validateMeetingTimes('bad', 'bad')).toThrow(
      BadRequestException,
    );
    expect(() => validateMeetingTimes('2026-01-01', '2025-01-01')).toThrow();
    expect(() => validateMeetingTimes('2026-01-01', '2026-01-03')).toThrow();
  });
  it('creates a scoped meeting with a snapshot of group minutes requirements', async () => {
    const { service, meetings } = fixture();
    const result = await service.create(user(), {
      groupId,
      title: 'Planning',
      startsAt: '2026-11-04T12:00:00Z',
      endsAt: '2026-11-04T13:00:00Z',
      attendeeUserIds: [attendee],
    });
    expect(result).toMatchObject({
      branchId: branch,
      organizerUserId: organizer,
      minutesRequired: true,
      minutesDueAt: new Date('2026-11-07T13:00:00Z'),
    });
    expect(meetings.create).toHaveBeenCalledTimes(1);
  });
  it('does not let an attendee schedule meetings for a group', async () => {
    const { service } = fixture();
    await expect(
      service.create(user(attendee), {
        groupId,
        title: 'Planning',
        startsAt: '2026-11-04T12:00:00Z',
        endsAt: '2026-11-04T13:00:00Z',
        attendeeUserIds: [],
      }),
    ).rejects.toThrow(ForbiddenException);
  });
  it('blocks new meetings when the group is disabled', async () => {
    const { service, group } = fixture();
    group.enabled = false;
    await expect(
      service.create(user(), {
        groupId,
        title: 'Planning',
        startsAt: '2026-11-04T12:00:00Z',
        endsAt: '2026-11-04T13:00:00Z',
        attendeeUserIds: [],
      }),
    ).rejects.toThrow('disabled');
  });
  it('rejects branch scope violations before writing', async () => {
    const { service, scope, meetings } = fixture();
    scope.ensureBranchAccess.mockRejectedValue(new ForbiddenException());
    await expect(
      service.update(user(), meetingId, {
        operation: 'details',
        status: 'ongoing',
        expectedRevision: 4,
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(meetings.updateOne).not.toHaveBeenCalled();
  });
  it('denies an unrelated user even within the same branch', async () => {
    const { service } = fixture();
    await expect(
      service.update(user(stranger), meetingId, {
        operation: 'attendance',
        presentUserIds: [],
        expectedRevision: 4,
      }),
    ).rejects.toThrow(ForbiddenException);
  });
  it('does not allow attendance for people outside the attendee list', async () => {
    const { service } = fixture();
    await expect(
      service.update(user(), meetingId, {
        operation: 'attendance',
        presentUserIds: [stranger],
        expectedRevision: 4,
      }),
    ).rejects.toThrow(BadRequestException);
  });
  it('uses a conditional revision update to prevent lost saves', async () => {
    const { service, meetings } = fixture();
    meetings.updateOne.mockResolvedValue({ modifiedCount: 0 });
    await expect(
      service.update(user(), meetingId, {
        operation: 'details',
        status: 'ongoing',
        expectedRevision: 3,
      }),
    ).rejects.toThrow(ConflictException);
    expect(meetings.updateOne.mock.calls[0][0]).toEqual({
      _id: meetingId,
      revision: 3,
    });
  });
  it('preserves the original submission allowance when rescheduling', async () => {
    const { service, group, meetings } = fixture();
    group.minutesDueHours = 1;
    await service.update(user(), meetingId, {
      operation: 'details',
      startsAt: '2026-11-05T10:00:00Z',
      endsAt: '2026-11-05T11:00:00Z',
      expectedRevision: 4,
    });
    expect(meetings.updateOne.mock.calls[0][1].$set.minutesDueAt).toEqual(
      new Date('2026-11-08T11:00:00Z'),
    );
  });
});
describe('Minutes review and documents', () => {
  it('requires written minutes, committed documents, or a link before submission', async () => {
    const { service } = fixture();
    await expect(
      service.update(user(), meetingId, {
        operation: 'submit',
        expectedRevision: 4,
      }),
    ).rejects.toThrow('Write minutes');
  });
  it('accepts linked minutes and records submission history', async () => {
    const { service, meeting, meetings } = fixture();
    meeting.minutesLinks = ['https://docs.google.com/document/test'];
    await service.update(user(), meetingId, {
      operation: 'submit',
      expectedRevision: 4,
    });
    expect(meetings.updateOne.mock.calls[0][1].$set.minutesStatus).toBe(
      'submitted',
    );
    expect(
      meetings.updateOne.mock.calls[0][1].$push.minutesHistory.$each[0],
    ).toMatchObject({ status: 'submitted', by: organizer, revision: 5 });
  });
  it('locks approved minutes against edits and new documents', async () => {
    const { service, meeting } = fixture();
    meeting.minutesStatus = 'approved';
    await expect(
      service.update(user(), meetingId, {
        operation: 'minutes',
        minutesBody: 'replace',
        expectedRevision: 4,
      }),
    ).rejects.toThrow('cannot be edited');
    await expect(
      service.upload(user(), meetingId, {
        originalname: 'a.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-test'),
        size: 9,
      }),
    ).rejects.toThrow('cannot be changed');
  });
  it('only lets reviewers or leadership approve submitted minutes', async () => {
    const { service, meeting } = fixture();
    meeting.minutesStatus = 'submitted';
    await expect(
      service.update(user(), meetingId, {
        operation: 'approve',
        expectedRevision: 4,
      }),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.update(user(reviewer), meetingId, {
        operation: 'approve',
        expectedRevision: 4,
      }),
    ).resolves.toBeDefined();
  });
  it('requires an explanation when returning minutes', async () => {
    const { service, meeting } = fixture();
    meeting.minutesStatus = 'submitted';
    await expect(
      service.update(user(reviewer), meetingId, {
        operation: 'return',
        expectedRevision: 4,
      }),
    ).rejects.toThrow('Explain');
  });
  it('only marks missing required minutes overdue and excludes cancellations', () => {
    const { meeting } = fixture();
    expect(minutesOverdue(meeting, Date.parse('2026-11-05'))).toBe(true);
    expect(
      minutesOverdue(
        { ...meeting, status: 'cancelled' },
        Date.parse('2026-11-05'),
      ),
    ).toBe(false);
    expect(
      minutesOverdue(
        { ...meeting, minutesStatus: 'submitted' },
        Date.parse('2026-11-05'),
      ),
    ).toBe(false);
    expect(
      minutesOverdue(
        { ...meeting, minutesRequired: false },
        Date.parse('2026-11-05'),
      ),
    ).toBe(false);
  });
  it('validates attachment types and size before storage', () => {
    expect(
      validateDocument({
        originalname: 'minutes.pdf',
        buffer: Buffer.from('%PDF-1.4'),
        size: 8,
      }).mime,
    ).toBe('application/pdf');
    expect(() =>
      validateDocument({
        originalname: 'fake.pdf',
        buffer: Buffer.from('html'),
        size: 4,
      }),
    ).toThrow();
    expect(() =>
      validateDocument({
        originalname: 'notes.txt',
        buffer: Buffer.from('notes'),
        size: 6 * 1024 * 1024,
      }),
    ).toThrow();
  });
  it('atomically commits attachment IDs to the meeting revision', async () => {
    const { service, meetings } = fixture();
    await service.upload(user(), meetingId, {
      originalname: 'minutes.txt',
      mimetype: 'text/plain',
      buffer: Buffer.from('notes'),
      size: 5,
    });
    expect(meetings.updateOne.mock.calls[0]).toEqual([
      { _id: meetingId, revision: 4 },
      { $inc: { revision: 1 }, $push: { attachmentIds: fileId } },
    ]);
  });
  it('removes an uncommitted document if the meeting changed during upload', async () => {
    const { service, meetings, files } = fixture();
    meetings.updateOne.mockResolvedValue({ modifiedCount: 0 });
    await expect(
      service.upload(user(), meetingId, {
        originalname: 'minutes.txt',
        mimetype: 'text/plain',
        buffer: Buffer.from('notes'),
        size: 5,
      }),
    ).rejects.toThrow(ConflictException);
    expect(files.deleteOne).toHaveBeenCalledWith({ _id: fileId });
  });
  it('does not expose an unlinked or other-meeting document', async () => {
    const { service, files } = fixture();
    await expect(service.download(user(), meetingId, fileId)).rejects.toThrow(
      NotFoundException,
    );
    expect(files.findOne).not.toHaveBeenCalled();
  });
});
describe('Assigned actions and validated input', () => {
  it('lets an assignee mark their own action done', async () => {
    const { service, meeting, meetings } = fixture();
    await service.update(user(attendee), meetingId, {
      operation: 'actions',
      expectedRevision: 4,
      actions: [{ ...meeting.actions[0], status: 'done' }],
    });
    expect(meetings.updateOne.mock.calls[0][1].$set.actions[0].status).toBe(
      'done',
    );
  });
  it('prevents an assignee from changing titles or someone else’s action', async () => {
    const { service, meeting } = fixture();
    await expect(
      service.update(user(attendee), meetingId, {
        operation: 'actions',
        expectedRevision: 4,
        actions: [{ ...meeting.actions[0], title: 'rewrite' }],
      }),
    ).rejects.toThrow(ForbiddenException);
  });
  it('rejects script URLs and malformed list filters', async () => {
    const dto = plainToInstance(CreateMeetingDto, {
      groupId,
      title: 'Planning',
      startsAt: '2026-11-04T12:00:00Z',
      endsAt: '2026-11-04T13:00:00Z',
      attendeeUserIds: [],
      joinUrl: 'javascript:alert(1)',
    });
    expect((await validate(dto)).some((e) => e.property === 'joinUrl')).toBe(
      true,
    );
    expect(
      (
        await validate(
          plainToInstance(MeetingListDto, {
            q: ['invalid'],
            page: '1.5',
            groupId: 'bad',
          }),
        )
      ).length,
    ).toBe(3);
  });
  it('allows clearing an existing meeting link', async () => {
    expect(
      await validate(
        plainToInstance(CreateMeetingDto, {
          groupId,
          title: 'Planning',
          startsAt: '2026-11-04T12:00:00Z',
          endsAt: '2026-11-04T13:00:00Z',
          attendeeUserIds: [],
          joinUrl: '',
        }),
      ),
    ).toHaveLength(0);
  });
});

describe('Meeting persistence schema', () => {
  it('retains committed documents and member attendance in saved meeting records', () => {
    const MeetingModel = model('MeetingPersistenceTest', MeetingSchema);
    const doc = new MeetingModel({
      branchId: branch,
      groupId,
      title: 'Planning',
      organizerUserId: organizer,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 3600000),
      minutesDueAt: new Date(),
      attachmentIds: [fileId],
      attendeeMemberIds: [attendee],
      presentMemberIds: [attendee],
    });
    expect(doc.toObject()).toMatchObject({
      attachmentIds: [fileId],
      attendeeMemberIds: [attendee],
      presentMemberIds: [attendee],
      revision: 0,
      minutesStatus: 'draft',
    });
  });
  it('defaults group minutes requirements without changing old meetings', () => {
    const GroupModel = model('MeetingGroupPersistenceTest', MeetingGroupSchema);
    expect(
      new GroupModel({ branchId: branch, name: 'Choir' }).toObject(),
    ).toMatchObject({
      enabled: true,
      minutesRequired: true,
      minutesDueHours: 72,
    });
  });
});

describe('Meeting submission and exports', () => {
  it('submits the current on-screen minutes in the same revision update', async () => {
    const { service, meetings } = fixture();
    await service.update(user(), meetingId, {
      operation: 'submit',
      expectedRevision: 4,
      minutesBody: 'Decisions made today',
      minutesLinks: [],
    });
    expect(meetings.updateOne.mock.calls[0][1].$set).toMatchObject({
      minutesBody: 'Decisions made today',
      minutesStatus: 'submitted',
    });
  });
  it('removes only unapproved documents, using the expected revision', async () => {
    const { service, meeting, meetings, files } = fixture();
    meeting.attachmentIds = [fileId];
    await service.removeFile(user(), meetingId, fileId, 4);
    expect(meetings.updateOne.mock.calls[0][1].$pull).toEqual({
      attachmentIds: fileId,
    });
    expect(files.deleteOne).toHaveBeenCalledWith({ _id: fileId, meetingId });
    meeting.minutesStatus = 'approved';
    await expect(
      service.removeFile(user(), meetingId, fileId, 4),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('Meeting table export pagination', () => {
  it('exports all matching pages and retains applied filters', async () => {
    const paths: string[] = [];
    const result = await collectExport(
      'meetings',
      new URLSearchParams('minutes=overdue&groupId=abc'),
      async (path) => {
        paths.push(path);
        const page = Number(
          new URL(path, 'https://example.test').searchParams.get('page'),
        );
        return {
          items: Array.from({ length: page === 1 ? 100 : 1 }, (_, index) => ({
            _id: `m-${page}-${index}`,
            title: 'Meeting',
          })),
          total: 101,
          totalPages: 2,
        };
      },
    );
    expect(paths).toHaveLength(2);
    expect(
      paths.every(
        (path) =>
          path.includes('minutes=overdue') && path.includes('groupId=abc'),
      ),
    ).toBe(true);
    expect(result.sheets[0].rows).toHaveLength(101);
  });
});

describe('Church and service-group meeting audiences', () => {
  it('combines selected groups with additional members and removes overlaps', async () => {
    const f = fixture();
    f.members.countDocuments.mockResolvedValue(2);
    const result = await f.service.previewAudience(user(), {
      groupId,
      audienceMode: 'service_groups',
      audienceServiceUnitIds: [id(), id()],
      attendeeMemberIds: [attendee, stranger],
      attendeeUserIds: [],
    });
    expect(result.memberCount).toBe(3);
    expect(
      f.invitationService.recipients.mock.calls[0][0].attendeeMemberIds,
    ).toEqual([attendee, reviewer, stranger]);
    expect(f.members.find.mock.calls[0][0]).toMatchObject({
      branchId: branch,
      membershipStatus: 'active',
    });
  });
  it('includes all active branch members for a church-wide audience', async () => {
    const f = fixture();
    const result = await f.service.previewAudience(user(), {
      groupId,
      audienceMode: 'church',
      audienceServiceUnitIds: [],
      attendeeMemberIds: [],
      attendeeUserIds: [],
    });
    expect(result.memberCount).toBe(2);
    expect(f.members.find.mock.calls[0][0]).toEqual({
      branchId: branch,
      membershipStatus: 'active',
    });
  });
  it('rejects cross-branch or inactive service groups', async () => {
    const f = fixture();
    f.units.countDocuments.mockResolvedValue(0);
    await expect(
      f.service.previewAudience(user(), {
        groupId,
        audienceMode: 'service_groups',
        audienceServiceUnitIds: [id()],
        attendeeMemberIds: [],
        attendeeUserIds: [],
      }),
    ).rejects.toThrow('meeting branch');
  });
  it('requires a service group when that audience mode is selected', async () => {
    const f = fixture();
    await expect(
      f.service.previewAudience(user(), {
        groupId,
        audienceMode: 'service_groups',
        audienceServiceUnitIds: [],
        attendeeMemberIds: [],
        attendeeUserIds: [],
      }),
    ).rejects.toThrow('at least one');
  });
  it('prevents support users from previewing unconfigured general church meetings', async () => {
    const f = fixture();
    await expect(
      f.service.previewAudience(user(), {
        branchId: branch,
        audienceMode: 'church',
        audienceServiceUnitIds: [],
        attendeeMemberIds: [],
        attendeeUserIds: [],
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('General church meeting scheduling', () => {
  it('allows branch leadership to schedule a church meeting without pre-configuring a group', async () => {
    const f = fixture();
    const result = await f.service.create(user(organizer, 'branch_admin'), {
      branchId: branch,
      title: 'Church planning',
      startsAt: '2026-11-05T18:00:00Z',
      endsAt: '2026-11-05T19:00:00Z',
      attendeeUserIds: [],
      sendInvitations: true,
    });
    expect(result).toMatchObject({
      groupId,
      branchId: branch,
      minutesRequired: false,
      invitationsRequested: true,
      invitationsPrepared: false,
    });
  });
});
