"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { useAppFormat, useStatusLabel } from "@/i18n/labels";
import type { AttendanceSubmissionItem } from "@/lib/types";
import { Badge, Button, EmptyState, statusTone } from "@/components/ui/ui";

async function mutateSubmission(
  id: string,
  action: "approve" | "reject",
  fallback: string,
) {
  const response = await fetch(
    `${API_URL}/intake-templates/attendance-submissions/${id}/${action}`,
    {
      method: "PATCH",
      credentials: "include",
    },
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || fallback);
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
  const t = useTranslations("services.attendance.queue");
  const statusLabel = useStatusLabel();
  const { date, dateTime } = useAppFormat();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const formatStatus = (status: string) =>
    statusLabel(
      status === "approved" || status === "rejected" ? status : "pending",
    );

  function formatKind(kind: string) {
    if (kind === "maag_report") {
      return t("kinds.maag");
    }

    return kind === "weekly_report" ? t("kinds.weekly") : t("kinds.attendance");
  }

  async function handleAction(id: string, action: "approve" | "reject") {
    setLoadingId(id);

    try {
      await mutateSubmission(
        id,
        action,
        action === "approve" ? t("approveFailed") : t("rejectFailed"),
      );
      toast.success(
        action === "approve" ? t("toastApproved") : t("toastRejected"),
      );
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : action === "approve"
            ? t("approveAttendanceFailed")
            : t("rejectAttendanceFailed"),
      );
    } finally {
      setLoadingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState icon="attendance" title={t("emptyTitle")}>
        {t("emptyBody")}
      </EmptyState>
    );
  }

  const strong = (chunks: ReactNode) => (
    <span className="font-medium tabular-nums text-[#111111]">{chunks}</span>
  );

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const totalPeople = (item.adultsCount ?? 0) + (item.childrenCount ?? 0);
        const isWeeklyReport = item.templateKind === "weekly_report";
        const isMaagReport = item.templateKind === "maag_report";
        const busy =
          pending || loadingId === item._id || item.status !== "pending";
        const fields: [string, string | number][] = isMaagReport
          ? [
              [t("fields.report"), t("fields.monthly")],
              [t("fields.status"), formatStatus(item.status)],
              [t("fields.branch"), item.branchId?.name || t("fields.branch")],
              [
                t("fields.review"),
                item.approvedAt ? t("fields.reviewed") : t("fields.pending"),
              ],
              [t("fields.created"), item.createdAt ? date(item.createdAt) : ""],
              [t("fields.type"), "MAAG"],
            ]
          : isWeeklyReport
            ? [
                [t("fields.previous"), item.previousAttendance ?? 0],
                [t("fields.growth"), item.growth ?? 0],
                [
                  t("fields.growthPercent"),
                  item.growthPercent !== undefined
                    ? `${item.growthPercent}%`
                    : "0%",
                ],
                [t("fields.bfc"), item.believersFoundationClassCount ?? 0],
                [t("fields.cells"), item.cellCount ?? 0],
                [t("fields.wofbi"), item.wofbiAttendance ?? 0],
              ]
            : [
                [t("fields.men"), item.menCount ?? 0],
                [t("fields.women"), item.womenCount ?? 0],
                [t("fields.children"), item.childrenCount ?? 0],
                [t("fields.adults"), item.adultsCount ?? 0],
                [t("fields.firstTimers"), item.firstTimersCount ?? 0],
                [t("fields.holySpirit"), item.holySpiritBaptismCount ?? 0],
              ];

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
                  {item.branchId?.name ? (
                    <Badge>{item.branchId.name}</Badge>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-[#6b6b6b]">
                  <span>
                    {item.serviceDate
                      ? dateTime(item.serviceDate)
                      : t("noDate")}
                  </span>
                  {isMaagReport ? (
                    <span>{t("maagMonthly")}</span>
                  ) : isWeeklyReport ? (
                    <span>
                      {t.rich("currentAttendance", {
                        count: item.currentAttendance ?? 0,
                        b: strong,
                      })}
                    </span>
                  ) : (
                    <span>
                      {t.rich("totalPeople", { count: totalPeople, b: strong })}
                    </span>
                  )}
                  <span>
                    {t.rich("firstTimers", {
                      count: item.firstTimersCount ?? 0,
                      b: strong,
                    })}
                  </span>
                  <span>
                    {t.rich("newConverts", {
                      count: item.newConvertsCount ?? 0,
                      b: strong,
                    })}
                  </span>
                  {item.duplicateSummaryCount > 0 ? (
                    <Badge tone="danger">
                      {t("duplicates", { count: item.duplicateSummaryCount })}
                    </Badge>
                  ) : null}
                </div>

                <dl className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
                  {fields.map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-xl bg-[#f6f5f1] px-3 py-2.5"
                    >
                      <dt className="text-[12px] text-[#6b6b6b]">{label}</dt>
                      <dd className="mt-0.5 truncate text-[15px] font-semibold tabular-nums text-[#111111]">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                {isWeeklyReport && item.remarks ? (
                  <div className="max-w-3xl rounded-xl border border-black/[0.06] px-4 py-3 text-[14px] text-[#55534e]">
                    <p className="text-[12px] text-[#8a8780]">{t("remarks")}</p>
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
                    {loadingId === item._id ? t("working") : t("reject")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAction(item._id, "approve")}
                    disabled={busy}
                  >
                    {loadingId === item._id ? t("working") : t("approve")}
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
