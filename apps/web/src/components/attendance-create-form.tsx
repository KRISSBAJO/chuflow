"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { API_URL } from "@/lib/api";
import { Button, Field } from "@/components/ui/ui";
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

function getScheduleServiceTypeId(
  value: ServiceScheduleSummary["serviceTypeId"],
) {
  return typeof value === "string" ? value : value?._id;
}

export function AttendanceCreateForm({
  branches,
  serviceTypes,
  serviceSchedules,
  defaultBranchId,
  record,
  onSuccess,
  returnHref,
  submitPath,
  lockBranch = false,
}: {
  branches: Pick<BranchSummary, "_id" | "name">[];
  serviceTypes: ServiceTypeSummary[];
  serviceSchedules: ServiceScheduleSummary[];
  defaultBranchId?: string;
  record?: AttendanceItem;
  onSuccess?: () => void;
  returnHref?: string;
  submitPath?: string;
  lockBranch?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("services.attendance.form");
  const [loading, setLoading] = useState(false);
  const mode = record ? "edit" : "create";
  const initialBranchId =
    getAttendanceBranchId(record?.branchId) ||
    defaultBranchId ||
    branches[0]?._id ||
    "";
  const [selectedBranchId, setSelectedBranchId] = useState(initialBranchId);
  const [scheduleChoice, setScheduleChoice] = useState(
    record?.serviceScheduleId?._id || "",
  );
  const defaultBranchName = branches.find(
    (branch) => branch._id === initialBranchId,
  )?.name;

  const filteredServiceTypes = useMemo(
    () =>
      serviceTypes.filter((serviceType) =>
        selectedBranchId
          ? getBranchId(serviceType.branchId) === selectedBranchId
          : true,
      ),
    [selectedBranchId, serviceTypes],
  );
  const filteredServiceSchedules = useMemo(
    () =>
      serviceSchedules.filter((schedule) => {
        if (!schedule.isActive || !schedule.attendanceEntryEnabled) {
          return false;
        }

        if (
          selectedBranchId &&
          getScheduleBranchId(schedule.branchId) !== selectedBranchId
        ) {
          return false;
        }

        return true;
      }),
    [selectedBranchId, serviceSchedules],
  );
  // A schedule chosen under another branch is simply ignored once the branch changes.
  const selectedSchedule =
    filteredServiceSchedules.find(
      (schedule) => schedule._id === scheduleChoice,
    ) || null;
  const selectedScheduleId = selectedSchedule?._id ?? "";

  async function handleSubmit(formData: FormData) {
    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}${submitPath ?? `/attendance${record ? `/${record._id}` : ""}`}`,
        {
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
            holySpiritBaptismCount: Number(
              formData.get("holySpiritBaptismCount") || 0,
            ),
          }),
        },
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || t("recordFailed"));
      }

      toast.success(record ? t("toastUpdated") : t("toastSaved"), {
        description: record ? t("toastUpdatedBody") : t("toastSavedBody"),
      });
      if (returnHref) router.push(returnHref);
      router.refresh();
      onSuccess?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("recordFailed");
      toast.error(record ? t("toastUpdateFailed") : t("toastSaveFailed"), {
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit}>
      <div>
        <h3 className="lp-heading text-[18px]">
          {mode === "edit" ? t("editTitle") : t("createTitle")}
        </h3>
        <p className="mt-1 text-[14px] leading-[1.6] text-[#6b6b6b]">
          {mode === "edit" ? t("editDescription") : t("createDescription")}
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {branches.length > 0 && !lockBranch ? (
          <Field label={t("branch")} required>
            <select
              name="branchId"
              value={selectedBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              className="ui-input"
              required
            >
              <option value={initialBranchId || ""}>
                {defaultBranchName || t("selectBranch")}
              </option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label={t("branch")}>
            <input
              type="hidden"
              name="branchId"
              value={initialBranchId ?? ""}
            />
            <input
              value={defaultBranchName || t("currentBranchScope")}
              readOnly
              disabled
              className="ui-input"
            />
          </Field>
        )}

        <Field label={t("dayOfService")} required>
          <input
            name="serviceDate"
            type="datetime-local"
            defaultValue={toDateTimeLocal(record?.serviceDate)}
            className="ui-input"
            required
          />
        </Field>

        <Field label={t("serviceSchedule")} hint={t("serviceScheduleHint")}>
          <select
            value={selectedScheduleId}
            onChange={(event) => setScheduleChoice(event.target.value)}
            className="ui-input"
          >
            <option value="">{t("noSavedSchedule")}</option>
            {filteredServiceSchedules.map((schedule) => (
              <option key={schedule._id} value={schedule._id}>
                {schedule.name} Â· {schedule.dayOfWeek} Â· {schedule.startTime}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label={t("serviceType")}
          required={!selectedSchedule}
          hint={
            selectedSchedule
              ? t("serviceTypeFromSchedule")
              : t("serviceTypeHint")
          }
        >
          <select
            name="serviceTypeId"
            defaultValue={
              record?.serviceTypeId?._id ||
              getScheduleServiceTypeId(selectedSchedule?.serviceTypeId) ||
              ""
            }
            disabled={!!selectedSchedule}
            className="ui-input"
            required={!selectedSchedule}
          >
            <option value="">{t("selectServiceType")}</option>
            {filteredServiceTypes.map((serviceType) => (
              <option key={serviceType._id} value={serviceType._id}>
                {serviceType.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label={t("serviceName")}
          className="md:col-span-2"
          hint={
            selectedSchedule
              ? t("scheduleHint", {
                  name: selectedSchedule.name,
                  time: selectedSchedule.startTime,
                  timezone: selectedSchedule.timezone,
                })
              : undefined
          }
        >
          <input
            name="serviceName"
            placeholder={t("serviceNamePlaceholder")}
            defaultValue={record?.serviceName || selectedSchedule?.name || ""}
            className="ui-input"
          />
        </Field>
      </div>

      <div className="mt-5 rounded-2xl bg-[#f6f5f1] p-4 sm:p-5">
        <p className="text-[13px] font-medium text-[#6b6b6b]">{t("totals")}</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("totalMen")} required>
            <input
              name="menCount"
              type="number"
              min="0"
              defaultValue={String(record?.menCount ?? 0)}
              className="ui-input tabular-nums"
              required
            />
          </Field>
          <Field label={t("totalWomen")} required>
            <input
              name="womenCount"
              type="number"
              min="0"
              defaultValue={String(record?.womenCount ?? 0)}
              className="ui-input tabular-nums"
              required
            />
          </Field>
          <Field label={t("totalChildren")} required>
            <input
              name="childrenCount"
              type="number"
              min="0"
              defaultValue={String(record?.childrenCount ?? 0)}
              className="ui-input tabular-nums"
              required
            />
          </Field>
          <Field label={t("totalAdults")} required>
            <input
              name="adultsCount"
              type="number"
              min="0"
              defaultValue={String(record?.adultsCount ?? 0)}
              className="ui-input tabular-nums"
              required
            />
          </Field>
          <Field label={t("firstTimers")} required>
            <input
              name="firstTimersCount"
              type="number"
              min="0"
              defaultValue={String(record?.firstTimersCount ?? 0)}
              className="ui-input tabular-nums"
              required
            />
          </Field>
          <Field label={t("newConverts")} required>
            <input
              name="newConvertsCount"
              type="number"
              min="0"
              defaultValue={String(record?.newConvertsCount ?? 0)}
              className="ui-input tabular-nums"
              required
            />
          </Field>
          <Field label={t("holySpiritBaptism")}>
            <input
              name="holySpiritBaptismCount"
              type="number"
              min="0"
              defaultValue={String(record?.holySpiritBaptismCount ?? 0)}
              className="ui-input tabular-nums"
            />
          </Field>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? t("saving") : mode === "edit" ? t("update") : t("save")}
        </Button>
      </div>
    </form>
  );
}
