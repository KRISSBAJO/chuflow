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
import { Button, Card, CardHeader, Field } from "@/components/ui/ui";
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
  successRedirectHref,
}: {
  guests: GuestListItem[];
  users: UserSummary[];
  currentUserRole?: string;
  currentUserId?: string;
  assignmentDisabled?: boolean;
  assignmentHint?: string;
  guestSelectionDisabled?: boolean;
  guestSelectionHint?: string;
  successRedirectHref?: string;
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
      if (successRedirectHref) {
        router.push(successRedirectHref);
      } else {
        router.refresh();
      }
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
    <Card className="app-rise p-6 sm:p-7">
      <form action={handleSubmit}>
        <CardHeader
          label="New care task"
          title="Add follow-up"
          description="Choose the guest, assign a care owner when needed, and pick the next ministry action."
        />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field
            label="Guest"
            required
            className="md:col-span-2"
            hint={
              guestSelectionHint ||
              "Pick the guest record that needs care so the next step is logged against the right person."
            }
          >
            <select name="guestId" disabled={guestSelectionDisabled} className="ui-input" required>
              <option value="">Select guest</option>
              {guests.map((guest) => (
                <option key={guest._id} value={guest._id}>
                  {guest.firstName} {guest.lastName}
                  {guest.branchId?.name ? ` · ${guest.branchId.name}` : ""}
                  {guest.phone ? ` · ${guest.phone}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Assign to"
            hint={assignmentHint || "Assigning a care worker automatically moves this record from New to Assigned."}
          >
            <select name="assignedTo" disabled={assignmentDisabled} className="ui-input">
              <option value="">Leave unassigned</option>
              {visibleAssignableUsers.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.firstName} {user.lastName}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Workflow stage"
            required
            hint="Choosing Contacted or Returned moves the task to that stage after saving."
          >
            <select name="status" defaultValue="new" className="ui-input" required>
              {FOLLOW_UP_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Contact method" required>
            <select name="contactMethod" defaultValue="phone_call" className="ui-input" required>
              {FOLLOW_UP_CONTACT_METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Next action date">
            <input name="nextActionDate" type="datetime-local" className="ui-input" />
          </Field>
          <Field label="Care note" required className="md:col-span-2">
            <textarea
              name="note"
              placeholder="What should happen next, and who owns it?"
              className="ui-input !min-h-28"
              required
            />
          </Field>
        </div>
        <div className="mt-6 flex justify-end border-t border-black/[0.06] pt-5">
          <Button type="submit" disabled={loading || guestSelectionDisabled}>
            {loading ? "Saving..." : "Save follow-up"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
