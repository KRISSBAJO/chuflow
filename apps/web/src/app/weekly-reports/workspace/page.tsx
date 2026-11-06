import { Shell } from "@/components/shell";
import { WeeklyReportWorkspace } from "@/components/weekly-report-workspace";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { BranchSummary } from "@/lib/types";
export default async function Page({
  params,
}: {
  params: Promise<{ id?: string }>;
}) {
  const user = await requireServerRole("/weekly-reports");
  const branches = await serverGet<BranchSummary[]>("/branches/options");
  const { id } = await params;
  return (
    <Shell>
      <WeeklyReportWorkspace
        branches={branches}
        defaultBranchId={user.branchId}
        userId={user.id || user._id || ""}
        reportId={id}
      />
    </Shell>
  );
}
