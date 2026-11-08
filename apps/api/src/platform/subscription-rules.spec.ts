import type { PlanRecord, SubscriptionRecord } from './platform.types';
import {
  DEFAULT_PLANS,
  evaluateSubscription,
  legacySnapshot,
  normalizeOverrides,
} from './subscription-rules';

describe('normalizeOverrides', () => {
  it('drops undefined quota keys the validation pipe defines on DTO instances', () => {
    expect(
      normalizeOverrides({
        features: [],
        quotas: {
          branches: undefined,
          users: undefined,
          members: 2500,
          children: null,
        },
      }),
    ).toEqual({ quotas: { members: 2500, children: null } });
  });

  it('returns nothing when no override carries a value', () => {
    expect(normalizeOverrides({ features: [], quotas: {} })).toBeUndefined();
    expect(normalizeOverrides(undefined)).toBeUndefined();
  });

  it('keeps feature overrides in catalog order', () => {
    expect(
      normalizeOverrides({ features: ['finance', 'kids', 'finance'] }),
    ).toEqual({ features: ['kids', 'finance'] });
  });
});

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-11-08T12:00:00Z');
const days = (count: number) => new Date(now.getTime() + count * DAY);

const plan = (id: string): PlanRecord => {
  const found = DEFAULT_PLANS.find((item) => item._id === id)!;
  return { ...found, updatedAt: now };
};

function subscription(
  overrides: Partial<SubscriptionRecord>,
): SubscriptionRecord {
  return {
    _id: 'test-church',
    planId: 'growth',
    status: 'active',
    billingMode: 'manual',
    graceDays: 7,
    payments: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('subscription lifecycle', () => {
  it('leaves a workspace unrestricted when nothing is recorded', () => {
    const snapshot = evaluateSubscription(null, null, now);
    expect(snapshot).toEqual(legacySnapshot(''));
    expect(snapshot.enforced).toBe(false);
    expect(snapshot.quotas.members).toBeNull();
  });

  it('gives full access during a trial and through the grace period, then read-only', () => {
    const trial = subscription({
      planId: 'trial',
      status: 'trialing',
      trialEndsAt: days(3),
    });
    expect(evaluateSubscription(trial, plan('trial'), now)).toMatchObject({
      access: 'full',
      status: 'trialing',
    });

    const ended = subscription({
      planId: 'trial',
      status: 'trialing',
      trialEndsAt: days(-2),
    });
    expect(evaluateSubscription(ended, plan('trial'), now)).toMatchObject({
      access: 'full',
      status: 'past_due',
      reason: 'trial_ended',
      graceEndsAt: days(5).toISOString(),
    });

    const expired = subscription({
      planId: 'trial',
      status: 'trialing',
      trialEndsAt: days(-9),
    });
    expect(evaluateSubscription(expired, plan('trial'), now)).toMatchObject({
      access: 'read_only',
      status: 'delinquent',
    });
  });

  it('turns a paid plan read-only once the period and grace have passed', () => {
    const paid = subscription({ currentPeriodEnd: days(10) });
    expect(evaluateSubscription(paid, plan('growth'), now).access).toBe('full');

    const overdue = subscription({ currentPeriodEnd: days(-1) });
    expect(evaluateSubscription(overdue, plan('growth'), now)).toMatchObject({
      status: 'past_due',
      access: 'full',
      reason: 'payment_overdue',
    });

    const delinquent = subscription({ currentPeriodEnd: days(-8) });
    expect(evaluateSubscription(delinquent, plan('growth'), now)).toMatchObject(
      { status: 'delinquent', access: 'read_only' },
    );

    const noGrace = subscription({ currentPeriodEnd: days(-1), graceDays: 0 });
    expect(evaluateSubscription(noGrace, plan('growth'), now).access).toBe(
      'read_only',
    );
  });

  it('locks suspended workspaces and winds down cancelled ones', () => {
    expect(
      evaluateSubscription(
        subscription({ status: 'suspended' }),
        plan('growth'),
        now,
      ),
    ).toMatchObject({ access: 'locked', reason: 'suspended' });
    expect(
      evaluateSubscription(
        subscription({ status: 'cancelled', currentPeriodEnd: days(5) }),
        plan('growth'),
        now,
      ),
    ).toMatchObject({ access: 'read_only', reason: 'cancelled' });
    expect(
      evaluateSubscription(
        subscription({ status: 'cancelled', currentPeriodEnd: days(-5) }),
        plan('growth'),
        now,
      ).access,
    ).toBe('locked');
  });

  it('applies plan features and quotas with per-workspace overrides', () => {
    const starter = evaluateSubscription(
      subscription({ planId: 'starter', currentPeriodEnd: days(10) }),
      plan('starter'),
      now,
    );
    expect(starter.features).not.toContain('kids');
    expect(starter.quotas).toMatchObject({ branches: 1, users: 10 });

    const boosted = evaluateSubscription(
      subscription({
        planId: 'starter',
        currentPeriodEnd: days(10),
        overrides: { features: ['kids'], quotas: { branches: 3 } },
      }),
      plan('starter'),
      now,
    );
    expect(boosted.features).toContain('kids');
    expect(boosted.quotas.branches).toBe(3);
    expect(boosted.quotas.users).toBe(10);

    expect(
      evaluateSubscription(
        subscription({ planId: 'enterprise', currentPeriodEnd: days(10) }),
        plan('enterprise'),
        now,
      ).quotas.members,
    ).toBeNull();
  });
});
