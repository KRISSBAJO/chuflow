/* API response shapes the phone app reads. They mirror apps/web/src/lib/types.ts. */

export type SessionUser = {
  workspace?: { id: string; name: string };
  id?: string;
  _id?: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  oversightRegion?: string;
  district?: string;
  branchId?: string | { _id?: string; name?: string } | null;
  preferences?: { defaultReportDays?: number };
};

export type AlertsSummary = {
  scope: { role: string; branchCount: number };
  quickStats: { firstTimers: number; pendingFollowUp: number; pendingApprovals: number; activeAlerts: number };
  counts: {
    overdueFollowUp: number;
    pendingAttendanceApprovals: number;
    pendingExpenseApprovals: number;
    pendingWorkspaceRequests: number;
  };
  items: {
    key: string;
    label: string;
    count: number;
    tone: 'warm' | 'cool' | 'critical';
    description: string;
    href: string;
  }[];
};

export type BranchRef = { _id?: string; name?: string };

export type GuestListItem = {
  _id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  visitStatus: string;
  branchId?: BranchRef;
  createdAt?: string;
  nextFollowUpStatus?: string;
};

export type GuestDetail = GuestListItem & {
  prayerRequest?: string;
  invitedBy?: string;
  heardAboutChurch?: string;
  address?: string;
  city?: string;
  state?: string;
  wantsPastoralCall?: boolean;
  salvationResponse?: string;
  convertedToMember?: boolean;
};

export type Paginated<T> = {
  items: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export type GuestListResponse = Paginated<GuestListItem> & {
  summary: { todayCount: number; completionRate: number; assignedFollowUpCount: number };
};

export type FollowUpItem = {
  _id: string;
  guestId?: GuestListItem;
  assignedTo?: { _id: string; firstName: string; lastName: string };
  status: string;
  contactMethod: string;
  note: string;
  nextActionDate?: string;
  updatedAt?: string;
};

export type FollowUpListResponse = Paginated<FollowUpItem> & {
  summary: { total: number; new: number; assigned: number; contacted: number };
};

export type DashboardOverview = {
  scope: { kind: string; label: string; days: number; branchName?: string };
  metrics: { totalGuests: number; totalMembers: number; totalAttendance: number; pendingFollowUp: number };
  operational: null | {
    recentGuests: GuestListItem[];
  };
};

export type BranchSummary = {
  _id: string;
  name: string;
  district: string;
  oversightRegion: string;
  city?: string;
  state?: string;
};

export type ServiceType = {
  _id: string;
  name: string;
  key: string;
  isActive: boolean;
  branchId?: BranchRef | string;
};

export type AttendanceItem = {
  _id: string;
  branchId?: BranchRef | string;
  serviceDate: string;
  serviceTypeLabel?: string;
  serviceTypeId?: { name?: string };
  serviceName?: string;
  menCount?: number;
  womenCount?: number;
  childrenCount?: number;
  adultsCount?: number;
  firstTimersCount?: number;
  newConvertsCount?: number;
  createdAt?: string;
};

export type AttendanceSubmission = {
  _id: string;
  templateName: string;
  status: string;
  branchId?: BranchRef;
  serviceDate?: string;
  serviceType?: string;
  serviceName?: string;
  menCount?: number;
  womenCount?: number;
  childrenCount?: number;
  firstTimersCount?: number;
  newConvertsCount?: number;
  createdAt?: string;
};

export type ExpenseEntry = {
  _id: string;
  branchId?: BranchRef;
  expenseDate: string;
  expenseCategoryLabel: string;
  payee?: string;
  description: string;
  amount: number;
  currency: string;
  status: string;
};
