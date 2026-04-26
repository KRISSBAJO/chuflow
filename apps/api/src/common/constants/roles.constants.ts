export const APP_ROLES = [
  'super_admin',
  'national_admin',
  'national_pastor',
  'district_admin',
  'district_pastor',
  'branch_admin',
  'resident_pastor',
  'associate_pastor',
  'follow_up',
  'usher',
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const GLOBAL_ROLES: AppRole[] = ['super_admin'];
export const NATIONAL_ROLES: AppRole[] = ['national_admin', 'national_pastor'];
export const DISTRICT_ROLES: AppRole[] = ['district_admin', 'district_pastor'];
export const BRANCH_LEADERSHIP_ROLES: AppRole[] = [
  'branch_admin',
  'resident_pastor',
  'associate_pastor',
];
export const BRANCH_SUPPORT_ROLES: AppRole[] = ['follow_up', 'usher'];
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
export const ALL_SCOPE_AWARE_ADMIN_ROLES: AppRole[] = [
  ...GLOBAL_ROLES,
  ...NATIONAL_ROLES,
  ...DISTRICT_ROLES,
  ...BRANCH_LEADERSHIP_ROLES,
];

export function isGlobalRole(role?: string): role is AppRole {
  return !!role && GLOBAL_ROLES.includes(role as AppRole);
}

export function isNationalRole(role?: string): role is AppRole {
  return !!role && NATIONAL_ROLES.includes(role as AppRole);
}

export function isDistrictRole(role?: string): role is AppRole {
  return !!role && DISTRICT_ROLES.includes(role as AppRole);
}

export function isBranchLeadershipRole(role?: string): role is AppRole {
  return !!role && BRANCH_LEADERSHIP_ROLES.includes(role as AppRole);
}

export function isBranchSupportRole(role?: string): role is AppRole {
  return !!role && BRANCH_SUPPORT_ROLES.includes(role as AppRole);
}

export function isBranchScopedRole(role?: string): role is AppRole {
  return !!role && BRANCH_SCOPED_ROLES.includes(role as AppRole);
}
