import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ControlDatabase } from './control-database';
import { EntitlementsService } from './entitlements.service';
import type { OperatorClaims } from './operators.service';
import { PlatformAuditService } from './platform-audit.service';
import {
  FEATURE_KEYS,
  type BillingMode,
  type EntitlementSnapshot,
  type FeatureKey,
  type PlanRecord,
  type Quotas,
  type SubscriptionRecord,
  type SubscriptionStatus,
} from './platform.types';
import {
  DEFAULT_PLANS,
  evaluateSubscription,
  legacySnapshot,
  normalizeOverrides,
} from './subscription-rules';

export type PlanInput = {
  name: string;
  description?: string;
  features: FeatureKey[];
  quotas: Partial<Quotas>;
  priceMonthlyCents: number;
  currency: string;
  trialDays: number;
  retired?: boolean;
};

export type SubscriptionInput = {
  planId: string;
  status?: SubscriptionStatus;
  billingMode?: BillingMode;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  graceDays?: number;
  overrides?: { features?: FeatureKey[]; quotas?: Partial<Quotas> };
  notes?: string;
};

const DAY = 24 * 60 * 60 * 1000;

/*
 * Plans and subscriptions. Only manual billing exists today: an operator assigns a plan and
 * records each payment, which extends the paid period. A card processor later only needs to
 * call the same two methods from its webhooks.
 */
@Injectable()
export class PlatformSubscriptionsService implements OnModuleInit {
  constructor(
    private readonly control: ControlDatabase,
    private readonly audit: PlatformAuditService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /** Seed the catalog once so a fresh control plane has something to assign. */
  async onModuleInit() {
    if (!this.control.enabled) return;
    const existing = await this.control.plans.countDocuments({});
    if (existing) return;
    await this.control.plans.insertMany(
      DEFAULT_PLANS.map((plan) => ({ ...plan, updatedAt: new Date() })),
    );
  }

  listPlans() {
    return this.control.plans.find({}).sort({ priceMonthlyCents: 1 }).toArray();
  }

  async getPlan(id: string) {
    const plan = await this.control.plans.findOne({ _id: id });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async upsertPlan(operator: OperatorClaims, id: string, input: PlanInput) {
    const quotas: Quotas = {
      branches: null,
      users: null,
      members: null,
      children: null,
      ...input.quotas,
    };
    const plan: PlanRecord = {
      _id: id,
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      features: FEATURE_KEYS.filter((key) => input.features.includes(key)),
      quotas,
      priceMonthlyCents: input.priceMonthlyCents,
      currency: input.currency.toUpperCase(),
      trialDays: input.trialDays,
      retired: input.retired ?? false,
      updatedAt: new Date(),
    };
    await this.control.plans.replaceOne({ _id: id }, plan, { upsert: true });
    await this.audit.record(operator, 'plan.saved', {
      details: { planId: id },
    });
    return plan;
  }

  get(workspaceId: string) {
    return this.control.subscriptions.findOne({ _id: workspaceId });
  }

  /** The live view of a workspace's plan, as its own API would compute it. */
  async snapshot(
    workspaceId: string,
    now = new Date(),
  ): Promise<EntitlementSnapshot> {
    const subscription = await this.get(workspaceId);
    const plan = subscription
      ? await this.control.plans.findOne({ _id: subscription.planId })
      : null;
    return subscription && plan
      ? evaluateSubscription(subscription, plan, now)
      : legacySnapshot(workspaceId);
  }

  /** Start a trial on a plan, used when a workspace is provisioned. */
  async startTrial(workspaceId: string, planId: string, now = new Date()) {
    const plan = await this.getPlan(planId);
    const record: SubscriptionRecord = {
      _id: workspaceId,
      planId,
      status: plan.trialDays > 0 ? 'trialing' : 'active',
      billingMode: 'manual',
      trialEndsAt:
        plan.trialDays > 0
          ? new Date(now.getTime() + plan.trialDays * DAY)
          : undefined,
      currentPeriodEnd:
        plan.trialDays > 0 ? undefined : new Date(now.getTime() + 30 * DAY),
      graceDays: 7,
      payments: [],
      createdAt: now,
      updatedAt: now,
    };
    await this.control.subscriptions.replaceOne({ _id: workspaceId }, record, {
      upsert: true,
    });
    return record;
  }

  async set(
    operator: OperatorClaims,
    workspaceId: string,
    input: SubscriptionInput,
    reason?: string,
  ) {
    const plan = await this.getPlan(input.planId);
    if (plan.retired)
      throw new BadRequestException(
        'This plan is retired and cannot be assigned.',
      );
    const existing = await this.get(workspaceId);
    const now = new Date();
    const date = (value: string | null | undefined, current?: Date) => {
      if (value === null) return undefined;
      if (value === undefined) return current;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime()))
        throw new BadRequestException('Enter a valid date.');
      return parsed;
    };
    const record: SubscriptionRecord = {
      _id: workspaceId,
      planId: plan._id,
      status:
        input.status ??
        existing?.status ??
        (plan.trialDays > 0 ? 'trialing' : 'active'),
      billingMode: input.billingMode ?? existing?.billingMode ?? 'manual',
      trialEndsAt: date(input.trialEndsAt, existing?.trialEndsAt),
      currentPeriodEnd: date(
        input.currentPeriodEnd,
        existing?.currentPeriodEnd,
      ),
      graceDays: input.graceDays ?? existing?.graceDays ?? 7,
      overrides: normalizeOverrides(input.overrides ?? existing?.overrides),
      payments: existing?.payments ?? [],
      notes: input.notes?.trim() || existing?.notes,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (record.status === 'trialing' && !record.trialEndsAt) {
      record.trialEndsAt = new Date(
        now.getTime() + Math.max(plan.trialDays, 1) * DAY,
      );
    }
    await this.control.subscriptions.replaceOne({ _id: workspaceId }, record, {
      upsert: true,
    });
    await this.audit.record(
      operator,
      existing ? 'subscription.updated' : 'subscription.created',
      {
        workspaceId,
        reason,
        details: {
          planId: plan._id,
          status: record.status,
          currentPeriodEnd: record.currentPeriodEnd,
          trialEndsAt: record.trialEndsAt,
        },
      },
    );
    this.entitlements.invalidate();
    return record;
  }

  /** A payment received outside the app: extends the paid period and reactivates the workspace. */
  async recordPayment(
    operator: OperatorClaims,
    workspaceId: string,
    input: {
      amountCents: number;
      currency: string;
      reference: string;
      periodEnd: string;
      note?: string;
    },
  ) {
    const existing = await this.get(workspaceId);
    if (!existing)
      throw new NotFoundException('This workspace has no subscription yet.');
    const periodEnd = new Date(input.periodEnd);
    if (
      Number.isNaN(periodEnd.getTime()) ||
      periodEnd.getTime() <= Date.now()
    ) {
      throw new BadRequestException('The paid period must end in the future.');
    }
    const payment = {
      at: new Date(),
      amountCents: input.amountCents,
      currency: input.currency.toUpperCase(),
      reference: input.reference.trim(),
      periodEnd,
      note: input.note?.trim() || undefined,
      recordedBy: operator.email,
    };
    const result = await this.control.subscriptions.findOneAndUpdate(
      { _id: workspaceId },
      {
        $set: {
          status: 'active',
          currentPeriodEnd: periodEnd,
          trialEndsAt: undefined,
          updatedAt: payment.at,
        },
        $push: { payments: payment },
      },
      { returnDocument: 'after' },
    );
    await this.audit.record(operator, 'subscription.payment', {
      workspaceId,
      details: {
        amountCents: payment.amountCents,
        currency: payment.currency,
        reference: payment.reference,
        periodEnd,
      },
    });
    this.entitlements.invalidate();
    return result;
  }

  /** Revenue and lifecycle totals for the operator overview. */
  async overview(now = new Date()) {
    const [subscriptions, plans] = await Promise.all([
      this.control.subscriptions.find({}).toArray(),
      this.listPlans(),
    ]);
    const byPlan = new Map(plans.map((plan) => [plan._id, plan]));
    const counts: Record<string, number> = {};
    let monthlyRecurringCents = 0;
    for (const subscription of subscriptions) {
      const snapshot = evaluateSubscription(
        subscription,
        byPlan.get(subscription.planId),
        now,
      );
      counts[snapshot.status] = (counts[snapshot.status] ?? 0) + 1;
      if (snapshot.status === 'active' || snapshot.status === 'past_due') {
        monthlyRecurringCents +=
          byPlan.get(subscription.planId)?.priceMonthlyCents ?? 0;
      }
    }
    return {
      subscriptions: subscriptions.length,
      byStatus: counts,
      monthlyRecurringCents,
    };
  }
}
