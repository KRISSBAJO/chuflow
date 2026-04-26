"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
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
    <section className="rounded-[28px] bg-white p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Branch defaults</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            Timezone, currency, approvals, and public links
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Keep branch-level operations aligned without changing the whole app.
          </p>
        </div>

        {canSelectBranch && branches.length > 1 ? (
          <label className="flex min-w-[240px] flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              Branch
            </span>
            <select
              value={activeBranchId}
              onChange={(event) => handleBranchChange(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
            >
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {overview ? (
        <form action={handleSubmit} className="mt-6 space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">{overview.branch.name}</p>
            <p className="mt-1">
              {overview.branch.city}, {overview.branch.state} ·{" "}
              {overview.branch.district} · {overview.branch.oversightRegion}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Timezone</span>
              <select
                name="timezone"
                defaultValue={overview.settings.timezone}
                disabled={!overview.canEdit}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none disabled:opacity-60"
              >
                {TIMEZONE_OPTIONS.map((timezone) => (
                  <option key={timezone} value={timezone}>
                    {timezone}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Currency</span>
              <select
                name="currency"
                defaultValue={overview.settings.currency}
                disabled={!overview.canEdit}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none disabled:opacity-60"
              >
                {CURRENCY_OPTIONS.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Locale</span>
              <input
                name="locale"
                defaultValue={overview.settings.locale}
                disabled={!overview.canEdit}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none disabled:opacity-60"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Default service duration
              </span>
              <input
                type="number"
                min={30}
                max={600}
                name="defaultServiceDurationMinutes"
                defaultValue={overview.settings.defaultServiceDurationMinutes}
                disabled={!overview.canEdit}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none disabled:opacity-60"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-sm font-medium text-slate-700">
              Attendance approval owners
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {APPROVAL_ROLE_OPTIONS.map((role) => (
                <label
                  key={role.value}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    name="attendanceApprovalRoles"
                    value={role.value}
                    defaultChecked={selectedApprovalRoles.has(role.value)}
                    disabled={!overview.canEdit}
                    className="h-4 w-4"
                  />
                  {role.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              <input
                type="checkbox"
                name="publicGuestIntakeEnabled"
                defaultChecked={overview.settings.publicGuestIntakeEnabled}
                disabled={!overview.canEdit}
                className="h-4 w-4"
              />
              Public guest intake can stay live for this branch.
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              <input
                type="checkbox"
                name="publicMemberIntakeEnabled"
                defaultChecked={overview.settings.publicMemberIntakeEnabled}
                disabled={!overview.canEdit}
                className="h-4 w-4"
              />
              Public member intake links are enabled for this branch.
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              <input
                type="checkbox"
                name="publicAttendanceEntryEnabled"
                defaultChecked={overview.settings.publicAttendanceEntryEnabled}
                disabled={!overview.canEdit}
                className="h-4 w-4"
              />
              Shareable attendance entry links are enabled for this branch.
            </label>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-sm font-medium text-slate-700">
              Branch notification preferences
            </p>
            <p className="mt-1 text-sm text-slate-500">
              These preferences shape which branch operations should raise alerts and digest reminders.
            </p>
            <div className="mt-4 grid gap-3">
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="notifyOnMissingAttendance"
                  defaultChecked={overview.settings.notifyOnMissingAttendance}
                  disabled={!overview.canEdit}
                  className="h-4 w-4"
                />
                Alert this branch when attendance submissions are missing.
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="notifyOnFollowUpBacklog"
                  defaultChecked={overview.settings.notifyOnFollowUpBacklog}
                  disabled={!overview.canEdit}
                  className="h-4 w-4"
                />
                Alert this branch when follow-up backlog is building.
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="notifyOnFinanceApprovals"
                  defaultChecked={overview.settings.notifyOnFinanceApprovals}
                  disabled={!overview.canEdit}
                  className="h-4 w-4"
                />
                Alert this branch when finance approvals need attention.
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="dailySummaryEnabled"
                  defaultChecked={overview.settings.dailySummaryEnabled}
                  disabled={!overview.canEdit}
                  className="h-4 w-4"
                />
                Enable daily branch summary reminders.
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="weeklyLeadershipDigestEnabled"
                  defaultChecked={overview.settings.weeklyLeadershipDigestEnabled}
                  disabled={!overview.canEdit}
                  className="h-4 w-4"
                />
                Enable weekly leadership digest reminders.
              </label>
            </div>
          </div>

          {overview.canEdit ? (
            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
            >
              {loading ? "Saving..." : "Save branch settings"}
            </button>
          ) : (
            <p className="text-sm text-slate-500">
              You can view this branch configuration, but only branch and oversight admins can edit it.
            </p>
          )}
        </form>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">
          No branch settings are available in your current scope yet.
        </div>
      )}
    </section>
  );
}
