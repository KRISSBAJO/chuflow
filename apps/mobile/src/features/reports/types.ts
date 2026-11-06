/* Report shapes, mirroring ReportsSummary and WeeklyReportListResponse in apps/web/src/lib/types.ts. */

export type ReportsSummary = {
  range: { days: number; startDate: string; endDate: string };
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
  trends: { date: string; guests: number; attendance: number; firstTimers: number; newConverts: number }[];
  followUpBreakdown: { _id: string; total: number }[];
  serviceMix: { _id: string; totalPeople: number; firstTimers: number; newConverts: number; summarySubmissions: number; individualCheckins?: number }[];
};

/** One branch (or district) line of the weekly-report comparison. */
export type ReportGroupTotal = {
  key: string;
  label: string;
  reports: number;
  currentAttendance: number;
  previousAttendance: number;
  growth: number;
  growthPercent: number;
  firstTimersCount: number;
  newConvertsCount: number;
  oversightRegion?: string;
  district?: string;
};

export type WeeklyReportListResponse = {
  scope: { branchCount: number };
  branchTotals: ReportGroupTotal[];
  districtTotals: ReportGroupTotal[];
};
