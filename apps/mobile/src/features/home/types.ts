import type { BranchRef, GuestListItem } from '@/lib/types';

/* Dashboard shapes, mirroring DashboardOverview in apps/web/src/lib/types.ts. */

export type DashboardScope = {
  kind: 'all_network' | 'national' | 'district' | 'branch' | string;
  label: string;
  role: string;
  oversightRegion?: string;
  district?: string;
  branchId?: string;
  branchName?: string;
  showOperationalDetails?: boolean;
  days: number;
  startDate?: string;
  endDate?: string;
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

export type MemberListItem = {
  _id: string;
  title?: string;
  firstName: string;
  lastName: string;
  membershipStatus: string;
  branchId?: BranchRef;
  createdAt?: string;
};

export type AttendanceMixRow = {
  _id: string;
  totalPeople: number;
  firstTimers: number;
  newConverts: number;
  summarySubmissions: number;
};

export type PipelineStage = { status: string; total: number };

export type DashboardOverview = {
  scope: DashboardScope;
  metrics: { totalGuests: number; totalMembers: number; totalAttendance: number; pendingFollowUp: number };
  executive?: {
    branchesWithoutRecentAttendance: DashboardBranchAlert[];
    highFollowUpBacklog: DashboardBranchAlert[];
    topGrowthBranches: DashboardGrowthBranch[];
    bottomGrowthBranches: DashboardGrowthBranch[];
  };
  operational: null | {
    recentGuests: GuestListItem[];
    newestMembers: MemberListItem[];
    attendanceMix: AttendanceMixRow[];
    followUpPipeline: PipelineStage[];
  };
};

/** Follow-up stages in workflow order, as on the website. */
export const STAGE_ORDER = ['new', 'assigned', 'contacted', 'prayed_with', 'invited_back', 'returned', 'converted'];
