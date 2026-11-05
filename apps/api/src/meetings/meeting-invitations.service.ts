import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MailService } from '../mail/mail.service';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  Meeting,
  MeetingDocument,
  MeetingInvitation,
  MeetingInvitationDocument,
} from './meetings.schema';
import { meetingRecipients, normalizeMeetingEmail } from './meeting-recipients';
@Injectable()
export class MeetingInvitationsService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MeetingInvitationsService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(
    @InjectModel(Meeting.name)
    private readonly meetings: Model<MeetingDocument>,
    @InjectModel(MeetingInvitation.name)
    private readonly invitations: Model<MeetingInvitationDocument>,
    @InjectModel(Member.name) private readonly members: Model<MemberDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly mail: MailService,
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.processQueue().catch(() =>
        this.logger.error(
          'Meeting invitation processing failed; queued work is retained.',
        ),
      );
    }, 15000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async recipients(
    m: Pick<Meeting, 'attendeeMemberIds' | 'attendeeUserIds' | 'branchId'>,
  ) {
    const [members, users] = await Promise.all([
      this.members
        .find({ _id: { $in: m.attendeeMemberIds }, branchId: m.branchId })
        .select('_id email')
        .lean(),
      this.users
        .find({ _id: { $in: m.attendeeUserIds }, isActive: true })
        .select('_id email')
        .lean(),
    ]);
    return meetingRecipients(members, users);
  }
  async prepare(m: Meeting & { _id: Types.ObjectId }) {
    const { recipients } = await this.recipients(m);
    if (recipients.length)
      try {
        await this.invitations.bulkWrite(
          recipients.map((row) => ({
            updateOne: {
              filter: { meetingId: m._id, email: row.email },
              update: {
                $set: { memberIds: row.memberIds, userIds: row.userIds },
                $setOnInsert: {
                  email: row.email,
                  meetingId: m._id,
                  status: 'queued',
                },
              },
              upsert: true,
            },
          })),
          { ordered: false },
        );
      } catch (e) {
        const error = e as { code?: number; writeErrors?: { code: number }[] };
        if (
          error.code !== 11000 ||
          error.writeErrors?.some((x) => x.code !== 11000)
        )
          throw e;
      }
    await this.invitations.updateMany(
      {
        meetingId: m._id,
        email: { $in: recipients.map((row) => row.email) },
        status: 'cancelled',
      },
      { $set: { status: 'queued', error: '' } },
    );
    // A concurrent audience edit must be prepared again, even if this batch finished.
    await this.meetings.updateOne(
      { _id: m._id, revision: (m as Meeting).revision },
      { $set: { invitationsPrepared: true } },
    );
  }
  async summary(m: Meeting & { _id: Types.ObjectId }) {
    const [{ missingEmail, recipients }, counts] = await Promise.all([
      this.recipients(m),
      this.invitations.aggregate<{ _id: string; count: number }>([
        { $match: { meetingId: m._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);
    return {
      requested: m.invitationsRequested,
      prepared: m.invitationsPrepared,
      uniqueEmails: recipients.length,
      missingEmail,
      counts: Object.fromEntries(counts.map((x) => [x._id, x.count])),
    };
  }
  async retryFailed(id: string) {
    await this.invitations.updateMany(
      { meetingId: id, status: 'failed' },
      { $set: { status: 'queued', error: '' } },
    );
  }
  async processQueue() {
    if (this.running) return;
    this.running = true;
    try {
      // SMTP cannot guarantee exactly-once delivery after an interrupted connection.
      // Ambiguous attempts are never automatically resent.
      await this.invitations.updateMany(
        {
          status: 'sending',
          claimedAt: { $lt: new Date(Date.now() - 5 * 60000) },
        },
        {
          $set: {
            status: 'uncertain',
            error:
              'Delivery could not be confirmed. Do not resend without checking the mail provider.',
          },
        },
      );
      const pending = await this.meetings
        .find({
          invitationsRequested: true,
          invitationsPrepared: false,
          status: { $ne: 'cancelled' },
        })
        .limit(20)
        .lean();
      for (const m of pending) await this.prepare(m);
      for (let i = 0; i < 25; i++) {
        const row = await this.invitations
          .findOneAndUpdate(
            { status: 'queued' },
            { $set: { status: 'sending', claimedAt: new Date() } },
            { new: true, sort: { createdAt: 1 } },
          )
          .lean();
        if (!row) break;
        try {
          const m = await this.meetings.findById(row.meetingId).lean();
          if (!m || m.status === 'cancelled' || !m.invitationsRequested) {
            await this.invitations.updateOne(
              { _id: row._id },
              {
                $set: {
                  status: 'cancelled',
                  error: 'Meeting cancelled or invitations disabled.',
                },
              },
            );
            continue;
          }
          const [memberSources, userSources] = await Promise.all([
            this.members
              .find({
                _id: {
                  $in: row.memberIds.filter((id) =>
                    m.attendeeMemberIds.includes(id),
                  ),
                },
                branchId: m.branchId,
              })
              .select('_id email')
              .lean(),
            this.users
              .find({
                _id: {
                  $in: row.userIds.filter((id) =>
                    m.attendeeUserIds.includes(id),
                  ),
                },
                isActive: true,
              })
              .select('_id email')
              .lean(),
          ]);
          if (
            ![...memberSources, ...userSources].some(
              (x) => normalizeMeetingEmail(x.email) === row.email,
            )
          ) {
            await this.invitations.updateOne(
              { _id: row._id },
              {
                $set: {
                  status: 'cancelled',
                  error: 'Address is no longer in the meeting audience.',
                },
              },
            );
            continue;
          }
          const result = await this.mail.sendAppEmail({
            to: row.email,
            subject: `Meeting invitation: ${m.title.replace(/[\r\n]/g, ' ')}`,
            text: [
              `You are invited to ${m.title}.`,
              `Starts: ${m.startsAt.toISOString()} (UTC)`,
              `Ends: ${m.endsAt.toISOString()} (UTC)`,
              m.location ? `Location: ${m.location}` : '',
              m.joinUrl ? `Join meeting: ${m.joinUrl}` : '',
              m.agenda ? `Agenda:\n${m.agenda}` : '',
            ]
              .filter(Boolean)
              .join('\n\n'),
          });
          await this.invitations.updateOne(
            { _id: row._id, status: 'sending' },
            {
              $set: result.delivered
                ? {
                    status: 'sent',
                    sentAt: new Date(),
                    messageId: result.messageId,
                    error: '',
                  }
                : {
                    status: 'failed',
                    error:
                      'Email delivery is not configured. Configure SMTP, then retry.',
                  },
            },
          );
        } catch {
          await this.invitations.updateOne(
            { _id: row._id, status: 'sending' },
            {
              $set: {
                status: 'uncertain',
                error:
                  'Delivery could not be confirmed. Check the mail provider before resending.',
              },
            },
          );
        }
      }
    } finally {
      this.running = false;
    }
  }
}
