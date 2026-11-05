export const approvalLevels = [
  "church",
  "area",
  "zone",
  "district",
  "national",
] as const;
export type ApprovalLevel = (typeof approvalLevels)[number];
export type ApprovalPolicy = {
  _id: string;
  oversightRegion: string;
  name: string;
  category: string;
  finalLevel: ApprovalLevel;
  thresholdAmount?: number;
  aboveThresholdLevel?: ApprovalLevel;
  currency: string;
  reviewDays: number;
  isActive: boolean;
  revision: number;
};
export type ApprovalOptions = {
  canManage: boolean;
  regions: string[];
  branches: { _id: string; name: string; oversightRegion: string }[];
  policies: ApprovalPolicy[];
};
export type ApprovalStage = {
  level: ApprovalLevel;
  label: string;
  reviewerIds: string[];
  reviewerNames: string[];
};
export type ApprovalRequest = {
  _id: string;
  branchId: string;
  branchName: string;
  requesterId: string;
  requesterName: string;
  policyId: string;
  policyName: string;
  title: string;
  details: string;
  category: string;
  amount?: number;
  currency?: string;
  status: string;
  finalLevel: ApprovalLevel;
  stages: ApprovalStage[];
  currentStage: number;
  currentReviewerIds: string[];
  dueAt: string;
  revision: number;
  createdAt: string;
  documentLinks: string[];
  history: {
    action: string;
    actorName: string;
    level?: string;
    note: string;
    at: string;
    submission?: {
      title: string;
      details: string;
      amount?: number;
      currency?: string;
      documentLinks: string[];
    };
  }[];
  canReview?: boolean;
  canManage?: boolean;
};
export type ApprovalList = {
  items: ApprovalRequest[];
  pagination: { page: number; total: number; totalPages: number };
};
