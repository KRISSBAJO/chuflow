import type { EntitlementSnapshot, FeatureKey } from "./ops/types";

export type { EntitlementSnapshot, FeatureKey };

/*
 * What the church's plan allows, as `/auth/me` reports it. Nothing here applies when
 * `entitlements` is missing or not enforced: deployments without a control plane look exactly
 * as before.
 */

/** Route prefixes that belong to a plan feature. Longest prefix wins. */
const ROUTE_FEATURES: [string, FeatureKey][] = [
  ["/guests", "guests"],
  ["/evangelism", "guests"],
  ["/members", "members"],
  ["/service-units", "members"],
  ["/attendance", "attendance"],
  ["/weekly-reports", "attendance"],
  ["/record", "attendance"],
  ["/follow-up", "follow_up"],
  ["/care", "care"],
  ["/meetings", "meetings"],
  ["/children", "kids"],
  ["/children-kiosk", "kids"],
  ["/finance", "finance"],
  ["/communications", "communications"],
  ["/templates", "communications"],
  ["/reports", "reporting"],
  ["/maag-reports", "reporting"],
];

export function featureForRoute(pathname: string): FeatureKey | null {
  const match = ROUTE_FEATURES.filter(([route]) => pathname === route || pathname.startsWith(route + "/")).sort(
    (a, b) => b[0].length - a[0].length,
  )[0];
  return match ? match[1] : null;
}

export function hasFeature(entitlements: EntitlementSnapshot | null | undefined, feature: FeatureKey) {
  if (!entitlements?.enforced) return true;
  return entitlements.features.includes(feature);
}

/** True when the plan (not the role) keeps this route out. */
export function planLocksRoute(entitlements: EntitlementSnapshot | null | undefined, pathname: string) {
  const feature = featureForRoute(pathname);
  return feature ? !hasFeature(entitlements, feature) : false;
}

export type PlanState =
  | { kind: "trial"; days: number; until?: string }
  | { kind: "past_due"; until?: string }
  | { kind: "read_only"; reason?: EntitlementSnapshot["reason"] }
  | { kind: "locked"; reason?: EntitlementSnapshot["reason"] };

function daysLeft(value?: string) {
  if (!value) return 0;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000));
}

/** The one thing worth telling the church right now, or null when all is well. */
export function planState(entitlements: EntitlementSnapshot | null | undefined): PlanState | null {
  if (!entitlements?.enforced) return null;
  if (entitlements.access === "locked") return { kind: "locked", reason: entitlements.reason };
  if (entitlements.access === "read_only") return { kind: "read_only", reason: entitlements.reason };
  if (entitlements.status === "past_due") return { kind: "past_due", until: entitlements.graceEndsAt };
  if (entitlements.status === "trialing") return { kind: "trial", days: daysLeft(entitlements.trialEndsAt), until: entitlements.trialEndsAt };
  return null;
}

export const PLAN_ERROR_CODES = ["feature_locked", "quota_exceeded", "workspace_read_only", "workspace_locked", "workspace_suspended"] as const;
export type PlanErrorCode = (typeof PLAN_ERROR_CODES)[number];

export function isPlanErrorCode(value: unknown): value is PlanErrorCode {
  return typeof value === "string" && (PLAN_ERROR_CODES as readonly string[]).includes(value);
}
