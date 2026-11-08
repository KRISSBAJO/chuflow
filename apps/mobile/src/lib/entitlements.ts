import { useSession } from './session';
import type { EntitlementSnapshot, FeatureKey } from './types';

/*
 * Plan checks for the phone app. Everything here is a no-op when the API enforces no plan,
 * so churches without a control plane see the app exactly as before.
 */

export function hasFeature(entitlements: EntitlementSnapshot | null | undefined, feature: FeatureKey) {
  if (!entitlements?.enforced) return true;
  return entitlements.features.includes(feature);
}

export type PlanState =
  | { kind: 'trial'; days: number }
  | { kind: 'past_due'; until?: string }
  | { kind: 'read_only'; reason?: EntitlementSnapshot['reason'] }
  | { kind: 'locked'; reason?: EntitlementSnapshot['reason'] };

function daysLeft(value?: string) {
  if (!value) return 0;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000));
}

/** The one thing worth telling the church right now, or null when all is well. */
export function planState(entitlements: EntitlementSnapshot | null | undefined): PlanState | null {
  if (!entitlements?.enforced) return null;
  if (entitlements.access === 'locked') return { kind: 'locked', reason: entitlements.reason };
  if (entitlements.access === 'read_only') return { kind: 'read_only', reason: entitlements.reason };
  if (entitlements.status === 'past_due') return { kind: 'past_due', until: entitlements.graceEndsAt };
  if (entitlements.status === 'trialing') return { kind: 'trial', days: daysLeft(entitlements.trialEndsAt) };
  return null;
}

/** `allows(feature)` answers whether the plan includes it; roles are checked separately. */
export function usePlan() {
  const { user } = useSession();
  const entitlements = user?.entitlements;
  return {
    entitlements,
    state: planState(entitlements),
    allows: (feature: FeatureKey) => hasFeature(entitlements, feature),
    readOnly: entitlements?.enforced === true && entitlements.access !== 'full',
  };
}

export { PLAN_ERROR_CODES, isPlanErrorCode, type PlanErrorCode } from './plan-codes';
