/** Additive capabilities. Church scope, record rules and role administration remain separate. */

export const PERMISSION_CATALOG = [
  {
    key: 'members.view',
    group: 'members',
    label: 'View member records',
    roles: [
      'super_admin',
      'national_admin',
      'national_pastor',
      'district_admin',
      'district_pastor',
      'branch_admin',
      'resident_pastor',
      'associate_pastor',
    ],
    requires: [],
  },
  {
    key: 'members.create',
    group: 'members',
    label: 'Create member records',
    roles: [
      'super_admin',
      'national_admin',
      'national_pastor',
      'district_admin',
      'district_pastor',
      'branch_admin',
      'resident_pastor',
      'associate_pastor',
    ],
    requires: ['members.view'],
  },
  {
    key: 'members.edit',
    group: 'members',
    label: 'Edit member records',
    roles: [
      'super_admin',
      'national_admin',
      'national_pastor',
      'district_admin',
      'district_pastor',
      'branch_admin',
      'resident_pastor',
      'associate_pastor',
    ],
    requires: ['members.view'],
  },
  {
    key: 'guests.view',
    group: 'guests',
    label: 'View guest records',
    roles: [
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
    ],
    requires: [],
  },
  {
    key: 'guests.create',
    group: 'guests',
    label: 'Create guest records',
    roles: [
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
    ],
    requires: ['guests.view'],
  },
  {
    key: 'guests.edit',
    group: 'guests',
    label: 'Edit guest records',
    roles: [
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
    ],
    requires: ['guests.view'],
  },
  {
    key: 'attendance.view',
    group: 'attendance',
    label: 'View attendance',
    roles: [
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
    ],
    requires: [],
  },
  {
    key: 'attendance.create',
    group: 'attendance',
    label: 'Create attendance',
    roles: ['branch_admin', 'resident_pastor', 'associate_pastor', 'usher'],
    requires: ['attendance.view'],
  },
  {
    key: 'attendance.edit',
    group: 'attendance',
    label: 'Edit attendance',
    roles: [
      'super_admin',
      'national_admin',
      'national_pastor',
      'district_admin',
      'district_pastor',
      'branch_admin',
      'resident_pastor',
      'associate_pastor',
      'usher',
    ],
    requires: ['attendance.view'],
  },
  {
    key: 'service_units.view',
    group: 'service_units',
    label: 'View service groups',
    roles: [
      'super_admin',
      'national_admin',
      'national_pastor',
      'district_admin',
      'district_pastor',
      'branch_admin',
      'resident_pastor',
      'associate_pastor',
    ],
    requires: [],
  },
  {
    key: 'service_units.create',
    group: 'service_units',
    label: 'Create service groups',
    roles: [
      'super_admin',
      'national_admin',
      'national_pastor',
      'district_admin',
      'district_pastor',
      'branch_admin',
      'resident_pastor',
      'associate_pastor',
    ],
    requires: ['service_units.view', 'members.view'],
  },
  {
    key: 'service_units.edit',
    group: 'service_units',
    label: 'Edit service groups',
    roles: [
      'super_admin',
      'national_admin',
      'national_pastor',
      'district_admin',
      'district_pastor',
      'branch_admin',
      'resident_pastor',
      'associate_pastor',
    ],
    requires: ['service_units.view'],
  },
  {
    key: 'finance.view',
    group: 'finance',
    label: 'View finance records',
    roles: [
      'super_admin',
      'national_admin',
      'national_pastor',
      'district_admin',
      'district_pastor',
      'branch_admin',
      'resident_pastor',
      'associate_pastor',
      'usher',
    ],
    requires: [],
  },
  {
    key: 'finance.offerings',
    group: 'finance',
    label: 'Record offerings',
    roles: ['usher', 'resident_pastor', 'associate_pastor'],
    requires: ['finance.view'],
  },
  {
    key: 'finance.expenses',
    group: 'finance',
    label: 'Record expenses',
    roles: [
      'super_admin',
      'national_admin',
      'national_pastor',
      'district_admin',
      'district_pastor',
      'branch_admin',
      'resident_pastor',
      'associate_pastor',
    ],
    requires: ['finance.view'],
  },
  {
    key: 'finance.approve',
    group: 'finance',
    label: 'Approve expenses',
    roles: [
      'super_admin',
      'national_admin',
      'national_pastor',
      'district_admin',
      'district_pastor',
      'branch_admin',
      'resident_pastor',
      'associate_pastor',
    ],
    requires: ['finance.view'],
  },
  {
    key: 'finance.locks',
    group: 'finance',
    label: 'Manage finance period locks',
    roles: [
      'super_admin',
      'national_admin',
      'national_pastor',
      'district_admin',
      'district_pastor',
      'branch_admin',
    ],
    requires: ['finance.view'],
  },
  {
    key: 'reports.view',
    group: 'reports',
    label: 'View and export church reports',
    roles: [
      'super_admin',
      'national_admin',
      'national_pastor',
      'district_admin',
      'district_pastor',
      'branch_admin',
      'resident_pastor',
      'associate_pastor',
    ],
    requires: [],
  },
  {
    key: 'communications.view',
    group: 'communications',
    label: 'View communication history',
    roles: [
      'super_admin',
      'national_admin',
      'national_pastor',
      'district_admin',
      'district_pastor',
      'branch_admin',
      'resident_pastor',
      'associate_pastor',
      'follow_up',
    ],
    requires: [],
  },
  {
    key: 'communications.send',
    group: 'communications',
    label: 'Send church communications',
    roles: [
      'super_admin',
      'national_admin',
      'national_pastor',
      'district_admin',
      'district_pastor',
      'branch_admin',
      'resident_pastor',
      'associate_pastor',
      'follow_up',
    ],
    requires: ['communications.view'],
  },
  {
    key: 'follow_up.view',
    group: 'follow_up',
    label: 'View follow-up records',
    roles: [
      'super_admin',
      'national_admin',
      'national_pastor',
      'district_admin',
      'district_pastor',
      'branch_admin',
      'resident_pastor',
      'associate_pastor',
      'follow_up',
    ],
    requires: ['guests.view'],
  },
  {
    key: 'follow_up.create',
    group: 'follow_up',
    label: 'Create follow-up records',
    roles: [
      'super_admin',
      'national_admin',
      'national_pastor',
      'district_admin',
      'district_pastor',
      'branch_admin',
      'resident_pastor',
      'associate_pastor',
      'follow_up',
    ],
    requires: ['follow_up.view', 'guests.view'],
  },
  {
    key: 'follow_up.edit',
    group: 'follow_up',
    label: 'Update follow-up records',
    roles: [
      'super_admin',
      'national_admin',
      'national_pastor',
      'district_admin',
      'district_pastor',
      'branch_admin',
      'resident_pastor',
      'associate_pastor',
      'follow_up',
    ],
    requires: ['follow_up.view'],
  },
] as const;

export type PermissionKey = (typeof PERMISSION_CATALOG)[number]['key'];

export type PermissionSubject = {
  role?: string;
  additionalPermissions?: readonly string[];
  additionalPermissionExpiries?: Record<string, string | null>;
};

const known = new Set<string>(PERMISSION_CATALOG.map((p) => p.key));

export function isPermissionKey(key: string): key is PermissionKey {
  return known.has(key);
}

export function additionalPermissionKeys(
  user: PermissionSubject | null | undefined,
): PermissionKey[] {
  const keys = new Set<PermissionKey>();

  function include(key: string) {
    if (!isPermissionKey(key) || keys.has(key)) return;
    keys.add(key);
    const permission = PERMISSION_CATALOG.find((p) => p.key === key)!;
    for (const requirement of permission.requires) include(requirement);
  }

  for (const key of user?.additionalPermissions || []) {
    const expiry = user?.additionalPermissionExpiries?.[key];
    if (
      expiry &&
      (!Number.isFinite(Date.parse(expiry)) || Date.parse(expiry) <= Date.now())
    )
      continue;
    include(key);
  }

  return [...keys];
}

export function rolePermissionKeys(role?: string): PermissionKey[] {
  return PERMISSION_CATALOG.filter((p) =>
    (p.roles as readonly string[]).includes(role || ''),
  ).map((p) => p.key);
}

export function effectivePermissionKeys(
  user: PermissionSubject,
): PermissionKey[] {
  return [
    ...new Set([
      ...rolePermissionKeys(user.role),
      ...additionalPermissionKeys(user),
    ]),
  ];
}

export function hasAdditionalPermission(
  user: PermissionSubject | null | undefined,
  key: string,
) {
  return additionalPermissionKeys(user).some((p) => p === key);
}

export function hasPermission(user: PermissionSubject, key: string) {
  return effectivePermissionKeys(user).some((p) => p === key);
}

export function canDelegatePermissions(role?: string) {
  return [
    'super_admin',
    'national_admin',
    'national_pastor',
    'district_admin',
    'district_pastor',
    'branch_admin',
    'resident_pastor',
  ].includes(role || '');
}

export function delegatablePermissions(user: PermissionSubject) {
  return canDelegatePermissions(user.role)
    ? user.role === 'super_admin'
      ? PERMISSION_CATALOG.map((p) => p.key)
      : effectivePermissionKeys(user)
    : [];
}
