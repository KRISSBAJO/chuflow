"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { apiPatch } from "@/lib/api";
import { Badge, Button, buttonClass, EmptyState, formatStatus, statusTone } from "@/components/ui/ui";
import type { WorkspaceRequestItem } from "@/lib/types";

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
      <EmptyState icon="branches" title="No requests waiting">
        No workspace requests are waiting right now.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const busy = pending || loadingId === item._id;
        const reviewer = item.reviewedBy
          ? [item.reviewedBy.firstName, item.reviewedBy.lastName].filter(Boolean).join(" ").trim() || item.reviewedBy.email
          : null;

        return (
          <article key={item._id} className="rounded-2xl border border-black/[0.06] p-5 transition-colors hover:border-black/[0.12]">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="lp-heading text-[18px]">{item.organizationName}</h3>
                  <Badge tone={statusTone(item.status)} dot>
                    {formatStatus(item.status)}
                  </Badge>
                  {item.branchCount ? <Badge>{item.branchCount} branches</Badge> : null}
                </div>

                <dl className="grid gap-x-6 gap-y-3 text-[14px] sm:grid-cols-2">
                  <div>
                    <dt className="text-[12px] text-[#8a8780]">Contact</dt>
                    <dd className="mt-0.5 font-medium text-[#111111]">{item.contactName}</dd>
                    <dd className="text-[#55534e]">{item.email}</dd>
                    {item.phone ? <dd className="text-[#55534e]">{item.phone}</dd> : null}
                  </div>
                  <div>
                    <dt className="text-[12px] text-[#8a8780]">Location</dt>
                    <dd className="mt-0.5 font-medium text-[#111111]">
                      {[item.city, item.state, item.country].filter(Boolean).join(", ") || "Not provided"}
                    </dd>
                    {item.createdAt ? (
                      <dd className="text-[13px] text-[#8a8780]">Requested {new Date(item.createdAt).toLocaleString()}</dd>
                    ) : null}
                  </div>
                </dl>

                {item.notes ? (
                  <div className="rounded-xl bg-[#f6f5f1] px-4 py-3 text-[14px] text-[#55534e]">
                    <p className="text-[12px] text-[#8a8780]">Notes from the church</p>
                    <p className="mt-1 leading-[1.6]">{item.notes}</p>
                  </div>
                ) : null}

                {item.reviewedAt || item.reviewedBy || item.decisionNotes ? (
                  <div className="rounded-xl border border-black/[0.06] px-4 py-3 text-[14px] text-[#55534e]">
                    <p className="text-[12px] text-[#8a8780]">Review</p>
                    <p className="mt-1">
                      {reviewer ?? "Not reviewed yet"}
                      {item.reviewedAt ? ` · ${new Date(item.reviewedAt).toLocaleString()}` : ""}
                    </p>
                    {item.decisionNotes ? <p className="mt-1 text-[#6b6b6b]">{item.decisionNotes}</p> : null}
                  </div>
                ) : null}
              </div>

              <div className="flex w-full flex-col gap-3 xl:max-w-sm">
                <textarea
                  value={decisionNotes[item._id] ?? item.decisionNotes ?? ""}
                  onChange={(event) =>
                    setDecisionNotes((current) => ({
                      ...current,
                      [item._id]: event.target.value,
                    }))
                  }
                  placeholder="Optional review note"
                  aria-label={`Review note for ${item.organizationName}`}
                  className="ui-input"
                />

                <div className="flex flex-wrap gap-2">
                  {item.status !== "approved" && item.status !== "provisioned" ? (
                    <Button size="sm" onClick={() => updateStatus(item._id, "approved")} disabled={busy}>
                      {loadingId === item._id ? "Working..." : "Approve"}
                    </Button>
                  ) : null}
                  {item.status === "approved" ? (
                    <Button size="sm" variant="flame" onClick={() => updateStatus(item._id, "provisioned")} disabled={busy}>
                      {loadingId === item._id ? "Working..." : "Mark provisioned"}
                    </Button>
                  ) : null}
                  {item.status === "new" ? (
                    <Button size="sm" variant="secondary" onClick={() => updateStatus(item._id, "in_review")} disabled={busy}>
                      {loadingId === item._id ? "Working..." : "Start review"}
                    </Button>
                  ) : null}
                  <a href={`mailto:${item.email}`} className={buttonClass("ghost", "sm")}>
                    Email contact
                  </a>
                  {item.status !== "rejected" && item.status !== "provisioned" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-700 hover:bg-red-50 hover:text-red-800"
                      onClick={() => updateStatus(item._id, "rejected")}
                      disabled={busy}
                    >
                      {loadingId === item._id ? "Working..." : "Reject"}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
