"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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

  return (
    <form action={handleSubmit} className="rounded-[24px] bg-white p-5">
      {showHeader ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold text-slate-950">
            Create service unit
          </h3>
          <p className="text-sm leading-6 text-slate-500">
            Build the real ministry structure for a branch, then assign members
            into it from the member record.
          </p>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {!isBranchScopedRole(currentUserRole) ? (
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Branch</span>
            <select
              name="branchId"
              value={selectedBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              required
            >
              <option value="">Select branch</option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="branchId" value={defaultBranchId ?? ""} />
        )}

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Unit name</span>
          <input
            name="name"
            placeholder="Ushering, Choir, Technical..."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Leader</span>
          <select
            name="leaderMemberId"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required={filteredMembers.length > 0}
          >
            <option value="">Select leader</option>
            {filteredMembers.map((member) => (
              <option key={member._id} value={member._id}>
                {getMemberName(member)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Secretary</span>
          <select
            name="secretaryMemberId"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required={filteredMembers.length > 0}
          >
            <option value="">Select secretary</option>
            {filteredMembers.map((member) => (
              <option key={member._id} value={member._id}>
                {getMemberName(member)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Meeting day</span>
          <select
            name="meetingDay"
            defaultValue="Saturday"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required
          >
            {WEEKDAY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Prayer day</span>
          <select
            name="prayerDay"
            defaultValue="Friday"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required
          >
            {WEEKDAY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4" />
        Active service unit
      </label>

      <label className="mt-4 block space-y-2">
        <span className="text-sm font-medium text-slate-700">Notes</span>
        <textarea
          name="notes"
          placeholder="Meeting venue, reporting rhythm, prayer focus, or extra structure notes"
          className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
        />
      </label>

      <p className="mt-3 text-xs text-slate-500">
        {filteredMembers.length > 0
          ? "Leader and secretary lists are scoped to the selected branch."
          : "Add members into this branch first if you want to assign leader and secretary immediately."}
      </p>

      <button
        type="submit"
        disabled={loading}
        className="mt-4 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
      >
        {loading ? "Creating..." : "Create service unit"}
      </button>
    </form>
  );
}
