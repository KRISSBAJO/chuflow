"use client";
import { savedToastId } from "@/lib/action-feedback";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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

function getScheduleServiceTypeId(
  value: ServiceScheduleSummary["serviceTypeId"],
) {
  return typeof value === "string" ? value : value?._id;
}

export function OfferingEntryForm({
  defaultBranchId,
  branches,
  offeringTypes,
  serviceTypes,
  serviceSchedules,
  accounts,
  submitPath = "/finance/offerings",
  onSuccess,
}: {
  defaultBranchId?: string;
  branches: Pick<BranchSummary, "_id" | "name">[];
  offeringTypes: OfferingTypeSummary[];
  serviceTypes: ServiceTypeSummary[];
  serviceSchedules: ServiceScheduleSummary[];
  accounts: FinanceAccountSummary[];
  submitPath?: string;
  onSuccess?: () => void;
}) {
  const t = useTranslations("admin.offeringForm");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const defaultBranchName = branches.find(
    (branch) => branch._id === defaultBranchId,
  )?.name;

  const availableServiceTypes = useMemo(
    () =>
      serviceTypes.filter(
        (serviceType) =>
          (!defaultBranchId ||
            getBranchId(serviceType.branchId) === defaultBranchId) &&
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
    availableSchedules.find(
      (schedule) => schedule._id === selectedScheduleId,
    ) || null;

  async function handleSubmit(formData: FormData) {
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}${submitPath}`, {
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
        throw new Error(result.message || t("recordError"));
      }

      toast.success(t("recordedTitle"), {
        id: savedToastId(result),
        description: t("recordedDescription"),
      });
      if (onSuccess) onSuccess();
      else
        router.push(
          createdHref("/finance?tab=offerings", result, t("entityName")),
        );
      router.refresh();
    } catch (error) {
      toast.error(t("notRecordedTitle"), {
        description: error instanceof Error ? error.message : t("recordError"),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="app-rise p-6 sm:p-7">
      <CardHeader
        label={t("label")}
        title={t("title")}
        description={t("description")}
      />

      <div className="mt-6 flex items-center gap-3 rounded-2xl bg-[#f6f5f1] px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#8a8780] shadow-[0_1px_2px_rgba(17,17,17,0.06)]">
          <Icon name="branches" className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] text-[#8a8780]">{t("branch")}</p>
          <p className="truncate text-[14px] font-medium text-[#111111]">
            {defaultBranchName || t("currentBranch")}
          </p>
        </div>
      </div>

      <form action={handleSubmit} className="mt-5 grid gap-4">
        <Field label={t("serviceDate")} required>
          <input
            name="serviceDate"
            type="datetime-local"
            className="ui-input"
            required
          />
        </Field>

        <Field label={t("serviceSchedule")} hint={t("scheduleHint")}>
          <select
            value={selectedScheduleId}
            onChange={(event) => setSelectedScheduleId(event.target.value)}
            className="ui-input"
          >
            <option value="">{t("noSavedSchedule")}</option>
            {availableSchedules.map((schedule) => (
              <option key={schedule._id} value={schedule._id}>
                {schedule.name} · {schedule.dayOfWeek} · {schedule.startTime}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("serviceType")} required={!selectedSchedule}>
          {selectedSchedule ? (
            <div className="flex min-h-[40px] items-center rounded-xl bg-[#f6f5f1] px-3 text-[14px] text-[#55534e]">
              {selectedSchedule.serviceTypeLabel}
            </div>
          ) : (
            <select name="serviceTypeId" className="ui-input" required>
              <option value="">{t("selectServiceType")}</option>
              {availableServiceTypes.map((serviceType) => (
                <option key={serviceType._id} value={serviceType._id}>
                  {serviceType.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("offeringType")} required>
            <select name="offeringTypeId" className="ui-input" required>
              <option value="">{t("selectOfferingType")}</option>
              {offeringTypes
                .filter((type) => type.isActive)
                .map((offeringType) => (
                  <option key={offeringType._id} value={offeringType._id}>
                    {offeringType.name}
                  </option>
                ))}
            </select>
          </Field>

          <Field label={t("amountUsd")} required>
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

        <Field label={t("accountOrFund")}>
          <select name="accountId" className="ui-input">
            <option value="">{t("useDefaultFromType")}</option>
            {accounts
              .filter((account) => account.isActive)
              .map((account) => (
                <option key={account._id} value={account._id}>
                  {account.name}
                </option>
              ))}
          </select>
        </Field>

        <Field label={t("notes")}>
          <textarea
            name="notes"
            placeholder={t("notesPlaceholder")}
            className="ui-input"
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button
            type="submit"
            disabled={loading || availableServiceTypes.length === 0}
          >
            {loading ? t("recording") : t("record")}
          </Button>
          {availableServiceTypes.length === 0 ? (
            <p className="text-[13px] text-[#8a8780]">
              {t("addServiceTypeFirst")}
            </p>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
