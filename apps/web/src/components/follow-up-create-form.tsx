"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import {
  FOLLOW_UP_CONTACT_METHOD_OPTIONS,
  FOLLOW_UP_STATUS_OPTIONS,
  normalizeFollowUpStatus,
} from "@/lib/follow-up-options";
import type { GuestListItem, UserSummary } from "@/lib/types";

export function FollowUpCreateForm({
  guests,
  users,
  currentUserRole,
  currentUserId,
  assignmentDisabled = false,
  assignmentHint,
  guestSelectionDisabled = false,
  guestSelectionHint,
}: {
  guests: GuestListItem[];
  users: UserSummary[];
  currentUserRole?: string;
  currentUserId?: string;
  assignmentDisabled?: boolean;
  assignmentHint?: string;
  guestSelectionDisabled?: boolean;
  guestSelectionHint?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const assignableUsers = users.filter((user) =>
    ["branch_admin", "resident_pastor", "associate_pastor", "follow_up"].includes(user.role),
  );
  const visibleAssignableUsers =
    currentUserRole === "follow_up" && currentUserId
      ? assignableUsers.filter((user) => user._id === currentUserId)
      : assignableUsers;

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const assignedTo = String(formData.get("assignedTo") ?? "").trim();
    const selectedStatus = String(formData.get("status") ?? "new");

    try {
      const response = await fetch(`${API_URL}/follow-ups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          guestId: formData.get("guestId"),
          assignedTo: assignedTo || null,
          status: normalizeFollowUpStatus(selectedStatus, assignedTo || undefined),
          contactMethod: formData.get("contactMethod"),
          note: formData.get("note"),
          nextActionDate: formData.get("nextActionDate") || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to create follow-up");
      }

      toast.success("Follow-up saved", {
        description:
          assignedTo
            ? "The care task was assigned and moved into the workflow."
            : "The care task was created in the New column.",
      });
      router.refresh();
    } catch (error) {
      toast.error("Follow-up not saved", {
        description:
          error instanceof Error ? error.message : "Unable to create follow-up",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="rounded-[28px] bg-white p-6">
      <div className="flex flex-col gap-2">
        <h3 className="text-xl font-semibold text-slate-950">Add follow-up</h3>
        <p className="text-sm leading-6 text-slate-500">
          Choose the guest, assign a care owner when needed, and pick the next ministry action.
        </p>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-slate-700">Guest</span>
          <select
            name="guestId"
            disabled={guestSelectionDisabled}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            required
          >
            <option value="">Select guest</option>
            {guests.map((guest) => (
              <option key={guest._id} value={guest._id}>
                {guest.firstName} {guest.lastName}
                {guest.branchId?.name ? ` · ${guest.branchId.name}` : ""}
                {guest.phone ? ` · ${guest.phone}` : ""}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            {guestSelectionHint ||
              "Pick the guest record that needs care so the next step is logged against the right person."}
          </p>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Assign to</span>
          <select
            name="assignedTo"
            disabled={assignmentDisabled}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option value="">Leave unassigned</option>
            {visibleAssignableUsers.map((user) => (
              <option key={user._id} value={user._id}>
                {user.firstName} {user.lastName}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            {assignmentHint ||
              "Assigning a care worker automatically moves this record from New to Assigned."}
          </p>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Workflow status</span>
          <select
            name="status"
            defaultValue="new"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required
          >
            {FOLLOW_UP_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            Choosing Contacted or Returned moves the card into that board column after save.
          </p>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Contact method</span>
          <select
            name="contactMethod"
            defaultValue="phone_call"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required
          >
            {FOLLOW_UP_CONTACT_METHOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Next action date</span>
          <input name="nextActionDate" type="datetime-local" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none" />
        </label>
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-slate-700">Care note</span>
          <textarea name="note" placeholder="What should happen next, and who owns it?" className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none" required />
        </label>
      </div>
      <button
        type="submit"
        disabled={loading || guestSelectionDisabled}
        className="mt-5 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {loading ? "Saving..." : "Save follow-up"}
      </button>
    </form>
  );
}
