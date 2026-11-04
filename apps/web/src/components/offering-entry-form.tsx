"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createdHref } from "@/lib/directory";
import { toast } from "sonner";
import { Icon } from "@/components/app/icons";
import { Button, Card, CardHeader, Field } from "@/components/ui/ui";
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
      router.push(createdHref("/finance?tab=offerings", result, "Offering"));
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
    <Card className="app-rise p-6 sm:p-7">
      <CardHeader
        label="Record offering"
        title="New offering entry"
        description="Ushers and branch pastors can record offerings. Entries can be edited for 24 hours."
      />

      <div className="mt-6 flex items-center gap-3 rounded-2xl bg-[#f6f5f1] px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#8a8780] shadow-[0_1px_2px_rgba(17,17,17,0.06)]">
          <Icon name="branches" className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] text-[#8a8780]">Branch</p>
          <p className="truncate text-[14px] font-medium text-[#111111]">
            {defaultBranchName || "Current branch"}
          </p>
        </div>
      </div>

      <form action={handleSubmit} className="mt-5 grid gap-4">
        <Field label="Service date" required>
          <input name="serviceDate" type="datetime-local" className="ui-input" required />
        </Field>

        <Field label="Service schedule" hint="Pick a saved schedule to fill in the service type.">
          <select
            value={selectedScheduleId}
            onChange={(event) => setSelectedScheduleId(event.target.value)}
            className="ui-input"
          >
            <option value="">No saved schedule</option>
            {availableSchedules.map((schedule) => (
              <option key={schedule._id} value={schedule._id}>
                {schedule.name} · {schedule.dayOfWeek} · {schedule.startTime}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Service type" required={!selectedSchedule}>
          {selectedSchedule ? (
            <div className="flex min-h-[40px] items-center rounded-xl bg-[#f6f5f1] px-3 text-[14px] text-[#55534e]">
              {selectedSchedule.serviceTypeLabel}
            </div>
          ) : (
            <select name="serviceTypeId" className="ui-input" required>
              <option value="">Select service type</option>
              {availableServiceTypes.map((serviceType) => (
                <option key={serviceType._id} value={serviceType._id}>
                  {serviceType.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Offering type" required>
            <select name="offeringTypeId" className="ui-input" required>
              <option value="">Select offering type</option>
              {offeringTypes.filter((type) => type.isActive).map((offeringType) => (
                <option key={offeringType._id} value={offeringType._id}>
                  {offeringType.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Amount (USD)" required>
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              className="ui-input tabular-nums"
              required
            />
          </Field>
        </div>

        <Field label="Account or fund">
          <select name="accountId" className="ui-input">
            <option value="">Use default account from offering type</option>
            {accounts
              .filter((account) => account.isActive)
              .map((account) => (
                <option key={account._id} value={account._id}>
                  {account.name}
                </option>
              ))}
          </select>
        </Field>

        <Field label="Notes">
          <textarea
            name="notes"
            placeholder="Optional note for the service, a correction or a special collection"
            className="ui-input"
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button type="submit" disabled={loading || availableServiceTypes.length === 0}>
            {loading ? "Recording..." : "Record offering"}
          </Button>
          {availableServiceTypes.length === 0 ? (
            <p className="text-[13px] text-[#8a8780]">Add an active service type for this branch first.</p>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
