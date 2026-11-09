"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ReactNode, useMemo, useState } from "react";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { Badge, Button, Card, EmptyState, Field } from "@/components/ui/ui";
import { useRoleLabel } from "@/i18n/labels";
import type { BranchSettingsOverview, BranchSummary } from "@/lib/types";

const TIMEZONE_OPTIONS = [
  "America/Chicago",
  "America/New_York",
  "America/Denver",
  "America/Los_Angeles",
  "Africa/Lagos",
  "Europe/London",
];

const CURRENCY_OPTIONS = ["USD", "NGN", "GHS", "KES", "GBP"];

const APPROVAL_ROLE_OPTIONS = ["branch_admin", "resident_pastor", "associate_pastor", "follow_up"];

export function BranchSettingsForm({
  branches,
  selectedBranchId,
  overview,
  canSelectBranch,
}: {
  branches: BranchSummary[];
  selectedBranchId?: string;
  overview: BranchSettingsOverview | null;
  canSelectBranch: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("org.branchSettings");
  const tCommon = useTranslations("common");
  const roleLabel = useRoleLabel();
  const [loading, setLoading] = useState(false);
  const activeBranchId = selectedBranchId || overview?.branch._id || branches[0]?._id;

  const selectedApprovalRoles = useMemo(
    () => new Set(overview?.settings.attendanceApprovalRoles || []),
    [overview?.settings.attendanceApprovalRoles],
  );

  function handleBranchChange(nextBranchId: string) {
    const params = new URLSearchParams(window.location.search);
    if (nextBranchId) {
      params.set("branchId", nextBranchId);
    } else {
      params.delete("branchId");
    }
    router.replace(`/settings/branch-defaults${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
  }

  async function handleSubmit(formData: FormData) {
    if (!overview?.branch._id) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/settings/branches/${overview.branch._id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            timezone: formData.get("timezone"),
            currency: formData.get("currency"),
            locale: formData.get("locale"),
            defaultServiceDurationMinutes: Number(
              formData.get("defaultServiceDurationMinutes") ||
                overview.settings.defaultServiceDurationMinutes,
            ),
            attendanceApprovalRoles: formData.getAll("attendanceApprovalRoles"),
            publicGuestIntakeEnabled:
              formData.get("publicGuestIntakeEnabled") === "on",
            publicMemberIntakeEnabled:
              formData.get("publicMemberIntakeEnabled") === "on",
            publicAttendanceEntryEnabled:
              formData.get("publicAttendanceEntryEnabled") === "on",
            notifyOnMissingAttendance:
              formData.get("notifyOnMissingAttendance") === "on",
            notifyOnFollowUpBacklog:
              formData.get("notifyOnFollowUpBacklog") === "on",
            notifyOnFinanceApprovals:
              formData.get("notifyOnFinanceApprovals") === "on",
            dailySummaryEnabled:
              formData.get("dailySummaryEnabled") === "on",
            weeklyLeadershipDigestEnabled:
              formData.get("weeklyLeadershipDigestEnabled") === "on",
          }),
        },
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || t("saveError"));
      }

      toast.success(t("savedTitle"), {
        description: t("savedBody", { branch: overview.branch.name }),
      });
      router.refresh();
    } catch (error) {
      toast.error(t("saveFailed"), {
        description:
          error instanceof Error
            ? error.message
            : t("saveError"),
      });
    } finally {
      setLoading(false);
    }
  }


  return (
    <Card className="p-6 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        {overview ? (
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="lp-heading text-[18px]">{overview.branch.name}</p>
              {!overview.canEdit ? <Badge>{t("viewOnly")}</Badge> : null}
            </div>
            <p className="mt-0.5 text-[13px] text-[#6b6b6b]">
              {overview.branch.city}, {overview.branch.state} · {overview.branch.district} ·{" "}
              {overview.branch.oversightRegion}
            </p>
          </div>
        ) : (
          <div />
        )}

        {canSelectBranch && branches.length > 1 ? (
          <Field label={tCommon("branch")} className="w-full sm:w-64">
            <select
              value={activeBranchId}
              onChange={(event) => handleBranchChange(event.target.value)}
              className="ui-input"
            >
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>

      {overview ? (
        <form action={handleSubmit} className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("timezone")}>
              <select
                name="timezone"
                defaultValue={overview.settings.timezone}
                disabled={!overview.canEdit}
                className="ui-input"
              >
                {TIMEZONE_OPTIONS.map((timezone) => (
                  <option key={timezone} value={timezone}>
                    {timezone}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t("currency")}>
              <select
                name="currency"
                defaultValue={overview.settings.currency}
                disabled={!overview.canEdit}
                className="ui-input"
              >
                {CURRENCY_OPTIONS.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t("locale")}>
              <input
                name="locale"
                defaultValue={overview.settings.locale}
                disabled={!overview.canEdit}
                className="ui-input"
              />
            </Field>

            <Field label={t("defaultDuration")} hint={t("defaultDurationHint")}>
              <input
                type="number"
                min={30}
                max={600}
                name="defaultServiceDurationMinutes"
                defaultValue={overview.settings.defaultServiceDurationMinutes}
                disabled={!overview.canEdit}
                className="ui-input tabular-nums"
              />
            </Field>
          </div>

          <div>
            <p className="text-[13px] font-medium text-[#111111]">{t("approvalOwners")}</p>
            <p className="mt-0.5 text-[13px] text-[#6b6b6b]">{t("approvalOwnersHint")}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {APPROVAL_ROLE_OPTIONS.map((role) => (
                <label
                  key={role}
                  className="flex items-center gap-3 rounded-xl border border-black/[0.06] px-4 py-3 text-[14px] text-[#111111] transition-colors hover:bg-[#faf9f6]"
                >
                  <input
                    type="checkbox"
                    name="attendanceApprovalRoles"
                    value={role}
                    defaultChecked={selectedApprovalRoles.has(role)}
                    disabled={!overview.canEdit}
                    className="h-4 w-4 accent-[#111111]"
                  />
                  {roleLabel(role)}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[13px] font-medium text-[#111111]">{t("publicLinks")}</p>
            <p className="mt-0.5 text-[13px] text-[#6b6b6b]">{t("publicLinksHint")}</p>
            <div className="mt-3 divide-y divide-black/[0.05] rounded-2xl border border-black/[0.06]">
              <CheckRow
                name="publicGuestIntakeEnabled"
                defaultChecked={overview.settings.publicGuestIntakeEnabled}
                disabled={!overview.canEdit}
              >
                {t("publicGuestIntake")}
              </CheckRow>
              <CheckRow
                name="publicMemberIntakeEnabled"
                defaultChecked={overview.settings.publicMemberIntakeEnabled}
                disabled={!overview.canEdit}
              >
                {t("publicMemberIntake")}
              </CheckRow>
              <CheckRow
                name="publicAttendanceEntryEnabled"
                defaultChecked={overview.settings.publicAttendanceEntryEnabled}
                disabled={!overview.canEdit}
              >
                {t("publicAttendance")}
              </CheckRow>
            </div>
          </div>

          <div>
            <p className="text-[13px] font-medium text-[#111111]">{t("notifications")}</p>
            <p className="mt-0.5 text-[13px] text-[#6b6b6b]">
              {t("notificationsHint")}
            </p>
            <div className="mt-3 divide-y divide-black/[0.05] rounded-2xl border border-black/[0.06]">
              <CheckRow
                name="notifyOnMissingAttendance"
                defaultChecked={overview.settings.notifyOnMissingAttendance}
                disabled={!overview.canEdit}
              >
                {t("notifyMissingAttendance")}
              </CheckRow>
              <CheckRow
                name="notifyOnFollowUpBacklog"
                defaultChecked={overview.settings.notifyOnFollowUpBacklog}
                disabled={!overview.canEdit}
              >
                {t("notifyFollowUpBacklog")}
              </CheckRow>
              <CheckRow
                name="notifyOnFinanceApprovals"
                defaultChecked={overview.settings.notifyOnFinanceApprovals}
                disabled={!overview.canEdit}
              >
                {t("notifyFinanceApprovals")}
              </CheckRow>
              <CheckRow
                name="dailySummaryEnabled"
                defaultChecked={overview.settings.dailySummaryEnabled}
                disabled={!overview.canEdit}
              >
                {t("dailySummary")}
              </CheckRow>
              <CheckRow
                name="weeklyLeadershipDigestEnabled"
                defaultChecked={overview.settings.weeklyLeadershipDigestEnabled}
                disabled={!overview.canEdit}
              >
                {t("weeklyDigest")}
              </CheckRow>
            </div>
          </div>

          <div className="flex justify-end border-t border-black/[0.06] pt-5">
            {overview.canEdit ? (
              <Button type="submit" disabled={loading}>
                {loading ? tCommon("saving") : t("save")}
              </Button>
            ) : (
              <p className="text-[13px] text-[#6b6b6b]">
                {t("readOnly")}
              </p>
            )}
          </div>
        </form>
      ) : (
        <div className="mt-6">
          <EmptyState icon="branches" title={t("emptyTitle")}>
            {t("emptyBody")}
          </EmptyState>
        </div>
      )}
    </Card>
  );
}

function CheckRow({
  name,
  defaultChecked,
  disabled,
  children,
}: {
  name: string;
  defaultChecked?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex items-start gap-3 px-4 py-3.5 text-[14px] leading-[1.5] text-[#55534e] transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-[#faf9f6]">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#111111]"
      />
      {children}
    </label>
  );
}
