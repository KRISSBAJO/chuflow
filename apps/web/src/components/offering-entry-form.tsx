"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import type {
  BranchSummary,
  FinanceAccountSummary,
  OfferingTypeSummary,
  ServiceScheduleSummary,
  ServiceTypeSummary,
} from "@/lib/types";

function getBranchId(value: ServiceTypeSummary["branchId"]) {
  return typeof value === "string" ? value : value?._id;
}

function getScheduleBranchId(value: ServiceScheduleSummary["branchId"]) {
  return typeof value === "string" ? value : value?._id;
}

function getScheduleServiceTypeId(value: ServiceScheduleSummary["serviceTypeId"]) {
  return typeof value === "string" ? value : value?._id;
}

export function OfferingEntryForm({
  defaultBranchId,
  branches,
  offeringTypes,
  serviceTypes,
  serviceSchedules,
  accounts,
}: {
  defaultBranchId?: string;
  branches: BranchSummary[];
  offeringTypes: OfferingTypeSummary[];
  serviceTypes: ServiceTypeSummary[];
  serviceSchedules: ServiceScheduleSummary[];
  accounts: FinanceAccountSummary[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const defaultBranchName = branches.find((branch) => branch._id === defaultBranchId)?.name;

  const availableServiceTypes = useMemo(
    () =>
      serviceTypes.filter(
        (serviceType) =>
          (!defaultBranchId || getBranchId(serviceType.branchId) === defaultBranchId) &&
          serviceType.isActive,
      ),
    [defaultBranchId, serviceTypes],
  );
  const availableSchedules = useMemo(
    () =>
      serviceSchedules.filter((schedule) => {
        if (!schedule.isActive || !schedule.financeEntryEnabled) {
          return false;
        }

        if (!defaultBranchId) {
          return true;
        }

        return getScheduleBranchId(schedule.branchId) === defaultBranchId;
      }),
    [defaultBranchId, serviceSchedules],
  );
  const selectedSchedule =
    availableSchedules.find((schedule) => schedule._id === selectedScheduleId) || null;

  async function handleSubmit(formData: FormData) {
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/finance/offerings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          serviceDate: formData.get("serviceDate"),
          serviceScheduleId: selectedScheduleId || undefined,
          serviceTypeId:
            getScheduleServiceTypeId(selectedSchedule?.serviceTypeId) ||
            formData.get("serviceTypeId") ||
            undefined,
          offeringTypeId: formData.get("offeringTypeId"),
          accountId: formData.get("accountId") || undefined,
          amount: Number(formData.get("amount")),
          notes: formData.get("notes") || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to record offering");
      }

      toast.success("Offering recorded", {
        description:
          "This entry is now visible in branch, district, national, and overall finance oversight.",
      });
      router.refresh();
    } catch (error) {
      toast.error("Offering not recorded", {
        description:
          error instanceof Error ? error.message : "Unable to record offering",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="rounded-[24px] bg-white p-5">
      <div className="flex flex-col gap-2">
        <p className="eyebrow">Record offering</p>
        <h3 className="text-lg font-semibold text-slate-950">Branch finance entry</h3>
        <p className="text-sm leading-6 text-slate-500">
          Ushers and pastoral branch leads can enter offerings. Direct-entry edits stay open for 24 hours.
        </p>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Branch: <span className="font-semibold text-slate-900">{defaultBranchName || "Current branch"}</span>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Service date</span>
          <input
            name="serviceDate"
            type="datetime-local"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Service schedule</span>
          <select
            value={selectedScheduleId}
            onChange={(event) => setSelectedScheduleId(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          >
            <option value="">No saved schedule</option>
            {availableSchedules.map((schedule) => (
              <option key={schedule._id} value={schedule._id}>
                {schedule.name} · {schedule.dayOfWeek} · {schedule.startTime}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Service type</span>
          {selectedSchedule ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-600">
              {selectedSchedule.serviceTypeLabel}
            </div>
          ) : (
            <select
              name="serviceTypeId"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              required
            >
              <option value="">Select service type</option>
              {availableServiceTypes.map((serviceType) => (
                <option key={serviceType._id} value={serviceType._id}>
                  {serviceType.name}
                </option>
              ))}
            </select>
          )}
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Offering type</span>
          <select
            name="offeringTypeId"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required
          >
            <option value="">Select offering type</option>
            {offeringTypes.filter((type) => type.isActive).map((offeringType) => (
              <option key={offeringType._id} value={offeringType._id}>
                {offeringType.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Account / fund</span>
          <select
            name="accountId"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          >
            <option value="">Use default account from offering type</option>
            {accounts
              .filter((account) => account.isActive)
              .map((account) => (
                <option key={account._id} value={account._id}>
                  {account.name}
                </option>
              ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Amount (USD)</span>
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Notes</span>
          <textarea
            name="notes"
            placeholder="Optional note for the service, correction, or special collection"
            className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={loading || availableServiceTypes.length === 0}
        className="mt-4 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
      >
        {loading ? "Recording..." : "Record offering"}
      </button>
    </form>
  );
}
