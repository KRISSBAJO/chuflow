import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import webpush, { WebPushError } from 'web-push';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { AppRole, DISTRICT_ROLES } from '../common/constants/roles.constants';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  CreatePushSubscriptionDto,
  RemovePushSubscriptionDto,
} from './dto/push-subscription.dto';
import {
  PushSubscription,
  PushSubscriptionDocument,
} from './schemas/push-subscription.schema';

export type PushPayload = {
  title: string;
  body: string;
  /** Path inside the web app opened when the notification is tapped. */
  url: string;
  /** Notifications sharing a tag replace each other on the device instead of stacking. */
  tag?: string;
};

type Recipients = { userIds?: string[]; filter?: Record<string, unknown> };

/**
 * Web Push delivery for the installable web app. Every `notify*` method is fire-and-forget:
 * it never throws and never delays the request that triggered it.
 */
@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private enabled = false;
  private publicKey?: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(PushSubscription.name)
    private readonly subscriptionModel: Model<PushSubscriptionDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
  ) {}

  onModuleInit() {
    const publicKey = this.configService.get<string>('vapidPublicKey');
    const privateKey = this.configService.get<string>('vapidPrivateKey');
    const subject = this.configService.get<string>('vapidSubject');

    if (!publicKey || !privateKey || !subject) {
      this.logger.warn(
        'Push notifications are off: set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT to enable them.',
      );
      return;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.publicKey = publicKey;
    this.enabled = true;
  }

  getPublicConfig() {
    return { enabled: this.enabled, publicKey: this.publicKey ?? null };
  }

  async subscribe(
    currentUser: AuthUser,
    dto: CreatePushSubscriptionDto,
    userAgent?: string,
  ) {
    await this.subscriptionModel.updateOne(
      { endpoint: dto.endpoint },
      {
        userId: new Types.ObjectId(currentUser.sub),
        endpoint: dto.endpoint,
        keys: dto.keys,
        userAgent: userAgent?.slice(0, 300),
      },
      { upsert: true },
    );
    return { subscribed: true };
  }

  async unsubscribe(currentUser: AuthUser, dto: RemovePushSubscriptionDto) {
    await this.subscriptionModel.deleteOne({
      endpoint: dto.endpoint,
      userId: new Types.ObjectId(currentUser.sub),
    });
    return { subscribed: false };
  }

  async sendTest(currentUser: AuthUser) {
    const delivered = await this.deliver(
      { userIds: [currentUser.sub] },
      {
        title: 'Notifications are on',
        body: 'This device will now get ChuFlow alerts for your church.',
        url: '/dashboard',
        tag: 'chuflow-test',
      },
    );
    return { delivered };
  }

  notifyUsers(userIds: string[], payload: PushPayload, excludeUserId?: string) {
    const ids = userIds.filter((id) => id && id !== excludeUserId);
    if (!ids.length) return;
    this.dispatch({ userIds: ids }, payload);
  }

  /** Notifies users with the given roles who belong to one branch. */
  notifyBranchTeam(
    branchId: unknown,
    roles: AppRole[],
    payload: PushPayload,
    excludeUserId?: string,
  ) {
    const id = this.toIdString(branchId);
    if (!id) return;
    this.dispatch(
      {
        filter: {
          role: { $in: roles },
          branchId: { $in: [new Types.ObjectId(id), id] },
          ...this.excludeFilter(excludeUserId),
        },
      },
      payload,
    );
  }

  /** Notifies the district leaders who oversee the given branch. */
  notifyDistrictTeam(
    branchId: unknown,
    payload: PushPayload,
    excludeUserId?: string,
  ) {
    const id = this.toIdString(branchId);
    if (!id || !this.enabled) return;

    void this.branchModel
      .findById(id)
      .select('district oversightRegion')
      .lean()
      .then((branch) => {
        if (!branch) return;
        this.dispatch(
          {
            filter: {
              role: { $in: DISTRICT_ROLES },
              district: branch.district,
              oversightRegion: branch.oversightRegion,
              ...this.excludeFilter(excludeUserId),
            },
          },
          payload,
        );
      })
      .catch((error: unknown) => this.logFailure(error));
  }

  async branchName(branchId: unknown) {
    const id = this.toIdString(branchId);
    if (!id) return null;
    const branch = await this.branchModel.findById(id).select('name').lean();
    return branch?.name ?? null;
  }

  private dispatch(recipients: Recipients, payload: PushPayload) {
    if (!this.enabled) return;
    void this.deliver(recipients, payload).catch((error: unknown) =>
      this.logFailure(error),
    );
  }

  private async deliver(recipients: Recipients, payload: PushPayload) {
    if (!this.enabled) return 0;

    const userFilter: Record<string, unknown> = {
      isActive: true,
      ...(recipients.filter ?? {}),
    };
    if (recipients.userIds) {
      userFilter._id = {
        $in: recipients.userIds.map((id) => new Types.ObjectId(id)),
      };
    }

    const users = await this.userModel.find(userFilter).select('_id').lean();
    if (!users.length) return 0;

    const subscriptions = await this.subscriptionModel
      .find({ userId: { $in: users.map((user) => user._id) } })
      .lean();
    if (!subscriptions.length) return 0;

    const body = JSON.stringify(payload);
    const results = await Promise.allSettled(
      subscriptions.map((subscription) =>
        webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: subscription.keys },
          body,
          { TTL: 60 * 60 * 24, urgency: 'normal' },
        ),
      ),
    );

    const expired: string[] = [];
    const deliveredIds: Types.ObjectId[] = [];
    results.forEach((result, index) => {
      const subscription = subscriptions[index];
      if (result.status === 'fulfilled') {
        deliveredIds.push(subscription._id);
        return;
      }
      const reason = result.reason as unknown;
      // 404/410 mean the browser revoked this subscription; forget it.
      if (
        reason instanceof WebPushError &&
        [404, 410].includes(reason.statusCode)
      ) {
        expired.push(subscription.endpoint);
      } else {
        this.logFailure(reason);
      }
    });

    if (expired.length) {
      await this.subscriptionModel.deleteMany({ endpoint: { $in: expired } });
    }
    if (deliveredIds.length) {
      await this.subscriptionModel.updateMany(
        { _id: { $in: deliveredIds } },
        { lastDeliveredAt: new Date() },
      );
    }

    return deliveredIds.length;
  }

  private excludeFilter(excludeUserId?: string) {
    return excludeUserId && Types.ObjectId.isValid(excludeUserId)
      ? { _id: { $ne: new Types.ObjectId(excludeUserId) } }
      : {};
  }

  private toIdString(value: unknown): string | null {
    if (!value) return null;
    if (value instanceof Types.ObjectId) return value.toHexString();
    if (typeof value === 'object' && '_id' in value) {
      return this.toIdString((value as { _id?: unknown })._id);
    }
    return typeof value === 'string' && Types.ObjectId.isValid(value)
      ? value
      : null;
  }

  private logFailure(error: unknown) {
    this.logger.warn(
      `Push delivery failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
