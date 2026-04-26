"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import type { AttendanceSubmissionItem } from "@/lib/types";

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

function getStatusTone(status: string) {
  switch (status) {
    case "approved":
      return "bg-emerald-50 text-emerald-700";
    case "rejected":
      return "bg-rose-50 text-rose-700";
    default:
      return "bg-amber-50 text-amber-700";
  }
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
    throw new Error(result.message || `Unable to ${action} attendance submission`);
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
          ? "Attendance summary approved"
          : "Attendance summary rejected",
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

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
          No attendance submissions are waiting in the current scope.
        </div>
      ) : (
        items.map((item) => {
          const totalPeople =
            (item.adultsCount ?? 0) + (item.childrenCount ?? 0);

          return (
            <article
              key={item._id}
              className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-950">
                      {item.serviceName || item.serviceType || item.templateName}
                    </h3>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${getStatusTone(
                        item.status,
                      )}`}
                    >
                      {formatStatus(item.status)}
                    </span>
                    {item.branchId?.name ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                        {item.branchId.name}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                      {item.serviceDate
                        ? new Date(item.serviceDate).toLocaleString()
                        : "No date"}
                    </span>
                    <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">
                      {totalPeople} total people
                    </span>
                    <span className="rounded-full bg-orange-50 px-2.5 py-1 text-orange-700">
                      {item.firstTimersCount ?? 0} first timers
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                      {item.newConvertsCount ?? 0} new converts
                    </span>
                    {item.duplicateSummaryCount > 0 ? (
                      <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700">
                        {item.duplicateSummaryCount} possible duplicate
                        {item.duplicateSummaryCount === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
                    {[
                      ["Men", item.menCount ?? 0],
                      ["Women", item.womenCount ?? 0],
                      ["Children", item.childrenCount ?? 0],
                      ["Adults", item.adultsCount ?? 0],
                      ["First timers", item.firstTimersCount ?? 0],
                      ["Holy Spirit", item.holySpiritBaptismCount ?? 0],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          {label}
                        </p>
                        <p className="mt-1 font-semibold text-slate-900">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {canApprove ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleAction(item._id, "reject")}
                      disabled={
                        pending ||
                        loadingId === item._id ||
                        item.status !== "pending"
                      }
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                    >
                      {loadingId === item._id ? "Working..." : "Reject"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction(item._id, "approve")}
                      disabled={
                        pending ||
                        loadingId === item._id ||
                        item.status !== "pending"
                      }
                      className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {loadingId === item._id ? "Working..." : "Approve"}
                    </button>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
