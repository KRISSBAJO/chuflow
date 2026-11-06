"use client";
import { ExportTableButtons } from "@/components/table-export";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { useMemberFormLabels } from "@/lib/member-form-options";
import { isBranchScopedRole } from "@/lib/permissions";
import type {
  BranchSummary,
  ServiceScheduleSummary,
  ServiceTypeSummary,
} from "@/lib/types";
import { Icon } from "@/components/app/icons";
import {
  Badge,
  Button,
  EmptyState,
  Field,
} from "@/components/ui/ui";

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
  const t = useTranslations("org.serviceSchedules");
  const tCommon = useTranslations("common");
  const tStatuses = useTranslations("statuses");
  const labels = useMemberFormLabels();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleSubmit(scheduleId: string, formData: FormData) {
    setLoadingId(scheduleId);

    try {
      const response = await fetch(
        `${API_URL}/service-schedules/${scheduleId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            branchId:
              (formData.get(`branchId-${scheduleId}`) as string) || undefined,
            serviceTypeId: formData.get(`serviceTypeId-${scheduleId}`),
            name: formData.get(`name-${scheduleId}`),
            dayOfWeek: formData.get(`dayOfWeek-${scheduleId}`),
            startTime: formData.get(`startTime-${scheduleId}`),
            endTime: formData.get(`endTime-${scheduleId}`) || undefined,
            timezone: formData.get(`timezone-${scheduleId}`) || undefined,
            locationNotes:
              formData.get(`locationNotes-${scheduleId}`) || undefined,
            attendanceEntryEnabled:
              formData.get(`attendanceEntryEnabled-${scheduleId}`) === "on",
            financeEntryEnabled:
              formData.get(`financeEntryEnabled-${scheduleId}`) === "on",
            isActive: formData.get(`isActive-${scheduleId}`) === "on",
          }),
        },
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || t("updateError"));
      }

      toast.success(t("updatedTitle"), {
        description: t("updatedBody"),
      });
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("updateError");
      toast.error(t("updateFailed"), {
        description: message,
      });
    } finally {
      setLoadingId(null);
    }
  }

  if (schedules.length === 0) {
    return (
      <EmptyState icon="clock" title={t("emptyTitle")}>
        {t("emptyBody")}
      </EmptyState>
    );
  }

  return (
    <div className="space-y-2">
      <ExportTableButtons resource="service-schedules" rows={schedules} />
      {schedules.map((schedule) => {
        const branchId = getBranchId(schedule.branchId) || "";
        const filteredServiceTypes = serviceTypes.filter((serviceType) => {
          if (!serviceType.isActive) {
            return false;
          }

          return (
            !branchId || getServiceTypeId(serviceType.branchId) === branchId
          );
        });

        return (
          <details
            key={schedule._id}
            className="group rounded-2xl border border-black/[0.06] bg-white transition-colors open:border-black/[0.12] hover:border-black/[0.12]"
          >
            <summary className="flex cursor-pointer list-none flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center lg:justify-between [&::-webkit-details-marker]:hidden">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-[#111111]">
                  {schedule.name}
                </p>
                <p className="mt-0.5 text-[12px] text-[#8a8780]">
                  {getBranchName(schedule.branchId) || t("branchScope")} ·{" "}
                  {schedule.serviceTypeLabel} ·{" "}
                  {labels.weekday(schedule.dayOfWeek)} · {schedule.startTime}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={schedule.isActive ? "success" : "neutral"} dot>
                  {schedule.isActive ? tStatuses("active") : tStatuses("inactive")}
                </Badge>
                <Badge
                  tone={schedule.attendanceEntryEnabled ? "info" : "neutral"}
                >
                  {t("attendance")}
                </Badge>
                <Badge
                  tone={schedule.financeEntryEnabled ? "warning" : "neutral"}
                >
                  {t("finance")}
                </Badge>
                <Icon
                  name="chevronDown"
                  className="ml-1 h-4 w-4 shrink-0 text-[#8a8780] transition-transform group-open:rotate-180"
                />
              </div>
            </summary>
            <div className="border-t border-black/[0.06] px-4 py-4">
              <form
                action={(formData) => handleSubmit(schedule._id, formData)}
                className="grid gap-4 md:grid-cols-2"
              >
                {!isBranchScopedRole(currentUserRole) ? (
                  <Field label={tCommon("branch")}>
                    <select
                      name={`branchId-${schedule._id}`}
                      defaultValue={branchId}
                      className="ui-input"
                    >
                      <option value="">{tCommon("selectBranch")}</option>
                      {branches.map((branch) => (
                        <option key={branch._id} value={branch._id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <input
                    type="hidden"
                    name={`branchId-${schedule._id}`}
                    value={branchId}
                  />
                )}

                <Field label={t("serviceType")}>
                  <select
                    name={`serviceTypeId-${schedule._id}`}
                    defaultValue={
                      typeof schedule.serviceTypeId === "string"
                        ? schedule.serviceTypeId
                        : schedule.serviceTypeId?._id || ""
                    }
                    className="ui-input"
                  >
                    {filteredServiceTypes.map((serviceType) => (
                      <option key={serviceType._id} value={serviceType._id}>
                        {serviceType.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label={t("scheduleName")}>
                  <input
                    name={`name-${schedule._id}`}
                    defaultValue={schedule.name}
                    className="ui-input"
                  />
                </Field>

                <Field label={t("dayOfWeek")}>
                  <select
                    name={`dayOfWeek-${schedule._id}`}
                    defaultValue={schedule.dayOfWeek}
                    className="ui-input"
                  >
                    {weekdayOptions.map((day) => (
                      <option key={day} value={day}>
                        {labels.weekday(day)}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label={t("startTime")}>
                  <input
                    name={`startTime-${schedule._id}`}
                    type="time"
                    defaultValue={schedule.startTime}
                    className="ui-input"
                  />
                </Field>

                <Field label={t("endTime")}>
                  <input
                    name={`endTime-${schedule._id}`}
                    type="time"
                    defaultValue={schedule.endTime || ""}
                    className="ui-input"
                  />
                </Field>

                <Field label={t("timezone")} className="md:col-span-2">
                  <input
                    name={`timezone-${schedule._id}`}
                    defaultValue={schedule.timezone}
                    className="ui-input"
                  />
                </Field>

                <Field label={t("locationNotes")} className="md:col-span-2">
                  <textarea
                    name={`locationNotes-${schedule._id}`}
                    defaultValue={schedule.locationNotes || ""}
                    className="ui-input"
                  />
                </Field>

                <div className="grid gap-2 rounded-2xl bg-[#f6f5f1] p-4 md:col-span-2 md:grid-cols-3">
                  <label className="flex items-center gap-2 text-[14px] text-[#55534e]">
                    <input
                      type="checkbox"
                      name={`attendanceEntryEnabled-${schedule._id}`}
                      defaultChecked={schedule.attendanceEntryEnabled}
                      className="h-4 w-4 accent-[#111111]"
                    />
                    {t("useForAttendance")}
                  </label>
                  <label className="flex items-center gap-2 text-[14px] text-[#55534e]">
                    <input
                      type="checkbox"
                      name={`financeEntryEnabled-${schedule._id}`}
                      defaultChecked={schedule.financeEntryEnabled}
                      className="h-4 w-4 accent-[#111111]"
                    />
                    {t("useForFinance")}
                  </label>
                  <label className="flex items-center gap-2 text-[14px] text-[#55534e]">
                    <input
                      type="checkbox"
                      name={`isActive-${schedule._id}`}
                      defaultChecked={schedule.isActive}
                      className="h-4 w-4 accent-[#111111]"
                    />
                    {t("activeSchedule")}
                  </label>
                </div>

                <div className="md:col-span-2">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={loadingId === schedule._id}
                  >
                    {loadingId === schedule._id
                      ? tCommon("saving")
                      : t("update")}
                  </Button>
                </div>
              </form>
            </div>
          </details>
        );
      })}
    </div>
  );
}
