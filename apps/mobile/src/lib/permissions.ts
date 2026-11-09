/* Role rules, kept in step with apps/web/src/lib/permissions.ts. */

export type AppRole =
  | 'super_admin'
  | 'national_admin'
  | 'national_pastor'
  | 'district_admin'
  | 'district_pastor'
  | 'branch_admin'
  | 'resident_pastor'
  | 'associate_pastor'
  | 'follow_up'
  | 'usher'
  | 'children_worker'
  | 'children_supervisor'
  | 'youth_leader'
  | 'youth_pastor';

const GLOBAL = ['super_admin'];
const NATIONAL = ['national_admin', 'national_pastor'];
const DISTRICT = ['district_admin', 'district_pastor'];
const BRANCH_LEADERSHIP = ['branch_admin', 'resident_pastor', 'associate_pastor'];
const CHILDREN = ['children_worker', 'children_supervisor'];
const YOUTH = ['youth_leader', 'youth_pastor'];
const SUPPORT = ['follow_up', 'usher'];
const LEADERSHIP = [...GLOBAL, ...NATIONAL, ...DISTRICT, ...BRANCH_LEADERSHIP];
const BRANCH_SCOPED = [...BRANCH_LEADERSHIP, ...SUPPORT, ...CHILDREN, ...YOUTH];
const FINANCE = [...LEADERSHIP, 'usher'];

const has = (roles: string[], role?: string) => !!role && roles.includes(role);

export const can = {
  /** Leaders at any level: pastors and admins. */
  lead: (role?: string) => has(LEADERSHIP, role),
  /** Children's ministry staff whose whole app is the Kids workspace. */
  kidsOnly: (role?: string) => has(CHILDREN, role),
  youthOnly: (role?: string) => has(YOUTH, role),
  youth: (role?: string) => has([...LEADERSHIP, ...SUPPORT, ...YOUTH], role),
  guests: (role?: string) => has([...LEADERSHIP, ...SUPPORT], role),
  followUp: (role?: string) => has([...LEADERSHIP, 'follow_up'], role),
  careCases: (role?: string) => has([...LEADERSHIP, 'follow_up'], role),
  prayerCare: (role?: string) => has([...GLOBAL, ...BRANCH_LEADERSHIP, 'follow_up'], role),
  attendance: (role?: string) => has([...LEADERSHIP, 'follow_up', 'usher'], role),
  recordAttendance: (role?: string) => has([...BRANCH_LEADERSHIP, 'usher'], role),
  approvals: (role?: string) => has([...LEADERSHIP, 'follow_up'], role),
  approveExpenses: (role?: string) => has(LEADERSHIP, role),
  members: (role?: string) => has(LEADERSHIP, role),
  convertGuests: (role?: string) => has(LEADERSHIP, role),
  kids: (role?: string) => has([...LEADERSHIP, ...CHILDREN], role),
  kidsSupervise: (role?: string) => has([...LEADERSHIP, 'children_supervisor'], role),
  meetings: (role?: string) => has([...LEADERSHIP, ...SUPPORT], role),
  manageMeetingGroups: (role?: string) => has(LEADERSHIP, role),
  finance: (role?: string) => has(FINANCE, role),
  recordOfferings: (role?: string) => has(['resident_pastor', 'associate_pastor', 'usher'], role),
  recordExpenses: (role?: string) => has(BRANCH_LEADERSHIP, role),
  reports: (role?: string) => has(LEADERSHIP, role),
  search: (role?: string) => has([...LEADERSHIP, ...SUPPORT], role),
  dashboard: (role?: string) => has([...LEADERSHIP, ...SUPPORT], role),
  /** Branch-scoped people work in their own branch; everyone else picks one. */
  pickBranch: (role?: string) => !!role && !BRANCH_SCOPED.includes(role),
  /** Sees the network-level dashboard blocks (branch health, growth). */
  executive: (role?: string) => has([...GLOBAL, ...NATIONAL, ...DISTRICT], role),
};

/** English fallback used only where no translator is available; screens use `useAppFormat().role`. */
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
  children_worker: "Children's worker",
  children_supervisor: "Children's supervisor",
  youth_leader: 'Youth Leader',
  youth_pastor: 'Youth Pastor',
};

export function roleLabel(role?: string) {
  return (role && ROLE_LABELS[role]) || role?.replace(/_/g, ' ') || '';
}

export function canManageLocalServiceTypes(role?: string) {
  return role === 'branch_admin' || role === 'resident_pastor';
}
