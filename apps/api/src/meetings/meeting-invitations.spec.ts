import { Model, Types } from 'mongoose';
import {
  meetingRecipients,
  normalizeMeetingEmail,
  serviceAudienceFilter,
} from './meeting-recipients';
import { MeetingInvitationsService } from './meeting-invitations.service';
import {
  Meeting,
  MeetingDocument,
  MeetingInvitationDocument,
  MeetingInvitationSchema,
} from './meetings.schema';
import { MemberDocument } from '../members/schemas/member.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { MailService } from '../mail/mail.service';
const meetingId = new Types.ObjectId(),
  branchId = new Types.ObjectId(),
  memberId = String(new Types.ObjectId()),
  userId = String(new Types.ObjectId());
function fixture() {
  const m = {
    _id: meetingId,
    branchId,
    title: 'Planning',
    startsAt: new Date('2026-11-05T18:00:00Z'),
    endsAt: new Date('2026-11-05T19:00:00Z'),
    attendeeMemberIds: [memberId],
    attendeeUserIds: [userId],
    invitationsRequested: true,
    invitationsPrepared: false,
    status: 'scheduled',
    revision: 0,
    joinUrl: 'https://meet.google.com/test',
    agenda: 'Agenda',
  } as Meeting & { _id: Types.ObjectId };
  type Row = {
    _id: Types.ObjectId;
    meetingId: Types.ObjectId;
    email: string;
    status: string;
    memberIds: string[];
    userIds: string[];
    claimedAt?: Date;
    error?: string;
  };
  const rows = new Map<string, Row>();
  type Operation = {
    updateOne: {
      filter: { email: string };
      update: {
        $set: { memberIds: string[]; userIds: string[] };
        $setOnInsert: {
          email: string;
          meetingId: Types.ObjectId;
          status: string;
        };
      };
    };
  };
  const invitations = {
    bulkWrite: jest.fn(async (ops: Operation[]) => {
      for (const op of ops) {
        const email = op.updateOne.filter.email;
        const old = rows.get(email);
        if (old) Object.assign(old, op.updateOne.update.$set);
        else
          rows.set(email, {
            _id: new Types.ObjectId(),
            ...op.updateOne.update.$setOnInsert,
            ...op.updateOne.update.$set,
          });
      }
    }),
    updateMany: jest.fn(
      async (
        filter: {
          status?: string;
          email?: { $in: string[] };
          claimedAt?: { $lt: Date };
        },
        update: { $set: Partial<Row> },
      ) => {
        for (const row of rows.values())
          if (
            (!filter.status || row.status === filter.status) &&
            (!filter.email || filter.email.$in.includes(row.email)) &&
            (!filter.claimedAt ||
              (!!row.claimedAt && row.claimedAt < filter.claimedAt.$lt))
          )
            Object.assign(row, update.$set);
      },
    ),
    findOneAndUpdate: jest.fn(
      (_filter: unknown, update: { $set: Partial<Row> }) => {
        const row = [...rows.values()].find((x) => x.status === 'queued');
        if (row) Object.assign(row, update.$set);
        return { lean: async () => row || null };
      },
    ),
    updateOne: jest.fn(
      async (
        filter: { _id: Types.ObjectId; status?: string },
        update: { $set: Partial<Row> },
      ) => {
        const row = [...rows.values()].find(
          (x) => String(x._id) === String(filter._id),
        );
        if (row && (!filter.status || row.status === filter.status))
          Object.assign(row, update.$set);
      },
    ),
  };
  const members = {
    find: jest.fn((filter: { _id: { $in: string[] } }) => ({
      select: () => ({
        lean: async () =>
          filter._id.$in.includes(memberId)
            ? [{ _id: memberId, email: 'shared@example.com' }]
            : [],
      }),
    })),
  };
  const users = {
    find: jest.fn((filter: { _id: { $in: string[] } }) => ({
      select: () => ({
        lean: async () =>
          filter._id.$in.includes(userId)
            ? [{ _id: userId, email: ' SHARED@EXAMPLE.COM ' }]
            : [],
      }),
    })),
  };
  const meetings = {
    find: jest.fn(() => ({ limit: () => ({ lean: async () => [] }) })),
    findById: jest.fn(() => ({ lean: async () => m })),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
  const mail = {
    sendAppEmail: jest
      .fn()
      .mockResolvedValue({ delivered: true, messageId: 'smtp-id' }),
  };
  const make = () =>
    new MeetingInvitationsService(
      meetings as unknown as Model<MeetingDocument>,
      invitations as unknown as Model<MeetingInvitationDocument>,
      members as unknown as Model<MemberDocument>,
      users as unknown as Model<UserDocument>,
      mail as unknown as MailService,
    );
  return { m, rows, invitations, meetings, mail, make };
}
describe('Meeting audience email de-duplication', () => {
  it('combines overlapping member IDs, member records and staff records by normalized email', () => {
    const result = meetingRecipients(
      [
        { _id: 'm1', email: ' Person@Example.com ' },
        { _id: 'm1', email: 'person@example.com' },
        { _id: 'm2', email: 'PERSON@example.com' },
      ],
      [{ _id: 'u1', email: 'person@example.com' }],
    );
    expect(result.recipients).toEqual([
      { email: 'person@example.com', memberIds: ['m1', 'm2'], userIds: ['u1'] },
    ]);
  });
  it('counts missing and invalid addresses without treating them as deliverable', () => {
    const result = meetingRecipients(
      [
        { _id: '1' },
        { _id: '2', email: 'bad' },
        { _id: '3', email: 'ok@example.com' },
      ],
      [],
    );
    expect(result.missingEmail).toBe(2);
    expect(result.recipients).toHaveLength(1);
    expect(normalizeMeetingEmail('bad')).toBeNull();
  });
  it('matches both multiple service-group membership and legacy single-group placement', () => {
    expect(serviceAudienceFilter('branch', ['g1', 'g2'])).toEqual({
      branchId: 'branch',
      $or: [
        { serviceUnitIds: { $in: ['g1', 'g2'] } },
        {
          serviceUnitIds: { $exists: false },
          serviceUnitId: { $in: ['g1', 'g2'] },
        },
      ],
    });
  });
});
describe('Durable meeting invitation queue', () => {
  it('prepares the same address once even if batches are repeated', async () => {
    const f = fixture();
    await f.make().prepare(f.m);
    await f.make().prepare(f.m);
    expect(f.rows.size).toBe(1);
    expect(f.rows.get('shared@example.com')).toMatchObject({
      memberIds: [memberId],
      userIds: [userId],
      status: 'queued',
    });
  });
  it('has one email send when two workers claim the same audience concurrently', async () => {
    const f = fixture();
    await f.make().prepare(f.m);
    await Promise.all([f.make().processQueue(), f.make().processQueue()]);
    expect(f.mail.sendAppEmail).toHaveBeenCalledTimes(1);
    expect(f.rows.get('shared@example.com')?.status).toBe('sent');
    expect(f.mail.sendAppEmail.mock.calls[0][0]).toMatchObject({
      to: 'shared@example.com',
      subject: 'Meeting invitation: Planning',
      text: expect.stringContaining('https://meet.google.com/test'),
    });
  });
  it('does not resend already-sent invitations after another preparation or worker pass', async () => {
    const f = fixture();
    const service = f.make();
    await service.prepare(f.m);
    await service.processQueue();
    await service.prepare(f.m);
    await service.processQueue();
    await service.retryFailed(String(meetingId));
    await service.processQueue();
    expect(f.mail.sendAppEmail).toHaveBeenCalledTimes(1);
  });
  it('records missing SMTP as failed and retries it only on explicit request', async () => {
    const f = fixture();
    f.mail.sendAppEmail.mockResolvedValue({
      delivered: false,
      messageId: null,
    });
    const service = f.make();
    await service.prepare(f.m);
    await service.processQueue();
    expect(f.rows.get('shared@example.com')?.status).toBe('failed');
    await service.processQueue();
    expect(f.mail.sendAppEmail).toHaveBeenCalledTimes(1);
    f.mail.sendAppEmail.mockResolvedValue({
      delivered: true,
      messageId: 'later',
    });
    await service.retryFailed(String(meetingId));
    await service.processQueue();
    expect(f.mail.sendAppEmail).toHaveBeenCalledTimes(2);
    expect(f.rows.get('shared@example.com')?.status).toBe('sent');
  });
  it('does not automatically resend after an ambiguous SMTP error', async () => {
    const f = fixture();
    f.mail.sendAppEmail.mockRejectedValue(new Error('socket interrupted'));
    const service = f.make();
    await service.prepare(f.m);
    await service.processQueue();
    await service.retryFailed(String(meetingId));
    await service.processQueue();
    expect(f.mail.sendAppEmail).toHaveBeenCalledTimes(1);
    expect(f.rows.get('shared@example.com')?.status).toBe('uncertain');
  });
  it('does not send cancelled meetings', async () => {
    const f = fixture();
    await f.make().prepare(f.m);
    f.m.status = 'cancelled';
    await f.make().processQueue();
    expect(f.mail.sendAppEmail).not.toHaveBeenCalled();
    expect(f.rows.get('shared@example.com')?.status).toBe('cancelled');
  });
  it('does not send to a removed member or staff account', async () => {
    const f = fixture();
    await f.make().prepare(f.m);
    f.m.attendeeMemberIds = [];
    f.m.attendeeUserIds = [];
    await f.make().processQueue();
    expect(f.mail.sendAppEmail).not.toHaveBeenCalled();
  });
  it('moves interrupted attempts to uncertain without re-claiming them', async () => {
    const f = fixture();
    await f.make().prepare(f.m);
    Object.assign(f.rows.get('shared@example.com')!, {
      status: 'sending',
      claimedAt: new Date(Date.now() - 10 * 60000),
    });
    await f.make().processQueue();
    expect(f.mail.sendAppEmail).not.toHaveBeenCalled();
    expect(f.rows.get('shared@example.com')?.status).toBe('uncertain');
  });
});

describe('Invitation persistence uniqueness', () => {
  it('enforces one address per meeting with a database unique index', () => {
    expect(MeetingInvitationSchema.indexes()).toContainEqual([
      { meetingId: 1, email: 1 },
      { unique: true, background: true },
    ]);
  });
});
