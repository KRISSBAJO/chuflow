export interface AuthUser {
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
    | 'usher';
  oversightRegion?: string;
  district?: string;
  branchId?: string;
}
