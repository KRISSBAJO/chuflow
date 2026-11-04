"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Field } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";
import { WEEKDAY_OPTIONS } from "@/lib/member-form-options";
import { isBranchScopedRole } from "@/lib/permissions";
import type { BranchSummary, MemberListItem } from "@/lib/types";

function getBranchId(member: MemberListItem) {
  return member.branchId?._id;
}

function getMemberName(member: MemberListItem) {
  return `${member.firstName} ${member.lastName}`;
}

export function ServiceUnitCreateForm({
  branches,
  members,
  defaultBranchId,
  currentUserRole,
  showHeader = true,
  onSuccess,
}: {
  branches: BranchSummary[];
  members: MemberListItem[];
  defaultBranchId?: string;
  currentUserRole: string;
  showHeader?: boolean;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState(
    defaultBranchId || branches[0]?._id || "",
  );

  const filteredMembers = useMemo(
    () =>
      members.filter((member) =>
        selectedBranchId ? getBranchId(member) === selectedBranchId : true,
      ),
    [members, selectedBranchId],
  );

  async function handleSubmit(formData: FormData) {
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/service-units`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          branchId: (formData.get("branchId") as string) || defaultBranchId,
          name: formData.get("name"),
          leaderMemberId: (formData.get("leaderMemberId") as string) || undefined,
          secretaryMemberId:
            (formData.get("secretaryMemberId") as string) || undefined,
          meetingDay: formData.get("meetingDay"),
          prayerDay: formData.get("prayerDay"),
          isActive: formData.get("isActive") === "on",
          notes: formData.get("notes") || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to create service unit");
      }

      toast.success("Service unit created", {
        description: "The branch service unit is now ready for member assignment.",
      });
      onSuccess?.();
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to create service unit";
      toast.error("Service unit not created", {
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }

  const leadershipRequired = filteredMembers.length > 0;

  return (
    <form action={handleSubmit} className={showHeader ? "rounded-2xl bg-white p-5 sm:p-6" : undefined}>
      {showHeader ? (
        <div className="mb-5">
          <h3 className="lp-heading text-[18px] leading-tight">Create service unit</h3>
          <p className="mt-1.5 text-[14px] leading-[1.6] text-[#6b6b6b]">
            Set up a ministry team for a branch, then assign members to it from their member record.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {!isBranchScopedRole(currentUserRole) ? (
          <Field label="Branch" required>
            <select
              name="branchId"
              value={selectedBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              className="ui-input"
              required
            >
              <option value="">Select branch</option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <input type="hidden" name="branchId" value={defaultBranchId ?? ""} />
        )}

        <Field label="Unit name" required>
          <input name="name" placeholder="Ushering, choir, technical..." className="ui-input" required />
        </Field>

        <Field label="Leader" required={leadershipRequired}>
          <select name="leaderMemberId" className="ui-input" required={leadershipRequired}>
            <option value="">Select leader</option>
            {filteredMembers.map((member) => (
              <option key={member._id} value={member._id}>
                {getMemberName(member)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Secretary" required={leadershipRequired}>
          <select name="secretaryMemberId" className="ui-input" required={leadershipRequired}>
            <option value="">Select secretary</option>
            {filteredMembers.map((member) => (
              <option key={member._id} value={member._id}>
                {getMemberName(member)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Meeting day" required>
          <select name="meetingDay" defaultValue="Saturday" className="ui-input" required>
            {WEEKDAY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Prayer day" required>
          <select name="prayerDay" defaultValue="Friday" className="ui-input" required>
            {WEEKDAY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Notes" className="md:col-span-2">
          <textarea
            name="notes"
            placeholder="Meeting venue, reporting rhythm, prayer focus, or other notes"
            className="ui-input"
          />
        </Field>
      </div>

      <p className="mt-4 rounded-xl bg-[#f6f5f1] px-4 py-3 text-[13px] leading-[1.6] text-[#6b6b6b]">
        {leadershipRequired
          ? "Leader and secretary lists only show members of the selected branch."
          : "Add members to this branch first if you want to assign a leader and secretary now."}
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-5">
        <label className="flex items-center gap-2.5 text-[14px] text-[#55534e]">
          <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4" />
          Active service unit
        </label>
        <Button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create service unit"}
        </Button>
      </div>
    </form>
  );
}
