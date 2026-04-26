"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { apiPatch } from "@/lib/api";
import type { WorkspaceRequestItem } from "@/lib/types";

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

function getStatusTone(status: string) {
  switch (status) {
    case "approved":
      return "bg-emerald-50 text-emerald-700";
    case "rejected":
      return "bg-rose-50 text-rose-700";
    case "provisioned":
      return "bg-sky-50 text-sky-700";
    case "in_review":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export function WorkspaceRequestReviewList({
  items,
}: {
  items: WorkspaceRequestItem[];
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});

  async function updateStatus(id: string, status: WorkspaceRequestItem["status"]) {
    setLoadingId(id);

    try {
      await apiPatch(`/workspace-requests/${id}`, {
        status,
        decisionNotes: decisionNotes[id] || undefined,
      });
      toast.success(`Workspace request marked ${formatStatus(status)}`);
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Workspace request update failed",
      );
    } finally {
      setLoadingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
        No workspace requests are waiting right now.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article
          key={item._id}
          className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-slate-950">
                  {item.organizationName}
                </h3>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${getStatusTone(
                    item.status,
                  )}`}
                >
                  {formatStatus(item.status)}
                </span>
                {item.branchCount ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    {item.branchCount} branches
                  </span>
                ) : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Contact
                  </p>
                  <p className="mt-1 font-medium text-slate-900">{item.contactName}</p>
                  <p>{item.email}</p>
                  {item.phone ? <p>{item.phone}</p> : null}
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Location
                  </p>
                  <p className="mt-1 font-medium text-slate-900">
                    {[item.city, item.state, item.country].filter(Boolean).join(", ") || "Not provided"}
                  </p>
                  {item.createdAt ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Requested {new Date(item.createdAt).toLocaleString()}
                    </p>
                  ) : null}
                </div>
              </div>

              {item.notes ? (
                <div className="rounded-xl bg-[#fcfaf4] px-3 py-2 text-sm text-slate-600">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Notes
                  </p>
                  <p className="mt-1">{item.notes}</p>
                </div>
              ) : null}

              {item.reviewedAt || item.reviewedBy || item.decisionNotes ? (
                <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Review
                  </p>
                  <p className="mt-1">
                    {item.reviewedBy
                      ? `${[item.reviewedBy.firstName, item.reviewedBy.lastName]
                          .filter(Boolean)
                          .join(" ")
                          .trim() || item.reviewedBy.email}`
                      : "Not reviewed yet"}
                    {item.reviewedAt
                      ? ` · ${new Date(item.reviewedAt).toLocaleString()}`
                      : ""}
                  </p>
                  {item.decisionNotes ? (
                    <p className="mt-1 text-slate-500">{item.decisionNotes}</p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex w-full max-w-sm flex-col gap-3">
              <textarea
                value={decisionNotes[item._id] ?? item.decisionNotes ?? ""}
                onChange={(event) =>
                  setDecisionNotes((current) => ({
                    ...current,
                    [item._id]: event.target.value,
                  }))
                }
                placeholder="Optional review note"
                className="min-h-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
              />

              <div className="flex flex-wrap gap-2">
                <a
                  href={`mailto:${item.email}`}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  Email contact
                </a>
              {item.status === "new" ? (
                <button
                  type="button"
                  onClick={() => updateStatus(item._id, "in_review")}
                  disabled={pending || loadingId === item._id}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                >
                  {loadingId === item._id ? "Working..." : "Start review"}
                </button>
              ) : null}

              {item.status !== "approved" && item.status !== "provisioned" ? (
                <button
                  type="button"
                  onClick={() => updateStatus(item._id, "approved")}
                  disabled={pending || loadingId === item._id}
                  className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {loadingId === item._id ? "Working..." : "Approve"}
                </button>
              ) : null}

              {item.status === "approved" ? (
                <button
                  type="button"
                  onClick={() => updateStatus(item._id, "provisioned")}
                  disabled={pending || loadingId === item._id}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                >
                  {loadingId === item._id ? "Working..." : "Mark provisioned"}
                </button>
              ) : null}

              {item.status !== "rejected" && item.status !== "provisioned" ? (
                <button
                  type="button"
                  onClick={() => updateStatus(item._id, "rejected")}
                  disabled={pending || loadingId === item._id}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50"
                >
                  {loadingId === item._id ? "Working..." : "Reject"}
                </button>
              ) : null}
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
