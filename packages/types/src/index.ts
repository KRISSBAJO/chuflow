export enum AppRole {
  SUPER_ADMIN = 'super_admin',
  BRANCH_ADMIN = 'branch_admin',
  FOLLOW_UP = 'follow_up',
  USHER = 'usher',
}

export enum FollowUpStatus {
  NEW = 'new',
  ASSIGNED = 'assigned',
  CONTACTED = 'contacted',
  PRAYED_WITH = 'prayed_with',
  INVITED_BACK = 'invited_back',
  RETURNED = 'returned',
  CONVERTED = 'converted',
}

export enum VisitStatus {
  FIRST_TIME = 'first_time',
  RETURNING = 'returning',
  MEMBER = 'member',
}

export enum AttendanceType {
  SUNDAY = 'sunday_service',
  MIDWEEK = 'midweek_service',
  SPECIAL = 'special_service',
}
