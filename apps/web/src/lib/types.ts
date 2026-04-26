export type DashboardStats = {
  firstTimersToday: number;
  totalGuestsThisWeek: number;
  pendingFollowUp: number;
  returnedGuests: number;
  convertedMembers: number;
  todaysAttendance: number;
};

export type DashboardScope = {
  kind: "all_network" | "national" | "district" | "branch";
  label: string;
  role: string;
  oversightRegion?: string;
  district?: string;
  branchId?: string;
  branchName?: string;
  showOperationalDetails: boolean;
  days: number;
  startDate: string;
  endDate: string;
};

export type DashboardBranchAlert = {
  _id: string;
  name: string;
  oversightRegion: string;
  district: string;
  city?: string;
  state?: string;
  status?: string;
  lastSubmittedAt?: string | null;
  pendingFollowUp?: number;
};

export type DashboardGrowthBranch = {
  _id: string;
  name: string;
  oversightRegion: string;
  district: string;
  guestsCaptured: number;
  membersAdded: number;
  newConverts: number;
  growthScore: number;
};

export type DashboardOverview = {
  scope: DashboardScope;
  metrics: {
    totalGuests: number;
    totalMembers: number;
    totalAttendance: number;
    pendingFollowUp: number;
  };
  executive: {
    branchesWithoutRecentAttendance: DashboardBranchAlert[];
    highFollowUpBacklog: DashboardBranchAlert[];
    topGrowthBranches: DashboardGrowthBranch[];
    bottomGrowthBranches: DashboardGrowthBranch[];
  };
  operational: null | {
    recentGuests: GuestListItem[];
    newestMembers: MemberListItem[];
    attendanceMix: Array<{
      _id: string;
      totalPeople: number;
      firstTimers: number;
      newConverts: number;
      summarySubmissions: number;
    }>;
    followUpPipeline: Array<{
      status: string;
      total: number;
    }>;
  };
};

export type AlertsSummary = {
  scope: {
    role: string;
    oversightRegion?: string;
    district?: string;
    branchId?: string;
    branchCount: number;
  };
  quickStats: {
    firstTimers: number;
    pendingFollowUp: number;
    pendingApprovals: number;
    activeAlerts: number;
  };
  counts: {
    overdueFollowUp: number;
    pendingAttendanceApprovals: number;
    pendingExpenseApprovals: number;
    pendingWorkspaceRequests: number;
    branchesWithoutRecentAttendance: number;
    branchesMissingLeadership: number;
  };
  items: Array<{
    key: string;
    label: string;
    count: number;
    tone: "warm" | "cool" | "critical";
    description: string;
    href: string;
  }>;
};

export type Guest = {
  _id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  visitStatus: string;
  prayerRequest?: string;
};

export type Member = {
  _id: string;
  title?: string;
  firstName: string;
  lastName: string;
  membershipStatus: string;
  email?: string;
};

export type ServiceUnitSummary = {
  _id: string;
  name: string;
  meetingDay: string;
  prayerDay: string;
  isActive: boolean;
  notes?: string;
  memberCount?: number;
  branchId?: {
    _id?: string;
    name?: string;
  } | string;
  leaderMemberId?: {
    _id?: string;
    firstName?: string;
    lastName?: string;
  };
  secretaryMemberId?: {
    _id?: string;
    firstName?: string;
    lastName?: string;
  };
};

export type ServiceTypeSummary = {
  _id: string;
  name: string;
  key: string;
  isActive: boolean;
  notes?: string;
  branchId?: {
    _id?: string;
    name?: string;
  } | string;
};

export type ServiceScheduleSummary = {
  _id: string;
  branchId?: {
    _id?: string;
    name?: string;
    oversightRegion?: string;
    district?: string;
  } | string;
  serviceTypeId?: {
    _id?: string;
    name?: string;
    key?: string;
  } | string;
  serviceTypeKey: string;
  serviceTypeLabel: string;
  name: string;
  dayOfWeek: string;
  startTime: string;
  endTime?: string;
  timezone: string;
  locationNotes?: string;
  attendanceEntryEnabled: boolean;
  financeEntryEnabled: boolean;
  isActive: boolean;
};

export type ServiceInstanceSummary = {
  _id: string;
  branchId?: {
    _id?: string;
    name?: string;
    oversightRegion?: string;
    district?: string;
  } | string;
  serviceScheduleId?: {
    _id?: string;
    name?: string;
    dayOfWeek?: string;
    startTime?: string;
    timezone?: string;
  } | string;
  serviceTypeId?: {
    _id?: string;
    name?: string;
    key?: string;
  } | string;
  serviceScheduleName?: string;
  serviceTypeKey: string;
  serviceTypeLabel: string;
  serviceDate: string;
  serviceDateKey: string;
  startTime?: string;
  timezone: string;
  status: string;
  attendanceSummaryCount: number;
  financeEntryCount: number;
  lastActivityAt?: string;
};

export type OfferingTypeSummary = {
  _id: string;
  name: string;
  key: string;
  description?: string;
  isActive: boolean;
  isSeeded: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export type OfferingEntrySummary = {
  _id: string;
  branchId?: {
    _id?: string;
    name?: string;
    oversightRegion?: string;
    district?: string;
  };
  oversightRegion: string;
  district: string;
  serviceDate: string;
  serviceScheduleId?: {
    _id?: string;
    name?: string;
    dayOfWeek?: string;
    startTime?: string;
  };
  serviceInstanceId?: {
    _id?: string;
    serviceDateKey?: string;
  };
  serviceLabel?: string;
  serviceTypeId?: {
    _id?: string;
    name?: string;
    key?: string;
  };
  serviceTypeKey: string;
  serviceTypeLabel: string;
  offeringTypeId?: {
    _id?: string;
    name?: string;
    key?: string;
    isActive?: boolean;
  };
  offeringTypeKey: string;
  offeringTypeLabel: string;
  accountId?: {
    _id?: string;
    name?: string;
    key?: string;
  };
  amount: number;
  currency: string;
  notes?: string;
  createdBy?: UserSummary;
  updatedBy?: UserSummary;
  createdAt?: string;
  updatedAt?: string;
  permissions: {
    canEdit: boolean;
    reason: string;
  };
};

export type FinanceAccountSummary = {
  _id: string;
  name: string;
  key: string;
  description?: string;
  isActive: boolean;
  isSeeded: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export type ExpenseCategorySummary = {
  _id: string;
  name: string;
  key: string;
  description?: string;
  defaultAccountKey?: string;
  isActive: boolean;
  isSeeded: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export type ExpenseEntrySummary = {
  _id: string;
  branchId?: {
    _id?: string;
    name?: string;
    oversightRegion?: string;
    district?: string;
  };
  oversightRegion: string;
  district: string;
  expenseDate: string;
  accountId?: {
    _id?: string;
    name?: string;
    key?: string;
  };
  accountKey: string;
  accountLabel: string;
  expenseCategoryId?: {
    _id?: string;
    name?: string;
    key?: string;
  };
  expenseCategoryKey: string;
  expenseCategoryLabel: string;
  serviceScheduleId?: {
    _id?: string;
    name?: string;
  };
  serviceInstanceId?: {
    _id?: string;
    serviceDateKey?: string;
  };
  serviceLabel?: string;
  payee?: string;
  description: string;
  amount: number;
  currency: string;
  receiptUrl?: string;
  notes?: string;
  status: string;
  reviewedAt?: string;
  reviewNotes?: string;
  permissions: {
    canEdit: boolean;
    reason: string;
  };
};

export type ExpenseListResponse = {
  items: ExpenseEntrySummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: {
    totalAmount: number;
    pendingAmount: number;
    pendingCount: number;
    visibleBranchCount: number;
  };
};

export type FinanceLedgerEntrySummary = {
  _id: string;
  branchId?: {
    _id?: string;
    name?: string;
    oversightRegion?: string;
    district?: string;
  };
  oversightRegion: string;
  district: string;
  entryDate: string;
  periodKey: string;
  accountId?: {
    _id?: string;
    name?: string;
    key?: string;
  };
  accountKey: string;
  accountLabel: string;
  direction: string;
  sourceType: string;
  sourceId: string;
  serviceLabel?: string;
  amount: number;
  currency: string;
  description: string;
  status: string;
  reviewedAt?: string;
  createdAt?: string;
};

export type FinanceLedgerResponse = {
  items: FinanceLedgerEntrySummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: {
    totalCredits: number;
    totalDebits: number;
    netBalance: number;
    pendingExpenseApprovals: number;
    lockedPeriods: number;
  };
  byAccount: Array<{
    accountId: string;
    label: string;
    totalCredits: number;
    totalDebits: number;
    balance: number;
  }>;
  byBranch: Array<{
    branchId: string;
    name: string;
    oversightRegion?: string;
    district?: string;
    totalCredits: number;
    totalDebits: number;
    balance: number;
  }>;
};

export type FinanceLockSummary = {
  _id: string;
  branchId?: {
    _id?: string;
    name?: string;
    oversightRegion?: string;
    district?: string;
  } | string;
  periodKey: string;
  reason?: string;
  lockedAt?: string;
  lockedBy?: UserSummary;
};

export type OfferingListResponse = {
  items: OfferingEntrySummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: {
    totalAmount: number;
    currentMonthTotal: number;
    totalEntries: number;
    visibleBranchCount: number;
  };
  byType: Array<{
    offeringTypeId: string;
    label: string;
    totalAmount: number;
    entryCount: number;
  }>;
  byBranch: Array<{
    branchId: string;
    name: string;
    oversightRegion?: string;
    district?: string;
    totalAmount: number;
    entryCount: number;
  }>;
};

export type BranchSummary = {
  _id: string;
  name: string;
  oversightRegion: string;
  district: string;
  address: string;
  city: string;
  state: string;
  country: string;
  contactInfo: string;
  serviceTimes: string;
  status: string;
};

export type BranchOverview = BranchSummary & {
  metrics: {
    guestCount: number;
    memberCount: number;
    teamCount: number;
    activeUserCount: number;
    branchAdminCount: number;
    residentPastorCount: number;
    associatePastorCount: number;
    followUpCount: number;
    usherCount: number;
  };
  admins: UserSummary[];
  residentPastors: UserSummary[];
  associatePastors: UserSummary[];
  followUpTeam: UserSummary[];
  ushers: UserSummary[];
};

export type DistrictStructureSummary = {
  name: string;
  branchCount: number;
  guestCount: number;
  memberCount: number;
  districtAdmins: UserSummary[];
  districtPastors: UserSummary[];
  branches: BranchOverview[];
};

export type OversightRegionStructureSummary = {
  name: string;
  districtCount: number;
  branchCount: number;
  guestCount: number;
  memberCount: number;
  nationalAdmins: UserSummary[];
  nationalPastors: UserSummary[];
  districts: DistrictStructureSummary[];
};

export type OrgStructureSummary = {
  scope: {
    role: string;
    oversightRegion?: string;
    district?: string;
    branchId?: string;
  };
  summary: {
    overallHeadCount: number;
    oversightRegionCount: number;
    districtCount: number;
    branchCount: number;
    guestCount: number;
    memberCount: number;
    nationalLeaderCount: number;
    districtLeaderCount: number;
    branchLeaderCount: number;
    supportStaffCount: number;
  };
  overallHeads: UserSummary[];
  oversightRegions: OversightRegionStructureSummary[];
};

export type GuestListItem = {
  _id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  visitStatus: string;
  branchId?: {
    _id?: string;
    name?: string;
  };
  createdAt?: string;
  nextFollowUpStatus?: string;
};

export type GuestListResponse = {
  items: GuestListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: {
    todayCount: number;
    completionRate: number;
    assignedFollowUpCount: number;
  };
};

export type IntakeTemplateField = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  width?: string;
  options?: string[];
};

export type IntakeTemplate = {
  _id: string;
  kind: "guest" | "member" | "attendance";
  name: string;
  slug: string;
  branchId?: string;
  baseTemplateId?: string;
  isBranchOverride?: boolean;
  isActive: boolean;
  isSeeded?: boolean;
  badge?: string;
  title: string;
  subtitle?: string;
  introTitle?: string;
  introBody?: string;
  closingText?: string;
  submitLabel?: string;
  successTitle?: string;
  successMessage?: string;
  logoPath?: string;
  shareUrl?: string;
  theme?: {
    accentColor?: string;
    darkColor?: string;
    softColor?: string;
  };
  fields: IntakeTemplateField[];
};

export type AttendanceSubmissionItem = {
  _id: string;
  templateName: string;
  templateKind: string;
  status: string;
  branchId?: {
    _id?: string;
    name?: string;
    oversightRegion?: string;
    district?: string;
  };
  serviceDate?: string;
  serviceType?: string;
  serviceName?: string;
  menCount?: number;
  womenCount?: number;
  childrenCount?: number;
  adultsCount?: number;
  firstTimersCount?: number;
  newConvertsCount?: number;
  holySpiritBaptismCount?: number;
  attendanceId?: string;
  duplicateSummaryCount: number;
  approvedAt?: string;
  rejectedAt?: string;
  createdAt?: string;
  approvedBy?: UserSummary;
  rejectedBy?: UserSummary;
};

export type AttendanceSubmissionListResponse = {
  items: AttendanceSubmissionItem[];
  summary: {
    pending: number;
    approved: number;
    rejected: number;
  };
};

export type PublicConnectOption = IntakeTemplate & {
  branch?: BranchSummary;
};

export type GuestDuplicateGroup = {
  key: string;
  type: string;
  value: string;
  guests: GuestListItem[];
};

export type FollowUpItem = {
  _id: string;
  guestId?: GuestListItem;
  assignedTo?: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  status: string;
  contactMethod: string;
  note: string;
  nextActionDate?: string;
  updatedAt?: string;
};

export type FollowUpListResponse = {
  items: FollowUpItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: {
    total: number;
    new: number;
    assigned: number;
    contacted: number;
    prayedWith: number;
    invitedBack: number;
    returned: number;
    converted: number;
  };
};

export type MemberListItem = {
  _id: string;
  title?: string;
  firstName: string;
  lastName: string;
  membershipStatus: string;
  dateJoinedChurch?: string;
  believerFoundationClassStatus?: string;
  believerFoundationClassDate?: string;
  believerFoundationClassLocation?: string;
  bccStatus?: string;
  bccDate?: string;
  bccLocation?: string;
  lccStatus?: string;
  lccDate?: string;
  lccLocation?: string;
  lcdStatus?: string;
  lcdDate?: string;
  lcdLocation?: string;
  holySpiritBaptismStatus?: string;
  waterBaptismStatus?: string;
  serviceUnitInterest?: string;
  serviceUnitId?: {
    _id?: string;
    name?: string;
  };
  phone?: string;
  email?: string;
  familyDetails?: string;
  branchId?: {
    _id?: string;
    name?: string;
  };
  createdAt?: string;
};

export type OversightRegionOption = {
  _id: string;
  name: string;
  isActive: boolean;
  branchCount: number;
  districtCount: number;
};

export type DistrictOption = {
  _id: string;
  name: string;
  oversightRegion: string;
  isActive: boolean;
  branchCount: number;
};

export type AttendanceItem = {
  _id: string;
  entryMode?: string;
  branchId?:
    | {
        _id?: string;
        name?: string;
      }
    | string;
  serviceDate: string;
  serviceType: string;
  serviceTypeLabel?: string;
  serviceScheduleId?: {
    _id?: string;
    name?: string;
    dayOfWeek?: string;
    startTime?: string;
  };
  serviceInstanceId?: {
    _id?: string;
    serviceDateKey?: string;
  };
  serviceTypeId?: {
    _id?: string;
    name?: string;
    key?: string;
  };
  serviceName?: string;
  personType: string;
  guestId?: GuestListItem;
  memberId?: MemberListItem;
  menCount?: number;
  womenCount?: number;
  childrenCount?: number;
  adultsCount?: number;
  firstTimersCount?: number;
  newConvertsCount?: number;
  holySpiritBaptismCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type AttendanceSummary = {
  _id: string;
  total: number;
  guests: number;
  members: number;
};

export type UserSummary = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  oversightRegion?: string;
  district?: string;
  branchId?: string;
  isActive?: boolean;
  lastLoginAt?: string;
  createdAt?: string;
};

export type UserDirectoryResponse = {
  items: UserSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: {
    total: number;
    active: number;
    inactive: number;
    followUp: number;
    ushers: number;
  };
};

export type WorkspaceRequestItem = {
  _id: string;
  organizationName: string;
  contactName: string;
  email: string;
  phone?: string;
  country?: string;
  state?: string;
  city?: string;
  branchCount?: number;
  notes?: string;
  status: string;
  notificationStatus?: string;
  adminNotifiedAt?: string;
  reviewedAt?: string;
  decisionNotes?: string;
  createdAt?: string;
  reviewedBy?: UserSummary;
};

export type WorkspaceRequestListResponse = {
  items: WorkspaceRequestItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: {
    total: number;
    newCount: number;
    inReviewCount: number;
    approvedCount: number;
    rejectedCount: number;
    provisionedCount: number;
  };
};

export type AuditLogItem = {
  _id: string;
  entityType: string;
  entityId: string;
  action: string;
  summary: string;
  oversightRegion?: string;
  district?: string;
  branchId?: {
    _id?: string;
    name?: string;
    oversightRegion?: string;
    district?: string;
  };
  actor?: {
    _id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
  };
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

export type AuditLogListResponse = {
  items: AuditLogItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type VisitItem = {
  _id: string;
  branchId?: string;
  guestId?: GuestListItem;
  visitDate: string;
  serviceType: string;
  notes?: string;
};

export type CommunicationItem = {
  _id: string;
  templateName: string;
  subject?: string;
  channel: string;
  recipient: string;
  message: string;
  status: string;
  deliveryMode?: string;
  previewUrl?: string;
  deliveredAt?: string;
  failedAt?: string;
  errorMessage?: string;
  externalMessageId?: string;
  createdAt?: string;
  branchId?: {
    _id?: string;
    name?: string;
    oversightRegion?: string;
    district?: string;
  };
  sentBy?: Pick<UserSummary, "_id" | "firstName" | "lastName" | "email">;
  senderRole?: string;
  guestId?: GuestListItem;
  memberId?: MemberListItem;
};

export type CommunicationTemplateItem = {
  _id: string;
  key: string;
  name: string;
  channel: string;
  subject?: string;
  message: string;
  isActive: boolean;
  isSeeded: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export type CommunicationHistoryResponse = {
  items: CommunicationItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: {
    total: number;
    email: number;
    sms: number;
    phoneCall: number;
    sent: number;
    preview: number;
    queued: number;
    failed: number;
    systemEmail: number;
    previewEmail: number;
    manualSms: number;
    manualCall: number;
  };
};

export type ReportsSummary = {
  range: {
    days: number;
    startDate: string;
    endDate: string;
  };
  totals: {
    guestTotal: number;
    memberTotal: number;
    attendanceTotal: number;
    firstTimersTotal: number;
    newConvertsTotal: number;
    summarySubmissionTotal: number;
    adultsTotal: number;
    childrenTotal: number;
    conversionRate: number;
    returnRate: number;
  };
  trends: Array<{
    date: string;
    guests: number;
    attendance: number;
    firstTimers: number;
    newConverts: number;
  }>;
  followUpBreakdown: Array<{
    _id: string;
    total: number;
  }>;
  serviceMix: Array<{
    _id: string;
    totalPeople: number;
    firstTimers: number;
    newConverts: number;
    summarySubmissions: number;
    individualCheckins: number;
  }>;
};

export type SettingsOverview = {
  app: {
    organizationName: string;
    organizationTagline: string;
    publicConnectEnabled: boolean;
    defaultReportDays: number;
  };
  preferences: {
    interfaceDensity: "comfortable" | "compact";
    defaultReportDays: number;
  };
};

export type BranchSettingsOverview = {
  branch: BranchSummary;
  settings: {
    _id: string;
    branchId: string;
    timezone: string;
    currency: string;
    locale: string;
    defaultServiceDurationMinutes: number;
    attendanceApprovalRoles: string[];
    publicGuestIntakeEnabled: boolean;
    publicMemberIntakeEnabled: boolean;
    publicAttendanceEntryEnabled: boolean;
    notifyOnMissingAttendance: boolean;
    notifyOnFollowUpBacklog: boolean;
    notifyOnFinanceApprovals: boolean;
    dailySummaryEnabled: boolean;
    weeklyLeadershipDigestEnabled: boolean;
  };
  canEdit: boolean;
};

export type GlobalSearchResultItem = {
  _id: string;
  entityType: "guests" | "members" | "branches" | "users" | "followups";
  title: string;
  subtitle: string;
  meta?: string;
  href: string;
};

export type GlobalSearchResponse = {
  query: string;
  type: "all" | "guests" | "members" | "branches" | "users" | "followups";
  scope: {
    role: string;
    oversightRegion?: string;
    district?: string;
    branchId?: string;
  };
  totals: {
    total: number;
    guests: number;
    members: number;
    branches: number;
    users: number;
    followUps: number;
  };
  results: {
    guests: GlobalSearchResultItem[];
    members: GlobalSearchResultItem[];
    branches: GlobalSearchResultItem[];
    users: GlobalSearchResultItem[];
    followUps: GlobalSearchResultItem[];
  };
};
