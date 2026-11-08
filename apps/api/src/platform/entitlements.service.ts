import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ControlDatabase } from './control-database';
import { getWorkspace } from '../workspaces/workspace-boundary';
import type {
  EntitlementSnapshot,
  FeatureKey,
  QuotaKey,
} from './platform.types';
import { evaluateSubscription, legacySnapshot } from './subscription-rules';

const CACHE_MS = 60_000;

/** 402 Payment Required: the request is valid but the workspace's plan does not allow it. */
export class EntitlementException extends HttpException {
  constructor(
    code: string,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    super({ statusCode: 402, code, message, ...extra }, 402);
  }
}

/*
 * What this worker's workspace may do. Read from the control database and cached briefly; if
 * the control database cannot be reached the last known answer is kept, and with no answer at
 * all the workspace is left unrestricted so a billing outage never locks a church out.
 */
@Injectable()
export class EntitlementsService {
  private readonly logger = new Logger(EntitlementsService.name);
  private readonly workspaceId: string;
  private cached?: { snapshot: EntitlementSnapshot; at: number };
  private loading?: Promise<EntitlementSnapshot>;

  constructor(
    private readonly control: ControlDatabase,
    config: ConfigService,
  ) {
    this.workspaceId = getWorkspace(config).id;
  }

  async snapshot(now = new Date()): Promise<EntitlementSnapshot> {
    if (!this.control.enabled) return legacySnapshot(this.workspaceId);
    if (this.cached && now.getTime() - this.cached.at < CACHE_MS)
      return this.cached.snapshot;
    this.loading ??= this.load(now).finally(() => {
      this.loading = undefined;
    });
    return this.loading;
  }

  /** Forget the cache, for tests and for the control plane after it changes a subscription. */
  invalidate() {
    this.cached = undefined;
  }

  private async load(now: Date) {
    try {
      const subscription = await this.control.subscriptions.findOne({
        _id: this.workspaceId,
      });
      const plan = subscription
        ? await this.control.plans.findOne({ _id: subscription.planId })
        : null;
      const snapshot = evaluateSubscription(subscription, plan, now);
      this.cached = {
        snapshot: { ...snapshot, workspaceId: this.workspaceId },
        at: now.getTime(),
      };
    } catch (error) {
      this.logger.warn(`Entitlements could not be refreshed: ${String(error)}`);
      if (!this.cached) {
        this.cached = {
          snapshot: legacySnapshot(this.workspaceId),
          at: now.getTime(),
        };
      }
    }
    return this.cached.snapshot;
  }

  async hasFeature(feature: FeatureKey) {
    const snapshot = await this.snapshot();
    return !snapshot.enforced || snapshot.features.includes(feature);
  }

  async requireFeature(feature: FeatureKey) {
    if (!(await this.hasFeature(feature))) {
      throw new EntitlementException(
        'feature_locked',
        'This feature is not included in your plan.',
        { feature },
      );
    }
  }

  /** Call before creating a record counted by a quota, with how many already exist. */
  async assertQuota(quota: QuotaKey, current: number) {
    const snapshot = await this.snapshot();
    const limit = snapshot.quotas[quota];
    if (
      snapshot.enforced &&
      limit !== null &&
      limit !== undefined &&
      current >= limit
    ) {
      throw new EntitlementException(
        'quota_exceeded',
        'Your plan’s limit for this has been reached.',
        { quota, limit },
      );
    }
  }
}
