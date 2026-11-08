import {
  EntitlementSnapshot,
  FEATURE_KEYS,
  FeatureKey,
  PlanRecord,
  Quotas,
  SubscriptionRecord,
  UNLIMITED_QUOTAS,
} from './platform.types';

/*
 * Pure rules: given a subscription and its plan, what may the workspace do right now?
 * Kept free of I/O so the lifecycle can be tested exhaustively.
 */

const DAY = 24 * 60 * 60 * 1000;

export const DEFAULT_PLANS: Omit<PlanRecord, 'updatedAt'>[] = [
  {
    _id: 'trial',
    name: 'Trial',
    description: 'Everything for 14 days, sized for one church.',
    features: [...FEATURE_KEYS],
    quotas: { branches: 2, users: 10, members: 500, children: 200 },
    priceMonthlyCents: 0,
    currency: 'USD',
    trialDays: 14,
  },
  {
    _id: 'starter',
    name: 'Starter',
    description:
      'Guests, members, attendance and follow-up for a single branch.',
    features: [
      'guests',
      'members',
      'attendance',
      'follow_up',
      'care',
      'meetings',
      'reporting',
    ],
    quotas: { branches: 1, users: 10, members: 1000, children: 0 },
    priceMonthlyCents: 4900,
    currency: 'USD',
    trialDays: 14,
  },
  {
    _id: 'growth',
    name: 'Growth',
    description:
      'Multi-branch churches with Kids Ministry, finance and communications.',
    features: [
      'guests',
      'members',
      'attendance',
      'follow_up',
      'care',
      'meetings',
      'kids',
      'finance',
      'communications',
      'reporting',
      'exports',
    ],
    quotas: { branches: 10, users: 60, members: 10000, children: 2000 },
    priceMonthlyCents: 14900,
    currency: 'USD',
    trialDays: 14,
  },
  {
    _id: 'enterprise',
    name: 'Enterprise',
    description:
      'National and multi-national networks: unlimited scale, API access and priority support.',
    features: [...FEATURE_KEYS],
    quotas: { ...UNLIMITED_QUOTAS },
    priceMonthlyCents: 0,
    currency: 'USD',
    trialDays: 30,
  },
];

export function legacySnapshot(workspaceId: string): EntitlementSnapshot {
  return {
    workspaceId,
    enforced: false,
    planId: 'legacy',
    planName: 'Unrestricted',
    status: 'legacy',
    access: 'full',
    features: [...FEATURE_KEYS],
    quotas: { ...UNLIMITED_QUOTAS },
  };
}

function iso(date?: Date) {
  return date ? new Date(date).toISOString() : undefined;
}

function addDays(date: Date, days: number) {
  return new Date(new Date(date).getTime() + days * DAY);
}

/*
 * Drops override keys that carry no value. The validation pipe instantiates DTO classes, which
 * defines every optional quota as `undefined`; stored as-is that would read as "unlimited".
 * An explicit `null` stays: it is a deliberate unlimited override.
 */
export function normalizeOverrides(
  overrides: SubscriptionRecord['overrides'] | null | undefined,
): SubscriptionRecord['overrides'] {
  if (!overrides) return undefined;
  const features = FEATURE_KEYS.filter((key) =>
    overrides.features?.includes(key),
  );
  const quotas: Partial<Quotas> = {};
  for (const [key, value] of Object.entries(overrides.quotas ?? {})) {
    if (value !== undefined && key in UNLIMITED_QUOTAS)
      quotas[key as keyof Quotas] = value;
  }
  const result: NonNullable<SubscriptionRecord['overrides']> = {};
  if (features.length) result.features = features;
  if (Object.keys(quotas).length) result.quotas = quotas;
  return Object.keys(result).length ? result : undefined;
}

export function effectiveQuotas(
  plan: PlanRecord,
  subscription: SubscriptionRecord,
): Quotas {
  return {
    ...UNLIMITED_QUOTAS,
    ...plan.quotas,
    ...(normalizeOverrides(subscription.overrides)?.quotas ?? {}),
  };
}

export function effectiveFeatures(
  plan: PlanRecord,
  subscription: SubscriptionRecord,
): FeatureKey[] {
  const extra = subscription.overrides?.features ?? [];
  return FEATURE_KEYS.filter(
    (key) => plan.features.includes(key) || extra.includes(key),
  );
}

/** The lifecycle: trial → active → past due with grace → read-only → suspended/cancelled → locked. */
export function evaluateSubscription(
  subscription: SubscriptionRecord | null | undefined,
  plan: PlanRecord | null | undefined,
  now = new Date(),
): EntitlementSnapshot {
  const workspaceId = subscription?._id ?? '';
  if (!subscription || !plan) return legacySnapshot(workspaceId);

  const base: EntitlementSnapshot = {
    workspaceId,
    enforced: true,
    planId: plan._id,
    planName: plan.name,
    status: subscription.status,
    access: 'full',
    features: effectiveFeatures(plan, subscription),
    quotas: effectiveQuotas(plan, subscription),
    billingMode: subscription.billingMode,
    trialEndsAt: iso(subscription.trialEndsAt),
    currentPeriodEnd: iso(subscription.currentPeriodEnd),
  };
  const grace = Math.max(0, subscription.graceDays ?? 0);

  if (subscription.status === 'suspended') {
    return { ...base, access: 'locked', reason: 'suspended' };
  }
  if (subscription.status === 'cancelled') {
    const end = subscription.currentPeriodEnd;
    const stillPaid = !!end && new Date(end).getTime() > now.getTime();
    return {
      ...base,
      access: stillPaid ? 'read_only' : 'locked',
      reason: 'cancelled',
    };
  }

  // A deadline after which the workspace owes a payment, if any.
  const deadline =
    subscription.status === 'trialing'
      ? subscription.trialEndsAt
      : subscription.currentPeriodEnd;
  if (!deadline) return base;
  const due = new Date(deadline);
  if (due.getTime() > now.getTime() && subscription.status !== 'past_due')
    return base;

  const graceEndsAt = addDays(due, grace);
  const reason =
    subscription.status === 'trialing' ? 'trial_ended' : 'payment_overdue';
  if (graceEndsAt.getTime() > now.getTime()) {
    return {
      ...base,
      status: 'past_due',
      graceEndsAt: iso(graceEndsAt),
      reason,
    };
  }
  return {
    ...base,
    status: 'delinquent',
    access: 'read_only',
    graceEndsAt: iso(graceEndsAt),
    reason,
  };
}

/** Strip nothing today, but keep one place to decide what clients may see. */
export function publicSnapshot(
  snapshot: EntitlementSnapshot,
): EntitlementSnapshot {
  return snapshot;
}
