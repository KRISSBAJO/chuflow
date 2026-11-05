import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { ApprovalNotice } from './approval.schema';
import { ApprovalWorkflowsService } from './approval.service';
import { User } from '../users/schemas/user.schema';
import { MailService } from '../mail/mail.service';
@Injectable()
export class ApprovalWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(ApprovalWorker.name);
  constructor(
    private readonly service: ApprovalWorkflowsService,
    @InjectModel(ApprovalNotice.name)
    private readonly notices: Model<ApprovalNotice>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick();
    }, 60000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.service.queueNotices();
      for (let i = 0; i < 25; i++) {
        const job = await this.notices
          .findOneAndUpdate(
            {
              attempts: { $lt: 5 },
              availableAt: { $lte: new Date() },
              $or: [
                { status: 'pending' },
                { status: 'sending', leaseUntil: { $lt: new Date() } },
              ],
            },
            {
              $set: {
                status: 'sending',
                leaseUntil: new Date(Date.now() + 300000),
              },
              $inc: { attempts: 1 },
            },
            { new: true },
          )
          .lean();
        if (!job) break;
        try {
          const user = await this.users
            .findOne({ _id: job.userId, isActive: true })
            .select('email')
            .lean();
          if (!user || /@example\.com$/i.test(user.email)) {
            await this.notices.updateOne(
              { _id: job._id },
              { $set: { status: 'skipped' } },
            );
            continue;
          }
          const base =
            this.config.get<string>('webUrl') || 'https://www.chuflow.com';
          const result = await this.mail.sendAppEmail({
            to: user.email,
            subject: 'ChuFlow approval update',
            text: `An approval request has an update or needs your review. Sign in to view it: ${base}/approvals/requests/${job.requestId}`,
          });
          if (!result.delivered) throw new Error('Email delivery unavailable');
          await this.notices.updateOne(
            { _id: job._id },
            { $set: { status: 'sent' } },
          );
        } catch {
          await this.notices.updateOne(
            { _id: job._id },
            {
              $set: {
                status: 'pending',
                availableAt: new Date(Date.now() + 3600000),
              },
            },
          );
        }
      }
    } catch (e) {
      this.logger.warn(
        e instanceof Error ? e.message : 'Approval notification failed',
      );
    } finally {
      this.running = false;
    }
  }
}
