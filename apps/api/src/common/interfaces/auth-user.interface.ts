export interface AuthUser {
  additionalPermissions?: string[];
  additionalPermissionExpiries?: Record<string, string | null>;
  sub: string;
  email: string;
  role:
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
    | 'children_supervisor';
  oversightRegion?: string;
  district?: string;
  branchId?: string;
}
