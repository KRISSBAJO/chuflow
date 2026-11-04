"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge, Button, EmptyState, Field, formatStatus, statusTone } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";
import {
  FOLLOW_UP_CONTACT_METHOD_OPTIONS,
  FOLLOW_UP_STATUS_OPTIONS,
  formatFollowUpValue,
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
        throw new Error(result.message || "Unable to update follow-up");
      }

      toast.success("Follow-up updated", {
        description: "The care workflow record has been saved.",
      });
      router.refresh();
    } catch (error) {
      toast.error("Follow-up update failed", {
        description:
          error instanceof Error ? error.message : "Unable to update follow-up",
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
        throw new Error(result.message || "Unable to create follow-up");
      }

      toast.success("Follow-up created", {
        description: assignedTo
          ? "This care action is now assigned."
          : "This care action has been added to the New queue.",
      });
      router.refresh();
    } catch (error) {
      toast.error("Follow-up creation failed", {
        description:
          error instanceof Error ? error.message : "Unable to create follow-up",
      });
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-[#6b6b6b]">Assign care workers and update each care task as it moves forward.</p>
        <Badge tone={followUps.length > 0 ? "flame" : "neutral"}>{followUps.length} active records</Badge>
      </div>

      {followUps.length === 0 ? (
        <EmptyState icon="care" title="No follow-up yet">
          No care actions have been recorded for this guest. Add the first one below.
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
                  {formatStatus(followUp.status)}
                </Badge>
                {followUp.assignedTo ? (
                  <span className="text-[13px] text-[#6b6b6b]">
                    Owned by {followUp.assignedTo.firstName} {followUp.assignedTo.lastName}
                  </span>
                ) : (
                  <span className="text-[13px] text-[#8a8780]">Unassigned</span>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Stage">
                  <select name={`status-${followUp._id}`} defaultValue={followUp.status} className="ui-input">
                    {FOLLOW_UP_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Care worker">
                  <select name={`assignedTo-${followUp._id}`} defaultValue={followUp.assignedTo?._id || ""} className="ui-input">
                    <option value="">Unassigned</option>
                    {assignableUsers.map((user) => (
                      <option key={user._id} value={user._id}>
                        {user.firstName} {user.lastName}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Contact method">
                  <select name={`contactMethod-${followUp._id}`} defaultValue={followUp.contactMethod} className="ui-input">
                    {FOLLOW_UP_CONTACT_METHOD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Next action">
                  <input
                    name={`nextActionDate-${followUp._id}`}
                    type="datetime-local"
                    defaultValue={followUp.nextActionDate ? new Date(followUp.nextActionDate).toISOString().slice(0, 16) : ""}
                    className="ui-input"
                  />
                </Field>
                <Field
                  label="Note"
                  className="md:col-span-2"
                  hint={`Current stage: ${formatFollowUpValue(followUp.status)}. Reassigning a worker can move this record back to Assigned when needed.`}
                >
                  <textarea name={`note-${followUp._id}`} defaultValue={followUp.note} className="ui-input" />
                </Field>
              </div>
              <div className="mt-4 flex justify-end">
                <Button type="submit" variant="secondary" disabled={loadingId === followUp._id}>
                  {loadingId === followUp._id ? "Saving..." : "Update follow-up"}
                </Button>
              </div>
            </form>
          ))}
        </div>
      )}

      <form action={createFollowUp} className="rounded-2xl bg-[#f6f5f1] p-5">
        <p className="lp-heading text-[17px]">Add another care action</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Stage">
            <select name="create-status" defaultValue="new" className="ui-input">
              {FOLLOW_UP_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Care worker">
            <select name="create-assignedTo" className="ui-input">
              <option value="">Unassigned</option>
              {assignableUsers.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.firstName} {user.lastName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Contact method">
            <select name="create-contactMethod" defaultValue="phone_call" className="ui-input">
              {FOLLOW_UP_CONTACT_METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Next action">
            <input name="create-nextActionDate" type="datetime-local" className="ui-input" />
          </Field>
          <Field
            label="Note"
            required
            className="md:col-span-2"
            hint="If you assign a care worker and leave the stage as New, the record moves to Assigned automatically."
          >
            <textarea name="create-note" required placeholder="What should happen next?" className="ui-input" />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="submit" disabled={loadingId === "create"}>
            {loadingId === "create" ? "Saving..." : "Create follow-up"}
          </Button>
        </div>
      </form>
    </div>
  );
}
