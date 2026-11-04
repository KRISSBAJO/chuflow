"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import type { AttendanceSubmissionItem } from "@/lib/types";
import { Badge, Button, EmptyState, statusTone } from "@/components/ui/ui";

function formatStatus(status: string) {
  switch (status) {
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return "Pending";
  }
}

function formatKind(kind: string) {
  if (kind === "maag_report") {
    return "MAAG report";
  }

  return kind === "weekly_report" ? "Weekly report" : "Attendance";
}

async function mutateSubmission(id: string, action: "approve" | "reject") {
  const response = await fetch(
    `${API_URL}/intake-templates/attendance-submissions/${id}/${action}`,
    {
      method: "PATCH",
      credentials: "include",
    },
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || `Unable to ${action} submission`);
  }

  return result;
}

export function AttendanceSubmissionQueue({
  items,
  canApprove,
}: {
  items: AttendanceSubmissionItem[];
  canApprove: boolean;
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleAction(id: string, action: "approve" | "reject") {
    setLoadingId(id);

    try {
      await mutateSubmission(id, action);
      toast.success(
        action === "approve"
          ? "Submission approved"
          : "Submission rejected",
      );
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Unable to ${action} attendance submission`,
      );
    } finally {
      setLoadingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState icon="attendance" title="Nothing waiting">
        No attendance submissions are waiting in the current scope.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const totalPeople =
          (item.adultsCount ?? 0) + (item.childrenCount ?? 0);
        const isWeeklyReport = item.templateKind === "weekly_report";
        const isMaagReport = item.templateKind === "maag_report";
        const busy = pending || loadingId === item._id || item.status !== "pending";

        return (
          <article
            key={item._id}
            className="rounded-2xl border border-black/[0.06] p-5 transition-colors hover:border-black/[0.12]"
          >
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="lp-heading text-[18px]">
                    {item.serviceName || item.serviceType || item.templateName}
                  </h3>
                  <Badge tone={statusTone(item.status)} dot>
                    {formatStatus(item.status)}
                  </Badge>
                  <Badge tone="flame">{formatKind(item.templateKind)}</Badge>
                  {item.branchId?.name ? <Badge>{item.branchId.name}</Badge> : null}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-[#6b6b6b]">
                  <span>
                    {item.serviceDate
                      ? new Date(item.serviceDate).toLocaleString()
                      : "No date"}
                  </span>
                  {isMaagReport ? (
                    <span>MAAG monthly report</span>
                  ) : isWeeklyReport ? (
                    <span>
                      <span className="font-medium tabular-nums text-[#111111]">{item.currentAttendance ?? 0}</span> current attendance
                    </span>
                  ) : (
                    <span>
                      <span className="font-medium tabular-nums text-[#111111]">{totalPeople}</span> total people
                    </span>
                  )}
                  <span>
                    <span className="font-medium tabular-nums text-[#111111]">{item.firstTimersCount ?? 0}</span> first timers
                  </span>
                  <span>
                    <span className="font-medium tabular-nums text-[#111111]">{item.newConvertsCount ?? 0}</span> new converts
                  </span>
                  {item.duplicateSummaryCount > 0 ? (
                    <Badge tone="danger">
                      {item.duplicateSummaryCount} possible duplicate
                      {item.duplicateSummaryCount === 1 ? "" : "s"}
                    </Badge>
                  ) : null}
                </div>

                <dl className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
                  {(isMaagReport
                    ? [
                        ["Report", "Monthly"],
                        ["Status", formatStatus(item.status)],
                        ["Branch", item.branchId?.name || "Branch"],
                        ["Review", item.approvedAt ? "Reviewed" : "Pending"],
                        ["Created", item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""],
                        ["Type", "MAAG"],
                      ]
                    : isWeeklyReport
                    ? [
                        ["Previous", item.previousAttendance ?? 0],
                        ["Growth", item.growth ?? 0],
                        ["Growth %", item.growthPercent !== undefined ? `${item.growthPercent}%` : "0%"],
                        ["BFC", item.believersFoundationClassCount ?? 0],
                        ["Cells", item.cellCount ?? 0],
                        ["WOFBI", item.wofbiAttendance ?? 0],
                      ]
                    : [
                        ["Men", item.menCount ?? 0],
                        ["Women", item.womenCount ?? 0],
                        ["Children", item.childrenCount ?? 0],
                        ["Adults", item.adultsCount ?? 0],
                        ["First timers", item.firstTimersCount ?? 0],
                        ["Holy Spirit", item.holySpiritBaptismCount ?? 0],
                      ]).map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-[#f6f5f1] px-3 py-2.5">
                      <dt className="text-[12px] text-[#6b6b6b]">{label}</dt>
                      <dd className="mt-0.5 truncate text-[15px] font-semibold tabular-nums text-[#111111]">{value}</dd>
                    </div>
                  ))}
                </dl>
                {isWeeklyReport && item.remarks ? (
                  <div className="max-w-3xl rounded-xl border border-black/[0.06] px-4 py-3 text-[14px] text-[#55534e]">
                    <p className="text-[12px] text-[#8a8780]">Remarks</p>
                    <p className="mt-1 leading-[1.6]">{item.remarks}</p>
                  </div>
                ) : null}
              </div>

              {canApprove ? (
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-700 hover:bg-red-50 hover:text-red-800"
                    onClick={() => handleAction(item._id, "reject")}
                    disabled={busy}
                  >
                    {loadingId === item._id ? "Working..." : "Reject"}
                  </Button>
                  <Button size="sm" onClick={() => handleAction(item._id, "approve")} disabled={busy}>
                    {loadingId === item._id ? "Working..." : "Approve"}
                  </Button>
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
