"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { WEEKDAY_OPTIONS } from "@/lib/member-form-options";
import { isBranchScopedRole } from "@/lib/permissions";
import type { BranchSummary, MemberListItem, ServiceUnitSummary } from "@/lib/types";

function getMemberName(member: MemberListItem) {
  return `${member.firstName} ${member.lastName}`;
}

function getBranchId(value: ServiceUnitSummary["branchId"]) {
  return typeof value === "string" ? value : value?._id;
}

function getLeaderId(unit: ServiceUnitSummary) {
  return unit.leaderMemberId?._id || "";
}

function getSecretaryId(unit: ServiceUnitSummary) {
  return unit.secretaryMemberId?._id || "";
}

export function ServiceUnitManagementList({
  serviceUnits,
  members,
  branches,
  currentUserRole,
}: {
  serviceUnits: ServiceUnitSummary[];
  members: MemberListItem[];
  branches: BranchSummary[];
  currentUserRole: string;
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleSubmit(unitId: string, formData: FormData) {
    setLoadingId(unitId);

    try {
      const response = await fetch(`${API_URL}/service-units/${unitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          branchId: (formData.get(`branchId-${unitId}`) as string) || undefined,
          name: formData.get(`name-${unitId}`),
          leaderMemberId:
            (formData.get(`leaderMemberId-${unitId}`) as string) || undefined,
          secretaryMemberId:
            (formData.get(`secretaryMemberId-${unitId}`) as string) || undefined,
          meetingDay: formData.get(`meetingDay-${unitId}`),
          prayerDay: formData.get(`prayerDay-${unitId}`),
          isActive: formData.get(`isActive-${unitId}`) === "on",
          notes: formData.get(`notes-${unitId}`) || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to update service unit");
      }

      toast.success("Service unit updated", {
        description: "The service unit structure has been saved.",
      });
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to update service unit";
      toast.error("Service unit update failed", {
        description: message,
      });
    } finally {
      setLoadingId(null);
    }
  }

  if (serviceUnits.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-5 py-8 text-sm text-slate-500">
        No service units created yet. Start with one branch unit, add a leader and
        secretary, then assign members into it from the member records.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {serviceUnits.map((unit) => {
        const branchId = getBranchId(unit.branchId) || "";
        const branchMembers = members.filter((member) => member.branchId?._id === branchId);

        return (
          <details key={unit._id} className="rounded-[22px] border border-slate-200 bg-white">
            <summary className="cursor-pointer list-none px-4 py-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-slate-900">{unit.name}</p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                        unit.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {unit.isActive ? "active" : "inactive"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {(typeof unit.branchId === "string" ? unit.branchId : unit.branchId?.name) ||
                      "Branch not set"}{" "}
                    · meeting {unit.meetingDay} · prayer {unit.prayerDay}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
                      Leader
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {unit.leaderMemberId?.firstName
                        ? `${unit.leaderMemberId.firstName} ${unit.leaderMemberId.lastName || ""}`.trim()
                        : "Not set"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
                      Secretary
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {unit.secretaryMemberId?.firstName
                        ? `${unit.secretaryMemberId.firstName} ${unit.secretaryMemberId.lastName || ""}`.trim()
                        : "Not set"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
                      Members
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {unit.memberCount ?? 0}
                    </p>
                  </div>
                </div>
              </div>
            </summary>
            <div className="border-t border-slate-200 px-4 py-4">
              <form
                action={(formData) => handleSubmit(unit._id, formData)}
                className="grid gap-3 md:grid-cols-2"
              >
                {!isBranchScopedRole(currentUserRole) ? (
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Branch</span>
                    <select
                      name={`branchId-${unit._id}`}
                      defaultValue={branchId}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
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
                  <input type="hidden" name={`branchId-${unit._id}`} value={branchId} />
                )}

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Unit name</span>
                  <input
                    name={`name-${unit._id}`}
                    defaultValue={unit.name}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Leader</span>
                  <select
                    name={`leaderMemberId-${unit._id}`}
                    defaultValue={getLeaderId(unit)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  >
                    <option value="">Select leader</option>
                    {branchMembers.map((member) => (
                      <option key={member._id} value={member._id}>
                        {getMemberName(member)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Secretary</span>
                  <select
                    name={`secretaryMemberId-${unit._id}`}
                    defaultValue={getSecretaryId(unit)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  >
                    <option value="">Select secretary</option>
                    {branchMembers.map((member) => (
                      <option key={member._id} value={member._id}>
                        {getMemberName(member)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Meeting day</span>
                  <select
                    name={`meetingDay-${unit._id}`}
                    defaultValue={unit.meetingDay}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
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
                    name={`prayerDay-${unit._id}`}
                    defaultValue={unit.prayerDay}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  >
                    {WEEKDAY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Notes</span>
                  <textarea
                    name={`notes-${unit._id}`}
                    defaultValue={unit.notes || ""}
                    className="min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  />
                </label>

                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name={`isActive-${unit._id}`}
                    defaultChecked={unit.isActive}
                    className="h-4 w-4"
                  />
                  Active service unit
                </label>

                <button
                  type="submit"
                  disabled={loadingId === unit._id}
                  className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white md:w-fit"
                >
                  {loadingId === unit._id ? "Saving..." : "Update service unit"}
                </button>
              </form>
            </div>
          </details>
        );
      })}
    </div>
  );
}
