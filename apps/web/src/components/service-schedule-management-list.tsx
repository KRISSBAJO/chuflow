"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { isBranchScopedRole } from "@/lib/permissions";
import type { BranchSummary, ServiceScheduleSummary, ServiceTypeSummary } from "@/lib/types";

const weekdayOptions = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function getBranchId(value: ServiceScheduleSummary["branchId"]) {
  return typeof value === "string" ? value : value?._id;
}

function getBranchName(value: ServiceScheduleSummary["branchId"]) {
  return typeof value === "string" ? value : value?.name;
}

function getServiceTypeId(value: ServiceTypeSummary["branchId"]) {
  return typeof value === "string" ? value : value?._id;
}

export function ServiceScheduleManagementList({
  schedules,
  branches,
  serviceTypes,
  currentUserRole,
}: {
  schedules: ServiceScheduleSummary[];
  branches: BranchSummary[];
  serviceTypes: ServiceTypeSummary[];
  currentUserRole: string;
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleSubmit(scheduleId: string, formData: FormData) {
    setLoadingId(scheduleId);

    try {
      const response = await fetch(`${API_URL}/service-schedules/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          branchId: (formData.get(`branchId-${scheduleId}`) as string) || undefined,
          serviceTypeId: formData.get(`serviceTypeId-${scheduleId}`),
          name: formData.get(`name-${scheduleId}`),
          dayOfWeek: formData.get(`dayOfWeek-${scheduleId}`),
          startTime: formData.get(`startTime-${scheduleId}`),
          endTime: formData.get(`endTime-${scheduleId}`) || undefined,
          timezone: formData.get(`timezone-${scheduleId}`) || undefined,
          locationNotes: formData.get(`locationNotes-${scheduleId}`) || undefined,
          attendanceEntryEnabled:
            formData.get(`attendanceEntryEnabled-${scheduleId}`) === "on",
          financeEntryEnabled:
            formData.get(`financeEntryEnabled-${scheduleId}`) === "on",
          isActive: formData.get(`isActive-${scheduleId}`) === "on",
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to update service schedule");
      }

      toast.success("Service schedule updated", {
        description:
          "Attendance and finance will use the updated branch service definition immediately.",
      });
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to update service schedule";
      toast.error("Service schedule update failed", {
        description: message,
      });
    } finally {
      setLoadingId(null);
    }
  }

  if (schedules.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-5 py-8 text-sm text-slate-500">
        No service schedules exist yet. Create one so branches can track multiple services cleanly.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {schedules.map((schedule) => {
        const branchId = getBranchId(schedule.branchId) || "";
        const filteredServiceTypes = serviceTypes.filter((serviceType) => {
          if (!serviceType.isActive) {
            return false;
          }

          return !branchId || getServiceTypeId(serviceType.branchId) === branchId;
        });

        return (
          <details key={schedule._id} className="rounded-[22px] border border-slate-200 bg-white">
            <summary className="cursor-pointer list-none px-4 py-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{schedule.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {getBranchName(schedule.branchId) || "Branch scope"} ·{" "}
                    {schedule.serviceTypeLabel} · {schedule.dayOfWeek} · {schedule.startTime}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span
                    className={`rounded-full px-2.5 py-1 ${
                      schedule.isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {schedule.isActive ? "active" : "inactive"}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 ${
                      schedule.attendanceEntryEnabled
                        ? "bg-sky-50 text-sky-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    attendance
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 ${
                      schedule.financeEntryEnabled
                        ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    finance
                  </span>
                </div>
              </div>
            </summary>
            <div className="border-t border-slate-200 px-4 py-4">
              <form
                action={(formData) => handleSubmit(schedule._id, formData)}
                className="grid gap-3 md:grid-cols-2"
              >
                {!isBranchScopedRole(currentUserRole) ? (
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Branch</span>
                    <select
                      name={`branchId-${schedule._id}`}
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
                  <input type="hidden" name={`branchId-${schedule._id}`} value={branchId} />
                )}

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Service type</span>
                  <select
                    name={`serviceTypeId-${schedule._id}`}
                    defaultValue={
                      typeof schedule.serviceTypeId === "string"
                        ? schedule.serviceTypeId
                        : schedule.serviceTypeId?._id || ""
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  >
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
                    name={`name-${schedule._id}`}
                    defaultValue={schedule.name}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Day of week</span>
                  <select
                    name={`dayOfWeek-${schedule._id}`}
                    defaultValue={schedule.dayOfWeek}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
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
                    name={`startTime-${schedule._id}`}
                    type="time"
                    defaultValue={schedule.startTime}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">End time</span>
                  <input
                    name={`endTime-${schedule._id}`}
                    type="time"
                    defaultValue={schedule.endTime || ""}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Timezone</span>
                  <input
                    name={`timezone-${schedule._id}`}
                    defaultValue={schedule.timezone}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Location notes</span>
                  <textarea
                    name={`locationNotes-${schedule._id}`}
                    defaultValue={schedule.locationNotes || ""}
                    className="min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  />
                </label>

                <div className="grid gap-2 md:col-span-2 md:grid-cols-3">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name={`attendanceEntryEnabled-${schedule._id}`}
                      defaultChecked={schedule.attendanceEntryEnabled}
                      className="h-4 w-4"
                    />
                    Use for attendance
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name={`financeEntryEnabled-${schedule._id}`}
                      defaultChecked={schedule.financeEntryEnabled}
                      className="h-4 w-4"
                    />
                    Use for finance
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name={`isActive-${schedule._id}`}
                      defaultChecked={schedule.isActive}
                      className="h-4 w-4"
                    />
                    Active schedule
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loadingId === schedule._id}
                  className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white md:w-fit"
                >
                  {loadingId === schedule._id ? "Saving..." : "Update service schedule"}
                </button>
              </form>
            </div>
          </details>
        );
      })}
    </div>
  );
}
