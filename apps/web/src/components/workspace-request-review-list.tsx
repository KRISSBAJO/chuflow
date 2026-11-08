"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { Badge, Button, buttonClass, EmptyState, statusTone } from "@/components/ui/ui";
import { useAppFormat, useStatusLabel } from "@/i18n/labels";
import type { WorkspaceRequestItem } from "@/lib/types";

export function WorkspaceRequestReviewList({
  items,
}: {
  items: WorkspaceRequestItem[];
}) {
  const router = useRouter();
  const t = useTranslations("org.workspaceRequests");
  const signup = useTranslations("auth.request");
  const statusLabel = useStatusLabel();
  const { dateTime } = useAppFormat();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});

  async function updateStatus(id: string, status: WorkspaceRequestItem["status"]) {
    setLoadingId(id);

    try {
      const response = await fetch(`${API_URL}/workspace-requests/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, decisionNotes: decisionNotes[id] || undefined }),
      });
      if (response.status === 409) throw new Error(signup("handleTaken"));
      if (!response.ok) throw new Error(t("updateFailed"));
      toast.success(t("marked", { status: statusLabel(status) }));
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("updateFailed"),
      );
    } finally {
      setLoadingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState icon="branches" title={t("emptyTitle")}>
        {t("emptyBody")}
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
                  {item.workspaceHandle ? <Badge>@{item.workspaceHandle}</Badge> : null}
                  <Badge tone={statusTone(item.status)} dot>
                    {statusLabel(item.status)}
                  </Badge>
                  {item.branchCount ? <Badge>{t("branchesCount", { count: item.branchCount })}</Badge> : null}
                </div>

                <dl className="grid gap-x-6 gap-y-3 text-[14px] sm:grid-cols-2">
                  <div>
                    <dt className="text-[12px] text-[#8a8780]">{t("contact")}</dt>
                    <dd className="mt-0.5 font-medium text-[#111111]">{item.contactName}</dd>
                    <dd className="text-[#55534e]">{item.email}</dd>
                    {item.phone ? <dd className="text-[#55534e]">{item.phone}</dd> : null}
                  </div>
                  <div>
                    <dt className="text-[12px] text-[#8a8780]">{t("location")}</dt>
                    <dd className="mt-0.5 font-medium text-[#111111]">
                      {[item.city, item.state, item.country].filter(Boolean).join(", ") || t("notProvided")}
                    </dd>
                    {item.createdAt ? (
                      <dd className="text-[13px] text-[#8a8780]">{t("requested", { when: dateTime(item.createdAt) })}</dd>
                    ) : null}
                  </div>
                </dl>

                {item.notes ? (
                  <div className="rounded-xl bg-[#f6f5f1] px-4 py-3 text-[14px] text-[#55534e]">
                    <p className="text-[12px] text-[#8a8780]">{t("notesFromChurch")}</p>
                    <p className="mt-1 leading-[1.6]">{item.notes}</p>
                  </div>
                ) : null}

                {item.reviewedAt || item.reviewedBy || item.decisionNotes ? (
                  <div className="rounded-xl border border-black/[0.06] px-4 py-3 text-[14px] text-[#55534e]">
                    <p className="text-[12px] text-[#8a8780]">{t("review")}</p>
                    <p className="mt-1">
                      {reviewer ?? t("notReviewed")}
                      {item.reviewedAt ? ` · ${dateTime(item.reviewedAt)}` : ""}
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
                  placeholder={t("notePlaceholder")}
                  aria-label={t("noteFor", { name: item.organizationName })}
                  className="ui-input"
                />

                <div className="flex flex-wrap gap-2">
                  {item.status !== "approved" && item.status !== "provisioned" ? (
                    <Button size="sm" onClick={() => updateStatus(item._id, "approved")} disabled={busy}>
                      {loadingId === item._id ? t("working") : t("approve")}
                    </Button>
                  ) : null}
                  {item.status === "approved" ? (
                    <Button size="sm" variant="flame" onClick={() => updateStatus(item._id, "provisioned")} disabled={busy}>
                      {loadingId === item._id ? t("working") : t("markProvisioned")}
                    </Button>
                  ) : null}
                  {item.status === "new" ? (
                    <Button size="sm" variant="secondary" onClick={() => updateStatus(item._id, "in_review")} disabled={busy}>
                      {loadingId === item._id ? t("working") : t("startReview")}
                    </Button>
                  ) : null}
                  <a href={`mailto:${item.email}`} className={buttonClass("ghost", "sm")}>
                    {t("emailContact")}
                  </a>
                  {item.status !== "rejected" && item.status !== "provisioned" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-700 hover:bg-red-50 hover:text-red-800"
                      onClick={() => updateStatus(item._id, "rejected")}
                      disabled={busy}
                    >
                      {loadingId === item._id ? t("working") : t("reject")}
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
