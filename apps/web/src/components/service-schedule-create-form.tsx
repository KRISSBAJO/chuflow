"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { useMemberFormLabels } from "@/lib/member-form-options";
import { isBranchScopedRole } from "@/lib/permissions";
import type { BranchSummary, ServiceTypeSummary } from "@/lib/types";
import { Button, Field } from "@/components/ui/ui";

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
  const t = useTranslations("org.serviceSchedules");
  const tCommon = useTranslations("common");
  const labels = useMemberFormLabels();
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
        throw new Error(result.message || t("createError"));
      }

      toast.success(t("createdTitle"), {
        description: t("createdBody"),
      });
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("createError");
      toast.error(t("createFailed"), {
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit}>
      <div>
        <h3 className="lp-heading text-[18px]">{t("heading")}</h3>
        <p className="mt-1 text-[14px] leading-[1.6] text-[#6b6b6b]">
          {t("intro")}
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {!isBranchScopedRole(currentUserRole) ? (
          <Field label={tCommon("branch")} required>
            <select
              name="branchId"
              value={selectedBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              className="ui-input"
              required
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
          <input type="hidden" name="branchId" value={defaultBranchId ?? ""} />
        )}

        <Field label={t("serviceType")} required>
          <select name="serviceTypeId" className="ui-input" required>
            <option value="">{t("selectServiceType")}</option>
            {filteredServiceTypes.map((serviceType) => (
              <option key={serviceType._id} value={serviceType._id}>
                {serviceType.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("scheduleName")} required>
          <input
            name="name"
            placeholder={t("scheduleNamePlaceholder")}
            className="ui-input"
            required
          />
        </Field>

        <Field label={t("dayOfWeek")} required>
          <select name="dayOfWeek" defaultValue="sunday" className="ui-input" required>
            {weekdayOptions.map((day) => (
              <option key={day} value={day}>
                {labels.weekday(day)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("startTime")} required>
          <input name="startTime" type="time" className="ui-input" required />
        </Field>

        <Field label={t("endTime")}>
          <input name="endTime" type="time" className="ui-input" />
        </Field>

        <Field label={t("timezone")} className="md:col-span-2">
          <input name="timezone" defaultValue="America/Chicago" placeholder="America/Chicago" className="ui-input" />
        </Field>
      </div>

      <Field label={t("locationNotes")} className="mt-4">
        <textarea name="locationNotes" placeholder={t("locationNotesPlaceholder")} className="ui-input" />
      </Field>

      <div className="mt-4 grid gap-2 rounded-2xl bg-[#f6f5f1] p-4 md:grid-cols-3">
        <label className="flex items-center gap-2 text-[14px] text-[#55534e]">
          <input type="checkbox" name="attendanceEntryEnabled" defaultChecked className="h-4 w-4 accent-[#111111]" />
          {t("useForAttendance")}
        </label>
        <label className="flex items-center gap-2 text-[14px] text-[#55534e]">
          <input type="checkbox" name="financeEntryEnabled" defaultChecked className="h-4 w-4 accent-[#111111]" />
          {t("useForFinance")}
        </label>
        <label className="flex items-center gap-2 text-[14px] text-[#55534e]">
          <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4 accent-[#111111]" />
          {t("activeSchedule")}
        </label>
      </div>

      <Button type="submit" disabled={loading} className="mt-5">
        {loading ? t("creating") : t("create")}
      </Button>
    </form>
  );
}
