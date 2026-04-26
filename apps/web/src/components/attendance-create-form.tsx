"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import type {
  AttendanceItem,
  BranchSummary,
  ServiceScheduleSummary,
  ServiceTypeSummary,
} from "@/lib/types";

function getTodayDateTimeLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  const hours = `${now.getHours()}`.padStart(2, "0");
  const minutes = `${now.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toDateTimeLocal(value?: string) {
  if (!value) {
    return getTodayDateTimeLocal();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return getTodayDateTimeLocal();
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getBranchId(value: ServiceTypeSummary["branchId"]) {
  return typeof value === "string" ? value : value?._id;
}

function getAttendanceBranchId(value: AttendanceItem["branchId"]) {
  return typeof value === "string" ? value : value?._id;
}

function getScheduleBranchId(value: ServiceScheduleSummary["branchId"]) {
  return typeof value === "string" ? value : value?._id;
}

function getScheduleServiceTypeId(value: ServiceScheduleSummary["serviceTypeId"]) {
  return typeof value === "string" ? value : value?._id;
}

export function AttendanceCreateForm({
  branches,
  serviceTypes,
  serviceSchedules,
  defaultBranchId,
  record,
  onSuccess,
}: {
  branches: BranchSummary[];
  serviceTypes: ServiceTypeSummary[];
  serviceSchedules: ServiceScheduleSummary[];
  defaultBranchId?: string;
  record?: AttendanceItem;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const mode = record ? "edit" : "create";
  const initialBranchId =
    getAttendanceBranchId(record?.branchId) || defaultBranchId || branches[0]?._id || "";
  const [selectedBranchId, setSelectedBranchId] = useState(
    initialBranchId,
  );
  const [selectedScheduleId, setSelectedScheduleId] = useState(
    record?.serviceScheduleId?._id || "",
  );
  const defaultBranchName = branches.find((branch) => branch._id === initialBranchId)?.name;

  const filteredServiceTypes = useMemo(
    () =>
      serviceTypes.filter((serviceType) =>
        selectedBranchId ? getBranchId(serviceType.branchId) === selectedBranchId : true,
      ),
    [selectedBranchId, serviceTypes],
  );
  const filteredServiceSchedules = useMemo(
    () =>
      serviceSchedules.filter((schedule) => {
        if (!schedule.isActive || !schedule.attendanceEntryEnabled) {
          return false;
        }

        if (selectedBranchId && getScheduleBranchId(schedule.branchId) !== selectedBranchId) {
          return false;
        }

        return true;
      }),
    [selectedBranchId, serviceSchedules],
  );
  const selectedSchedule =
    filteredServiceSchedules.find((schedule) => schedule._id === selectedScheduleId) || null;

  useEffect(() => {
    if (
      selectedScheduleId &&
      !filteredServiceSchedules.some((schedule) => schedule._id === selectedScheduleId)
    ) {
      setSelectedScheduleId("");
    }
  }, [filteredServiceSchedules, selectedScheduleId]);

  async function handleSubmit(formData: FormData) {
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/attendance${record ? `/${record._id}` : ""}`, {
        method: record ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          branchId: formData.get("branchId") || initialBranchId,
          serviceDate: formData.get("serviceDate"),
          serviceScheduleId: selectedScheduleId || undefined,
          serviceTypeId:
            formData.get("serviceTypeId") ||
            getScheduleServiceTypeId(selectedSchedule?.serviceTypeId) ||
            undefined,
          serviceName: formData.get("serviceName") || undefined,
          entryMode: "summary",
          personType: "summary",
          menCount: Number(formData.get("menCount") || 0),
          womenCount: Number(formData.get("womenCount") || 0),
          childrenCount: Number(formData.get("childrenCount") || 0),
          adultsCount: Number(formData.get("adultsCount") || 0),
          firstTimersCount: Number(formData.get("firstTimersCount") || 0),
          newConvertsCount: Number(formData.get("newConvertsCount") || 0),
          holySpiritBaptismCount: Number(formData.get("holySpiritBaptismCount") || 0),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to record attendance");
      }

      toast.success(record ? "Attendance summary updated" : "Attendance summary saved", {
        description: record
          ? "The service totals have been updated successfully."
          : "The service totals have been recorded for this branch.",
      });
      router.refresh();
      onSuccess?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to record attendance";
      toast.error(record ? "Attendance update failed" : "Attendance summary failed", {
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="rounded-[28px] bg-white p-6">
      <div className="flex flex-col gap-2">
        <h3 className="text-xl font-semibold text-slate-950">
          {mode === "edit" ? "Edit service attendance summary" : "Record service attendance summary"}
        </h3>
        <p className="text-sm leading-6 text-slate-500">
          {mode === "edit"
            ? "Update the branch, service metadata, and attendance totals for this summary."
            : "Use service totals here: men, women, children, adults, first timers, and new converts."}
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {branches.length > 0 ? (
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Branch</span>
            <select
              name="branchId"
              value={selectedBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              required
            >
              <option value={initialBranchId || ""}>{defaultBranchName || "Select branch"}</option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <input type="hidden" name="branchId" value={initialBranchId ?? ""} />
            <input
              value="Current branch scope"
              readOnly
              className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500 outline-none"
            />
          </>
        )}

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Day of service</span>
          <input
            name="serviceDate"
            type="datetime-local"
            defaultValue={toDateTimeLocal(record?.serviceDate)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Service schedule</span>
          <select
            value={selectedScheduleId}
            onChange={(event) => setSelectedScheduleId(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          >
            <option value="">No saved schedule</option>
            {filteredServiceSchedules.map((schedule) => (
              <option key={schedule._id} value={schedule._id}>
                {schedule.name} · {schedule.dayOfWeek} · {schedule.startTime}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            Choose a real branch service when this summary belongs to a scheduled gathering.
          </p>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Service type</span>
          <select
            name="serviceTypeId"
            defaultValue={
              record?.serviceTypeId?._id ||
              getScheduleServiceTypeId(selectedSchedule?.serviceTypeId) ||
              ""
            }
            disabled={!!selectedSchedule}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required={!selectedSchedule}
          >
            <option value="">Select service type</option>
            {filteredServiceTypes.map((serviceType) => (
              <option key={serviceType._id} value={serviceType._id}>
                {serviceType.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            {selectedSchedule
              ? "This service type now comes from the selected branch schedule."
              : "Managed service types replace free-text entries like `sunday_service`."}
          </p>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Service name</span>
          <input
            name="serviceName"
            placeholder="Sunday worship, Miracle service, Midweek communion..."
            defaultValue={record?.serviceName || selectedSchedule?.name || ""}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />
          {selectedSchedule ? (
            <p className="text-xs text-slate-500">
              Schedule: {selectedSchedule.name} · {selectedSchedule.startTime} ·{" "}
              {selectedSchedule.timezone}
            </p>
          ) : null}
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Total men</span>
          <input
            name="menCount"
            type="number"
            min="0"
            defaultValue={String(record?.menCount ?? 0)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Total women</span>
          <input
            name="womenCount"
            type="number"
            min="0"
            defaultValue={String(record?.womenCount ?? 0)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Total children</span>
          <input
            name="childrenCount"
            type="number"
            min="0"
            defaultValue={String(record?.childrenCount ?? 0)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Total adults</span>
          <input
            name="adultsCount"
            type="number"
            min="0"
            defaultValue={String(record?.adultsCount ?? 0)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">First timers</span>
          <input
            name="firstTimersCount"
            type="number"
            min="0"
            defaultValue={String(record?.firstTimersCount ?? 0)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">New converts</span>
          <input
            name="newConvertsCount"
            type="number"
            min="0"
            defaultValue={String(record?.newConvertsCount ?? 0)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required
          />
        </label>
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-slate-700">
            Baptism of the Holy Spirit
          </span>
          <input
            name="holySpiritBaptismCount"
            type="number"
            min="0"
            defaultValue={String(record?.holySpiritBaptismCount ?? 0)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-5 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
      >
        {loading ? "Saving..." : mode === "edit" ? "Update attendance summary" : "Save attendance summary"}
      </button>
    </form>
  );
}
