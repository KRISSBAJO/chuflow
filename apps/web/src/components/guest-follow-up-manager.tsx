"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
    <section className="surface rounded-[32px] p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Follow-Up Actions</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-950">Assign and update care tasks</h2>
        </div>
        <div className="rounded-2xl bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-900">
          {followUps.length} active records
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {followUps.map((followUp) => (
          <form
            key={followUp._id}
            action={(formData) => updateFollowUp(followUp._id, formData)}
            className="rounded-[28px] border border-slate-200 bg-white p-5"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <select
                name={`status-${followUp._id}`}
                defaultValue={followUp.status}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              >
                {FOLLOW_UP_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                name={`assignedTo-${followUp._id}`}
                defaultValue={followUp.assignedTo?._id || ""}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              >
                <option value="">Unassigned</option>
                {assignableUsers.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.firstName} {user.lastName}
                  </option>
                ))}
              </select>
              <select
                name={`contactMethod-${followUp._id}`}
                defaultValue={followUp.contactMethod}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              >
                {FOLLOW_UP_CONTACT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                name={`nextActionDate-${followUp._id}`}
                type="datetime-local"
                defaultValue={followUp.nextActionDate ? new Date(followUp.nextActionDate).toISOString().slice(0, 16) : ""}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
              <textarea
                name={`note-${followUp._id}`}
                defaultValue={followUp.note}
                className="min-h-24 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none md:col-span-2"
              />
              <p className="text-xs text-slate-500 md:col-span-2">
                Current stage: {formatFollowUpValue(followUp.status)}. Reassigning a worker can move
                this record back to Assigned when needed.
              </p>
            </div>
            <button
              type="submit"
              disabled={loadingId === followUp._id}
              className="mt-4 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
            >
              {loadingId === followUp._id ? "Saving..." : "Update follow-up"}
            </button>
          </form>
        ))}
      </div>

      <form action={createFollowUp} className="mt-6 rounded-[28px] bg-slate-950 p-5 text-white">
        <p className="text-lg font-semibold">Add another care action</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <select name="create-status" defaultValue="new" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none">
            {FOLLOW_UP_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} className="text-slate-950">
                {option.label}
              </option>
            ))}
          </select>
          <select name="create-assignedTo" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none">
            <option value="" className="text-slate-950">Unassigned</option>
            {assignableUsers.map((user) => (
              <option key={user._id} value={user._id} className="text-slate-950">
                {user.firstName} {user.lastName}
              </option>
            ))}
          </select>
          <select
            name="create-contactMethod"
            defaultValue="phone_call"
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none"
          >
            {FOLLOW_UP_CONTACT_METHOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} className="text-slate-950">
                {option.label}
              </option>
            ))}
          </select>
          <input name="create-nextActionDate" type="datetime-local" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none" />
          <textarea name="create-note" required placeholder="What should happen next?" className="min-h-24 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none md:col-span-2" />
          <p className="text-xs text-slate-300 md:col-span-2">
            If you assign a care worker and leave the status as New, this record will move into Assigned automatically.
          </p>
        </div>
        <button type="submit" disabled={loadingId === "create"} className="mt-4 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white">
          {loadingId === "create" ? "Saving..." : "Create follow-up"}
        </button>
      </form>
    </section>
  );
}
