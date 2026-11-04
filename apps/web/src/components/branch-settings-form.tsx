"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useMemo, useState } from "react";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { Badge, Button, Card, EmptyState, Field } from "@/components/ui/ui";
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

const APPROVAL_ROLE_OPTIONS = [
  { value: "branch_admin", label: "Branch admin" },
  { value: "resident_pastor", label: "Resident pastor" },
  { value: "associate_pastor", label: "Associate pastor" },
  { value: "follow_up", label: "Follow-up" },
];

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
    router.replace(`/settings${params.toString() ? `?${params.toString()}` : ""}`);
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
        throw new Error(result.message || "Unable to save branch settings");
      }

      toast.success("Branch settings saved", {
        description: `${overview.branch.name} defaults were updated.`,
      });
      router.refresh();
    } catch (error) {
      toast.error("Branch settings update failed", {
        description:
          error instanceof Error
            ? error.message
            : "Unable to save branch settings",
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
              {!overview.canEdit ? <Badge>View only</Badge> : null}
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
          <Field label="Branch" className="w-full sm:w-64">
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
            <Field label="Timezone">
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

            <Field label="Currency">
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

            <Field label="Locale">
              <input
                name="locale"
                defaultValue={overview.settings.locale}
                disabled={!overview.canEdit}
                className="ui-input"
              />
            </Field>

            <Field label="Default service duration" hint="In minutes, between 30 and 600.">
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
            <p className="text-[13px] font-medium text-[#111111]">Attendance approval owners</p>
            <p className="mt-0.5 text-[13px] text-[#6b6b6b]">Roles that can approve attendance for this branch.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {APPROVAL_ROLE_OPTIONS.map((role) => (
                <label
                  key={role.value}
                  className="flex items-center gap-3 rounded-xl border border-black/[0.06] px-4 py-3 text-[14px] text-[#111111] transition-colors hover:bg-[#faf9f6]"
                >
                  <input
                    type="checkbox"
                    name="attendanceApprovalRoles"
                    value={role.value}
                    defaultChecked={selectedApprovalRoles.has(role.value)}
                    disabled={!overview.canEdit}
                    className="h-4 w-4 accent-[#111111]"
                  />
                  {role.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[13px] font-medium text-[#111111]">Public links</p>
            <p className="mt-0.5 text-[13px] text-[#6b6b6b]">Which public forms can be shared for this branch.</p>
            <div className="mt-3 divide-y divide-black/[0.05] rounded-2xl border border-black/[0.06]">
              <CheckRow
                name="publicGuestIntakeEnabled"
                defaultChecked={overview.settings.publicGuestIntakeEnabled}
                disabled={!overview.canEdit}
              >
                Public guest intake can stay live for this branch.
              </CheckRow>
              <CheckRow
                name="publicMemberIntakeEnabled"
                defaultChecked={overview.settings.publicMemberIntakeEnabled}
                disabled={!overview.canEdit}
              >
                Public member intake links are enabled for this branch.
              </CheckRow>
              <CheckRow
                name="publicAttendanceEntryEnabled"
                defaultChecked={overview.settings.publicAttendanceEntryEnabled}
                disabled={!overview.canEdit}
              >
                Shareable attendance entry links are enabled for this branch.
              </CheckRow>
            </div>
          </div>

          <div>
            <p className="text-[13px] font-medium text-[#111111]">Notifications</p>
            <p className="mt-0.5 text-[13px] text-[#6b6b6b]">
              Which branch operations should raise alerts and digest reminders.
            </p>
            <div className="mt-3 divide-y divide-black/[0.05] rounded-2xl border border-black/[0.06]">
              <CheckRow
                name="notifyOnMissingAttendance"
                defaultChecked={overview.settings.notifyOnMissingAttendance}
                disabled={!overview.canEdit}
              >
                Alert this branch when attendance submissions are missing.
              </CheckRow>
              <CheckRow
                name="notifyOnFollowUpBacklog"
                defaultChecked={overview.settings.notifyOnFollowUpBacklog}
                disabled={!overview.canEdit}
              >
                Alert this branch when follow-up backlog is building.
              </CheckRow>
              <CheckRow
                name="notifyOnFinanceApprovals"
                defaultChecked={overview.settings.notifyOnFinanceApprovals}
                disabled={!overview.canEdit}
              >
                Alert this branch when finance approvals need attention.
              </CheckRow>
              <CheckRow
                name="dailySummaryEnabled"
                defaultChecked={overview.settings.dailySummaryEnabled}
                disabled={!overview.canEdit}
              >
                Enable daily branch summary reminders.
              </CheckRow>
              <CheckRow
                name="weeklyLeadershipDigestEnabled"
                defaultChecked={overview.settings.weeklyLeadershipDigestEnabled}
                disabled={!overview.canEdit}
              >
                Enable weekly leadership digest reminders.
              </CheckRow>
            </div>
          </div>

          <div className="flex justify-end border-t border-black/[0.06] pt-5">
            {overview.canEdit ? (
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save branch settings"}
              </Button>
            ) : (
              <p className="text-[13px] text-[#6b6b6b]">
                You can view this branch configuration, but only branch and oversight admins can edit it.
              </p>
            )}
          </div>
        </form>
      ) : (
        <div className="mt-6">
          <EmptyState icon="branches" title="No branch settings">
            No branch settings are available in your current scope yet.
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
