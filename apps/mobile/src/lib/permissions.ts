/* Role rules, kept in step with apps/web/src/lib/permissions.ts. */

const LEADERSHIP = [
  'super_admin',
  'national_admin',
  'national_pastor',
  'district_admin',
  'district_pastor',
  'branch_admin',
  'resident_pastor',
  'associate_pastor',
];
const BRANCH_SCOPED = ['branch_admin', 'resident_pastor', 'associate_pastor', 'follow_up', 'usher'];

const has = (roles: string[], role?: string) => !!role && roles.includes(role);

export const can = {
  followUp: (role?: string) => has([...LEADERSHIP, 'follow_up'], role),
  attendance: (role?: string) => has([...LEADERSHIP, 'follow_up', 'usher'], role),
  approvals: (role?: string) => has([...LEADERSHIP, 'follow_up'], role),
  approveExpenses: (role?: string) => has(LEADERSHIP, role),
  /** Branch-scoped people work in their own branch; everyone else picks one. */
  pickBranch: (role?: string) => !!role && !BRANCH_SCOPED.includes(role),
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Overall oversight admin',
  national_admin: 'National admin',
  national_pastor: 'National pastor',
  district_admin: 'District admin',
  district_pastor: 'District pastor',
  branch_admin: 'Branch admin',
  resident_pastor: 'Resident pastor',
  associate_pastor: 'Associate pastor',
  follow_up: 'Follow-up',
  usher: 'Usher',
};

export function roleLabel(role?: string) {
  return (role && ROLE_LABELS[role]) || role?.replace(/_/g, ' ') || '';
}
