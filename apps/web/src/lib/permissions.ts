import type { SessionUser } from "./auth";

export type AppRole =
  | "super_admin"
  | "national_admin"
  | "national_pastor"
  | "district_admin"
  | "district_pastor"
  | "branch_admin"
  | "resident_pastor"
  | "associate_pastor"
  | "follow_up"
  | "usher";

export const GLOBAL_ROLES: AppRole[] = ["super_admin"];
export const NATIONAL_ROLES: AppRole[] = ["national_admin", "national_pastor"];
export const DISTRICT_ROLES: AppRole[] = ["district_admin", "district_pastor"];
export const BRANCH_LEADERSHIP_ROLES: AppRole[] = [
  "branch_admin",
  "resident_pastor",
  "associate_pastor",
];
export const BRANCH_SUPPORT_ROLES: AppRole[] = ["follow_up", "usher"];
export const BRANCH_SCOPED_ROLES: AppRole[] = [
  ...BRANCH_LEADERSHIP_ROLES,
  ...BRANCH_SUPPORT_ROLES,
];
export const LEADERSHIP_ROLES: AppRole[] = [
  ...GLOBAL_ROLES,
  ...NATIONAL_ROLES,
  ...DISTRICT_ROLES,
  ...BRANCH_LEADERSHIP_ROLES,
];
export const APP_SETTINGS_ROLES: AppRole[] = [
  "super_admin",
  "national_admin",
  "district_admin",
  "branch_admin",
];

function includesRole(roles: AppRole[], role?: string): role is AppRole {
  return !!role && roles.includes(role as AppRole);
}

export function isGlobalRole(role?: string): role is AppRole {
  return includesRole(GLOBAL_ROLES, role);
}

export function isNationalRole(role?: string): role is AppRole {
  return includesRole(NATIONAL_ROLES, role);
}

export function isDistrictRole(role?: string): role is AppRole {
  return includesRole(DISTRICT_ROLES, role);
}

export function isBranchLeadershipRole(role?: string): role is AppRole {
  return includesRole(BRANCH_LEADERSHIP_ROLES, role);
}

export function isBranchScopedRole(role?: string): role is AppRole {
  return includesRole(BRANCH_SCOPED_ROLES, role);
}

export function canFilterAcrossBranches(role?: string) {
  return !!role && !isBranchScopedRole(role);
}

export function canManageBranchStructure(role?: string) {
  return includesRole(["super_admin", "district_admin"], role);
}

export function canConfigureAppSettings(role?: string) {
  return includesRole(APP_SETTINGS_ROLES, role);
}

export function canManageCommunicationTemplates(role?: string) {
  return includesRole(['super_admin'], role);
}

export function canAccessFinance(role?: string) {
  return includesRole(
    [
      "super_admin",
      "national_admin",
      "national_pastor",
      "district_admin",
      "district_pastor",
      "branch_admin",
      "resident_pastor",
      "associate_pastor",
      "usher",
    ],
    role,
  );
}

export function canCreateFinanceEntries(role?: string) {
  return includesRole(["resident_pastor", "associate_pastor", "usher"], role);
}

export function canManageFinanceSettings(role?: string) {
  return includesRole(["super_admin"], role);
}

export function canCreateExpenseEntries(role?: string) {
  return includesRole(
    [
      "super_admin",
      "national_admin",
      "national_pastor",
      "district_admin",
      "district_pastor",
      "branch_admin",
      "resident_pastor",
      "associate_pastor",
    ],
    role,
  );
}

export function canApproveExpenseEntries(role?: string) {
  return includesRole(
    [
      "super_admin",
      "national_admin",
      "national_pastor",
      "district_admin",
      "district_pastor",
      "branch_admin",
      "resident_pastor",
      "associate_pastor",
    ],
    role,
  );
}

export function canManageFinanceLocks(role?: string) {
  return includesRole(
    [
      "super_admin",
      "national_admin",
      "national_pastor",
      "district_admin",
      "district_pastor",
      "branch_admin",
    ],
    role,
  );
}

export function canManageServiceSchedules(role?: string) {
  return includesRole(
    [
      "super_admin",
      "national_admin",
      "district_admin",
      "branch_admin",
      "resident_pastor",
      "associate_pastor",
    ],
    role,
  );
}

export function canConvertGuests(role?: string) {
  return includesRole(LEADERSHIP_ROLES, role);
}

export function formatRoleLabel(role?: string) {
  const labels: Record<AppRole, string> = {
    super_admin: "Overall oversight admin",
    national_admin: "National admin",
    national_pastor: "National pastor",
    district_admin: "District admin",
    district_pastor: "District pastor",
    branch_admin: "Branch admin",
    resident_pastor: "Resident pastor",
    associate_pastor: "Associate pastor",
    follow_up: "Follow-up",
    usher: "Usher",
  };

  return role && role in labels
    ? labels[role as AppRole]
    : role?.replace(/_/g, " ") || "Unknown role";
}

export function getManageableUserRoleOptions(role?: string): AppRole[] {
  if (isGlobalRole(role)) {
    return [
      "super_admin",
      "national_admin",
      "national_pastor",
      "district_admin",
      "district_pastor",
      "branch_admin",
      "resident_pastor",
      "associate_pastor",
      "follow_up",
      "usher",
    ];
  }

  if (role === "national_admin") {
    return [
      "national_admin",
      "national_pastor",
      "district_admin",
      "district_pastor",
      "branch_admin",
      "resident_pastor",
      "associate_pastor",
      "follow_up",
      "usher",
    ];
  }

  if (role === "district_admin") {
    return [
      "district_admin",
      "district_pastor",
      "branch_admin",
      "resident_pastor",
      "associate_pastor",
      "follow_up",
      "usher",
    ];
  }

  if (role === "branch_admin") {
    return ["branch_admin", "resident_pastor", "associate_pastor", "follow_up", "usher"];
  }

  return [];
}

export function getVisibleUserRoleOptions(role?: string): AppRole[] {
  if (isGlobalRole(role)) {
    return [
      "super_admin",
      "national_admin",
      "national_pastor",
      "district_admin",
      "district_pastor",
      "branch_admin",
      "resident_pastor",
      "associate_pastor",
      "follow_up",
      "usher",
    ];
  }

  if (isNationalRole(role)) {
    return [
      "national_admin",
      "national_pastor",
      "district_admin",
      "district_pastor",
      "branch_admin",
      "resident_pastor",
      "associate_pastor",
      "follow_up",
      "usher",
    ];
  }

  if (isDistrictRole(role)) {
    return [
      "district_admin",
      "district_pastor",
      "branch_admin",
      "resident_pastor",
      "associate_pastor",
      "follow_up",
      "usher",
    ];
  }

  if (isBranchLeadershipRole(role)) {
    return ["branch_admin", "resident_pastor", "associate_pastor", "follow_up", "usher"];
  }

  return role ? [role as AppRole] : [];
}

export function getUserScopeLabel(user: Pick<SessionUser, "role" | "oversightRegion" | "district"> | null) {
  if (!user?.role) {
    return "";
  }

  if (isGlobalRole(user.role)) {
    return "Overall oversight";
  }

  if (isNationalRole(user.role)) {
    return user.oversightRegion || "National scope";
  }

  if (isDistrictRole(user.role)) {
    if (user.district && user.oversightRegion) {
      return `${user.district} · ${user.oversightRegion}`;
    }

    return user.district || "District scope";
  }

  return "Branch scope";
}

export const routePermissions: Record<string, AppRole[]> = {
  "/dashboard": [...LEADERSHIP_ROLES, ...BRANCH_SUPPORT_ROLES],
  "/approvals": [...LEADERSHIP_ROLES, "follow_up"],
  "/communications": [...LEADERSHIP_ROLES, "follow_up"],
  "/guests": [...LEADERSHIP_ROLES, ...BRANCH_SUPPORT_ROLES],
  "/follow-up": [...LEADERSHIP_ROLES, "follow_up"],
  "/members": [...LEADERSHIP_ROLES],
  "/service-units": [...LEADERSHIP_ROLES],
  "/attendance": [...LEADERSHIP_ROLES, "follow_up", "usher"],
  "/finance": [
    "super_admin",
    "national_admin",
    "national_pastor",
    "district_admin",
    "district_pastor",
    "branch_admin",
    "resident_pastor",
    "associate_pastor",
    "usher",
  ],
  "/branches": [...LEADERSHIP_ROLES],
  "/structure": [...LEADERSHIP_ROLES],
  "/users": [...LEADERSHIP_ROLES],
  "/templates": [...LEADERSHIP_ROLES],
  "/reports": [...LEADERSHIP_ROLES],
  "/search": [...LEADERSHIP_ROLES, ...BRANCH_SUPPORT_ROLES],
  "/settings": [...LEADERSHIP_ROLES, ...BRANCH_SUPPORT_ROLES],
};

export function canAccessRoute(role: string | undefined, pathname: string) {
  const matchedEntry = Object.entries(routePermissions).find(([route]) =>
    pathname === route || pathname.startsWith(`${route}/`),
  );

  if (!matchedEntry) {
    return true;
  }

  return !!role && matchedEntry[1].includes(role as AppRole);
}

export function filterNavByRole<T extends { href: string }>(links: T[], user: SessionUser | null) {
  return links.filter((link) => canAccessRoute(user?.role, link.href));
}
