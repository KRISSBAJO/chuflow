export type PermissionPerson = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  permissionRevision?: number;
};
export type PermissionDetail = {
  user: PermissionPerson;
  additionalPermissions: string[];
  basePermissions: string[];
  catalog: {
    key: string;
    group: string;
    label: string;
    requires: readonly string[];
  }[];
  assignable: string[];
  maximumExpiries: Record<string, string | null>;
  canEdit: boolean;
  revision: number;
};
export type GrantRow = {
  _id: string;
  recipientId: string;
  recipient: PermissionPerson;
  permission: string;
  status: "active" | "expired" | "revoked" | "needs_review";
  expiresAt: string | null;
  grantedByName: string;
  grantedAt: string;
  reason: string;
  revokedAt?: string;
  revocationReason?: string;
  revokedByName?: string;
  canManage: boolean;
};
export type GrantList = {
  items: GrantRow[];
  total: number;
  page: number;
  totalPages: number;
};
