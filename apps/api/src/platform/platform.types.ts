import type { ObjectId } from 'mongodb';

/*
 * The control plane: records that describe organizations (workspaces), the operators who run the
 * platform, the plans on offer and each workspace's subscription. They live in the control
 * database, never inside a church's own database.
 */

export const FEATURE_KEYS = [
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
  'api',
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const QUOTA_KEYS = ['branches', 'users', 'members', 'children'] as const;
export type QuotaKey = (typeof QUOTA_KEYS)[number];

/** `null` means unlimited. */
export type Quotas = Record<QuotaKey, number | null>;

export const WORKSPACE_STATUSES = [
  'provisioning',
  'active',
  'suspended',
  'archived',
] as const;
export type WorkspaceStatus = (typeof WORKSPACE_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'suspended',
  'cancelled',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const BILLING_MODES = ['manual', 'stripe'] as const;
export type BillingMode = (typeof BILLING_MODES)[number];

export const OPERATOR_ROLES = [
  'owner',
  'support',
  'billing',
  'read_only',
] as const;
export type OperatorRole = (typeof OPERATOR_ROLES)[number];

export type WorkspaceRecord = {
  /** The workspace handle, also the URL segment and the API's WORKSPACE_ID. */
  _id: string;
  name: string;
  status: WorkspaceStatus;
  databaseName: string;
  /** Encrypted with the control encryption key; only the gateway and provisioning decrypt it. */
  jwtSecret: string;
  adminEmail: string;
  /** Encrypted; the worker seeds the first admin from it on its first start. */
  adminPassword: string;
  ownerEmail?: string;
  region?: string;
  notes?: string;
  createdAt: Date;
  createdBy?: string;
  updatedAt: Date;
  suspendedAt?: Date;
  suspensionReason?: string;
  archivedAt?: Date;
};

export type OperatorRecord = {
  sessionVersion?: number;
  _id?: ObjectId;
  email: string;
  passwordHash: string;
  role: OperatorRole;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
};

export type PlanRecord = {
  _id: string;
  name: string;
  description?: string;
  features: FeatureKey[];
  quotas: Quotas;
  priceMonthlyCents: number;
  currency: string;
  trialDays: number;
  /** Plans operators can no longer assign; existing subscriptions keep them. */
  retired?: boolean;
  updatedAt: Date;
};

export type ManualPayment = {
  at: Date;
  amountCents: number;
  currency: string;
  reference: string;
  periodEnd: Date;
  note?: string;
  recordedBy: string;
};

export type SubscriptionRecord = {
  /** The workspace handle. */
  _id: string;
  planId: string;
  status: SubscriptionStatus;
  billingMode: BillingMode;
  trialEndsAt?: Date;
  currentPeriodEnd?: Date;
  /** Days after the trial or period end before the workspace turns read-only. */
  graceDays: number;
  overrides?: { features?: FeatureKey[]; quotas?: Partial<Quotas> };
  payments: ManualPayment[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PlatformAuditRecord = {
  at: Date;
  operatorId: string;
  operatorEmail: string;
  action: string;
  workspaceId?: string;
  reason?: string;
  details?: Record<string, unknown>;
};

export type Access = 'full' | 'read_only' | 'locked';

/** What a workspace is currently entitled to; the same shape reaches the web and phone apps. */
export type EntitlementSnapshot = {
  workspaceId: string;
  /** False when no control plane is configured or no subscription exists: nothing is enforced. */
  enforced: boolean;
  planId: string;
  planName: string;
  status: SubscriptionStatus | 'delinquent' | 'legacy';
  access: Access;
  features: FeatureKey[];
  quotas: Quotas;
  billingMode?: BillingMode;
  trialEndsAt?: string;
  currentPeriodEnd?: string;
  graceEndsAt?: string;
  /** A short machine-readable reason when access is limited. */
  reason?: 'trial_ended' | 'payment_overdue' | 'suspended' | 'cancelled';
};

export const UNLIMITED_QUOTAS: Quotas = {
  branches: null,
  users: null,
  members: null,
  children: null,
};

export const RESERVED_HANDLES = [
  'admin',
  'api',
  'app',
  'login',
  'www',
  'support',
  'platform',
  'control',
  'billing',
  'status',
  'docs',
  'mail',
];

export const HANDLE_PATTERN = /^(?=.{3,64}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;
