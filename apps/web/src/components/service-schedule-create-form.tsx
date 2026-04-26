"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { isBranchScopedRole } from "@/lib/permissions";
import type { BranchSummary, ServiceTypeSummary } from "@/lib/types";

const weekdayOptions = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function getBranchId(value: ServiceTypeSummary["branchId"]) {
  return typeof value === "string" ? value : value?._id;
}

export function ServiceScheduleCreateForm({
  branches,
  serviceTypes,
  defaultBranchId,
  currentUserRole,
}: {
  branches: BranchSummary[];
  serviceTypes: ServiceTypeSummary[];
  defaultBranchId?: string;
  currentUserRole: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState(
    defaultBranchId || branches[0]?._id || "",
  );

  const filteredServiceTypes = useMemo(
    () =>
      serviceTypes.filter((serviceType) => {
        if (!serviceType.isActive) {
          return false;
        }

        if (!selectedBranchId) {
          return true;
        }

        return getBranchId(serviceType.branchId) === selectedBranchId;
      }),
    [selectedBranchId, serviceTypes],
  );

  async function handleSubmit(formData: FormData) {
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/service-schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          branchId: (formData.get("branchId") as string) || defaultBranchId,
          serviceTypeId: formData.get("serviceTypeId"),
          name: formData.get("name"),
          dayOfWeek: formData.get("dayOfWeek"),
          startTime: formData.get("startTime"),
          endTime: formData.get("endTime") || undefined,
          timezone: formData.get("timezone") || undefined,
          locationNotes: formData.get("locationNotes") || undefined,
          attendanceEntryEnabled: formData.get("attendanceEntryEnabled") === "on",
          financeEntryEnabled: formData.get("financeEntryEnabled") === "on",
          isActive: formData.get("isActive") === "on",
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to create service schedule");
      }

      toast.success("Service schedule created", {
        description:
          "Attendance and finance can now attach entries to this real branch service.",
      });
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to create service schedule";
      toast.error("Service schedule not created", {
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="rounded-[24px] bg-white p-5">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-slate-950">Create service schedule</h3>
        <p className="text-sm leading-6 text-slate-500">
          Define recurring branch services so attendance and finance stop relying on loose names.
        </p>
      </div>

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
          <span className="text-sm font-medium text-slate-700">Service type</span>
          <select
            name="serviceTypeId"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required
          >
            <option value="">Select service type</option>
            {filteredServiceTypes.map((serviceType) => (
              <option key={serviceType._id} value={serviceType._id}>
                {serviceType.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Schedule name</span>
          <input
            name="name"
            placeholder="First service, Sunday worship, Midweek recharge..."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Day of week</span>
          <select
            name="dayOfWeek"
            defaultValue="sunday"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required
          >
            {weekdayOptions.map((day) => (
              <option key={day} value={day}>
                {day.charAt(0).toUpperCase() + day.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Start time</span>
          <input
            name="startTime"
            type="time"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">End time</span>
          <input
            name="endTime"
            type="time"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-slate-700">Timezone</span>
          <input
            name="timezone"
            defaultValue="America/Chicago"
            placeholder="America/Chicago"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />
        </label>
      </div>

      <label className="mt-4 block space-y-2">
        <span className="text-sm font-medium text-slate-700">Location notes</span>
        <textarea
          name="locationNotes"
          placeholder="Optional room, campus, or service notes"
          className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
        />
      </label>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="attendanceEntryEnabled" defaultChecked className="h-4 w-4" />
          Use for attendance
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="financeEntryEnabled" defaultChecked className="h-4 w-4" />
          Use for finance
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4" />
          Active schedule
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-4 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
      >
        {loading ? "Creating..." : "Create service schedule"}
      </button>
    </form>
  );
}
