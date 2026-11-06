"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useStatusLabel } from "@/i18n/labels";
import { toast } from "sonner";
import { Badge, Button, EmptyState, Field, statusTone } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";
import {
  FOLLOW_UP_CONTACT_METHOD_OPTIONS,
  FOLLOW_UP_STATUS_OPTIONS,
  normalizeFollowUpStatus,
} from "@/lib/follow-up-options";
import type { FollowUpItem, UserSummary } from "@/lib/types";

export function GuestFollowUpManager({
  guestId,
  followUps,
  users,
}: {
  guestId: string;
  followUps: FollowUpItem[];
  users: UserSummary[];
}) {
  const router = useRouter();
  const t = useTranslations("people.guests.followUpManager");
  const tOptions = useTranslations("people.followUpOptions");
  const tsh = useTranslations("people.shared");
  const tc = useTranslations("common");
  const statusLabel = useStatusLabel();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const assignableUsers = users.filter((user) =>
    ["branch_admin", "resident_pastor", "associate_pastor", "follow_up"].includes(user.role),
  );

  async function updateFollowUp(followUpId: string, formData: FormData) {
    setLoadingId(followUpId);
    const assignedTo = String(formData.get(`assignedTo-${followUpId}`) ?? "").trim();
    const selectedStatus = String(formData.get(`status-${followUpId}`) ?? "new");

    try {
      const response = await fetch(`${API_URL}/follow-ups/${followUpId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status: normalizeFollowUpStatus(selectedStatus, assignedTo || undefined),
          assignedTo: assignedTo || null,
          contactMethod: formData.get(`contactMethod-${followUpId}`),
          note: formData.get(`note-${followUpId}`),
          nextActionDate: formData.get(`nextActionDate-${followUpId}`) || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || t("errorUpdate"));
      }

      toast.success(t("updatedTitle"), {
        description: t("updatedDescription"),
      });
      router.refresh();
    } catch (error) {
      toast.error(t("updateFailed"), {
        description:
          error instanceof Error ? error.message : t("errorUpdate"),
      });
    } finally {
      setLoadingId(null);
    }
  }

  async function createFollowUp(formData: FormData) {
    setLoadingId("create");
    const assignedTo = String(formData.get("create-assignedTo") ?? "").trim();
    const selectedStatus = String(formData.get("create-status") ?? "new");

    try {
      const response = await fetch(`${API_URL}/follow-ups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          guestId,
          status: normalizeFollowUpStatus(selectedStatus, assignedTo || undefined),
          assignedTo: assignedTo || null,
          contactMethod: formData.get("create-contactMethod"),
          note: formData.get("create-note"),
          nextActionDate: formData.get("create-nextActionDate") || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || t("errorCreate"));
      }

      toast.success(t("createdTitle"), {
        description: assignedTo
          ? t("createdAssigned")
          : t("createdQueued"),
      });
      router.refresh();
    } catch (error) {
      toast.error(t("createFailed"), {
        description:
          error instanceof Error ? error.message : t("errorCreate"),
      });
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-[#6b6b6b]">{t("intro")}</p>
        <Badge tone={followUps.length > 0 ? "flame" : "neutral"}>{t("activeRecords", { count: followUps.length })}</Badge>
      </div>

      {followUps.length === 0 ? (
        <EmptyState icon="care" title={t("noneTitle")}>
          {t("noneBody")}
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {followUps.map((followUp) => (
            <form
              key={followUp._id}
              action={(formData) => updateFollowUp(followUp._id, formData)}
              className="rounded-2xl border border-black/[0.06] p-5"
            >
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(followUp.status)} dot>
                  {statusLabel(followUp.status)}
                </Badge>
                {followUp.assignedTo ? (
                  <span className="text-[13px] text-[#6b6b6b]">
                    {t("ownedBy", { name: `${followUp.assignedTo.firstName} ${followUp.assignedTo.lastName}` })}
                  </span>
                ) : (
                  <span className="text-[13px] text-[#8a8780]">{tsh("unassigned")}</span>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={tsh("stage")}>
                  <select name={`status-${followUp._id}`} defaultValue={followUp.status} className="ui-input">
                    {FOLLOW_UP_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {statusLabel(option.value)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("careWorker")}>
                  <select name={`assignedTo-${followUp._id}`} defaultValue={followUp.assignedTo?._id || ""} className="ui-input">
                    <option value="">{tsh("unassigned")}</option>
                    {assignableUsers.map((user) => (
                      <option key={user._id} value={user._id}>
                        {user.firstName} {user.lastName}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("contactMethod")}>
                  <select name={`contactMethod-${followUp._id}`} defaultValue={followUp.contactMethod} className="ui-input">
                    {FOLLOW_UP_CONTACT_METHOD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {tOptions(`methods.${option.value}`)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("nextAction")}>
                  <input
                    name={`nextActionDate-${followUp._id}`}
                    type="datetime-local"
                    defaultValue={followUp.nextActionDate ? new Date(followUp.nextActionDate).toISOString().slice(0, 16) : ""}
                    className="ui-input"
                  />
                </Field>
                <Field
                  label={t("note")}
                  className="md:col-span-2"
                  hint={t("currentStageHint", { stage: statusLabel(followUp.status) || tOptions("notSet") })}
                >
                  <textarea name={`note-${followUp._id}`} defaultValue={followUp.note} className="ui-input" />
                </Field>
              </div>
              <div className="mt-4 flex justify-end">
                <Button type="submit" variant="secondary" disabled={loadingId === followUp._id}>
                  {loadingId === followUp._id ? tc("saving") : t("updateFollowUp")}
                </Button>
              </div>
            </form>
          ))}
        </div>
      )}

      <form action={createFollowUp} className="rounded-2xl bg-[#f6f5f1] p-5">
        <p className="lp-heading text-[17px]">{t("addAnother")}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label={tsh("stage")}>
            <select name="create-status" defaultValue="new" className="ui-input">
              {FOLLOW_UP_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {statusLabel(option.value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("careWorker")}>
            <select name="create-assignedTo" className="ui-input">
              <option value="">{tsh("unassigned")}</option>
              {assignableUsers.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.firstName} {user.lastName}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("contactMethod")}>
            <select name="create-contactMethod" defaultValue="phone_call" className="ui-input">
              {FOLLOW_UP_CONTACT_METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {tOptions(`methods.${option.value}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("nextAction")}>
            <input name="create-nextActionDate" type="datetime-local" className="ui-input" />
          </Field>
          <Field
            label={t("note")}
            required
            className="md:col-span-2"
            hint={t("createHint")}
          >
            <textarea name="create-note" required placeholder={t("notePlaceholder")} className="ui-input" />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="submit" disabled={loadingId === "create"}>
            {loadingId === "create" ? tc("saving") : t("createFollowUp")}
          </Button>
        </div>
      </form>
    </div>
  );
}
