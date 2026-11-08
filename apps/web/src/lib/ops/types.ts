/*
 * Shapes returned by the control-plane API (`/platform/*` in apps/api). They mirror
 * `apps/api/src/platform/platform.types.ts`; dates arrive as ISO strings.
 */

export const FEATURE_KEYS = [
  "guests",
  "members",
  "attendance",
  "follow_up",
  "care",
  "meetings",
  "kids",
  "finance",
  "communications",
  "reporting",
  "exports",
  "api",
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  guests: "Guests",
  members: "Members",
  attendance: "Attendance",
  follow_up: "Follow-up",
  care: "Care",
  meetings: "Meetings",
  kids: "Kids ministry",
  finance: "Finance",
  communications: "Communications",
  reporting: "Reporting",
  exports: "Exports",
  api: "API access",
};

export const QUOTA_KEYS = ["branches", "users", "members", "children"] as const;
export type QuotaKey = (typeof QUOTA_KEYS)[number];
export const QUOTA_LABELS: Record<QuotaKey, string> = {
  branches: "Branches",
  users: "Staff accounts",
  members: "Members",
  children: "Children",
};

/** `null` means unlimited. */
export type Quotas = Record<QuotaKey, number | null>;

export const WORKSPACE_STATUSES = ["provisioning", "active", "suspended", "archived"] as const;
export type WorkspaceStatus = (typeof WORKSPACE_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due", "suspended", "cancelled"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export type BillingMode = "manual" | "stripe";

export const OPERATOR_ROLES = ["owner", "support", "billing", "read_only"] as const;
export type OperatorRole = (typeof OPERATOR_ROLES)[number];
export const OPERATOR_ROLE_LABELS: Record<OperatorRole, string> = {
  owner: "Owner",
  support: "Support",
  billing: "Billing",
  read_only: "Read only",
};

export type Operator = {
  kind: "operator";
  sub: string;
  email: string;
  role: OperatorRole;
};

export type OperatorView = {
  id: string;
  email: string;
  role: OperatorRole;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
};

export type WorkspaceView = {
  id: string;
  name: string;
  status: WorkspaceStatus;
  primary: boolean;
  databaseName?: string;
  adminEmail?: string;
  ownerEmail?: string;
  region?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  suspendedAt?: string;
  suspensionReason?: string;
  archivedAt?: string;
};

export type Plan = {
  _id: string;
  name: string;
  description?: string;
  features: FeatureKey[];
  quotas: Quotas;
  priceMonthlyCents: number;
  currency: string;
  trialDays: number;
  retired?: boolean;
  updatedAt: string;
};

export type ManualPayment = {
  at: string;
  amountCents: number;
  currency: string;
  reference: string;
  periodEnd: string;
  note?: string;
  recordedBy: string;
};

export type Subscription = {
  _id: string;
  planId: string;
  status: SubscriptionStatus;
  billingMode: BillingMode;
  trialEndsAt?: string;
  currentPeriodEnd?: string;
  graceDays: number;
  overrides?: { features?: FeatureKey[]; quotas?: Partial<Quotas> };
  payments: ManualPayment[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type Access = "full" | "read_only" | "locked";

export type EntitlementSnapshot = {
  workspaceId: string;
  enforced: boolean;
  planId: string;
  planName: string;
  status: SubscriptionStatus | "delinquent" | "legacy";
  access: Access;
  features: FeatureKey[];
  quotas: Quotas;
  billingMode?: BillingMode;
  trialEndsAt?: string;
  currentPeriodEnd?: string;
  graceEndsAt?: string;
  reason?: "trial_ended" | "payment_overdue" | "suspended" | "cancelled";
};

export type WorkspaceDetail = {
  workspace: WorkspaceView;
  subscription: Subscription | null;
  entitlements: EntitlementSnapshot;
};

export type WorkspaceUsage = {
  counts: Record<QuotaKey | "guests", number>;
  quotas: Quotas;
  plan: string;
  access: Access;
};

export type Overview = {
  workspaces: { total: number; byStatus: Record<string, number> };
  billing: { subscriptions: number; byStatus: Record<string, number>; monthlyRecurringCents: number };
};

export type AuditEntry = {
  id: string;
  at: string;
  operatorId: string;
  operatorEmail: string;
  action: string;
  workspaceId?: string;
  reason?: string;
  details?: Record<string, unknown>;
};

/* ---- role capabilities, mirrored from the API's @OperatorRoles() guards ---- */

export const can = {
  provision: (role: OperatorRole) => role === "owner" || role === "support",
  editWorkspace: (role: OperatorRole) => role === "owner" || role === "support",
  suspend: (role: OperatorRole) => role !== "read_only",
  archive: (role: OperatorRole) => role === "owner",
  billing: (role: OperatorRole) => role === "owner" || role === "billing",
  manageOperators: (role: OperatorRole) => role === "owner",
};

export function formatMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 2 }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function formatDate(value?: string | null, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
  }).format(date);
}

export function daysUntil(value?: string | null) {
  if (!value) return null;
  const diff = new Date(value).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

/** Turns an ISO timestamp into the value a `<input type="date">` expects. */
export function dateInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}
