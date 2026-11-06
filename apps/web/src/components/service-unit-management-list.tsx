"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Icon } from "@/components/app/icons";
import { Avatar, Badge, Button, EmptyState, Field, statusTone } from "@/components/ui/ui";
import { useStatusLabel } from "@/i18n/labels";
import { API_URL } from "@/lib/api";
import { useMemberFormLabels, WEEKDAY_OPTIONS } from "@/lib/member-form-options";
import { isBranchScopedRole } from "@/lib/permissions";
import type { BranchSummary, MemberListItem, ServiceUnitSummary } from "@/lib/types";

function getMemberName(member: MemberListItem) {
  return `${member.firstName} ${member.lastName}`;
}

function getBranchId(value: ServiceUnitSummary["branchId"]) {
  return typeof value === "string" ? value : value?._id;
}

function getLeaderId(unit: ServiceUnitSummary) {
  return unit.leaderMemberId?._id || "";
}

function getSecretaryId(unit: ServiceUnitSummary) {
  return unit.secretaryMemberId?._id || "";
}

function OfficerChip({ role, name }: { role: string; name?: string }) {
  const t = useTranslations("org.serviceUnitForm");
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {name ? (
        <Avatar name={name} />
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-black/[0.12] text-[#8a8780]">
          <Icon name="users" className="h-3.5 w-3.5" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[12px] text-[#8a8780]">{role}</p>
        <p className={`truncate text-[13px] font-medium ${name ? "text-[#111111]" : "text-[#8a8780]"}`}>
          {name || t("notSet")}
        </p>
      </div>
    </div>
  );
}

export function ServiceUnitManagementList({
  serviceUnits,
  members,
  branches,
  currentUserRole,
}: {
  serviceUnits: ServiceUnitSummary[];
  members: MemberListItem[];
  branches: BranchSummary[];
  currentUserRole: string;
}) {
  const router = useRouter();
  const t = useTranslations("org.serviceUnitForm");
  const tCommon = useTranslations("common");
  const labels = useMemberFormLabels();
  const statusLabel = useStatusLabel();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleSubmit(unitId: string, formData: FormData) {
    setLoadingId(unitId);

    try {
      const response = await fetch(`${API_URL}/service-units/${unitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          branchId: (formData.get(`branchId-${unitId}`) as string) || undefined,
          name: formData.get(`name-${unitId}`),
          leaderMemberId:
            (formData.get(`leaderMemberId-${unitId}`) as string) || undefined,
          secretaryMemberId:
            (formData.get(`secretaryMemberId-${unitId}`) as string) || undefined,
          meetingDay: formData.get(`meetingDay-${unitId}`),
          prayerDay: formData.get(`prayerDay-${unitId}`),
          isActive: formData.get(`isActive-${unitId}`) === "on",
          notes: formData.get(`notes-${unitId}`) || undefined,
        }),
      });

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
        error instanceof Error ? error.message : t("updateError");
      toast.error(t("updateFailed"), {
        description: message,
      });
    } finally {
      setLoadingId(null);
    }
  }

  if (serviceUnits.length === 0) {
    return (
      <EmptyState icon="units" title={t("emptyTitle")}>
        {t("emptyBody")}
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {serviceUnits.map((unit) => {
        const branchId = getBranchId(unit.branchId) || "";
        const branchMembers = members.filter((member) => member.branchId?._id === branchId);
        const unitStatus = unit.isActive ? "active" : "inactive";
        const branchName =
          (typeof unit.branchId === "string" ? unit.branchId : unit.branchId?.name) || t("branchNotSet");
        const leaderName = unit.leaderMemberId?.firstName
          ? `${unit.leaderMemberId.firstName} ${unit.leaderMemberId.lastName || ""}`.trim()
          : undefined;
        const secretaryName = unit.secretaryMemberId?.firstName
          ? `${unit.secretaryMemberId.firstName} ${unit.secretaryMemberId.lastName || ""}`.trim()
          : undefined;

        return (
          <details
            key={unit._id}
            className="group rounded-2xl border border-black/[0.06] bg-white transition-colors open:border-black/[0.12] hover:border-black/[0.12]"
          >
            <summary className="cursor-pointer list-none px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="lp-heading text-[16px] leading-tight">{unit.name}</h3>
                    <Badge tone={statusTone(unitStatus)} dot>
                      {statusLabel(unitStatus)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[13px] text-[#6b6b6b]">
                    {branchName}
                    <span className="text-[#8a8780]">
                      {" "}
                      · {t("schedule", { meetingDay: labels.weekday(unit.meetingDay), prayerDay: labels.weekday(unit.prayerDay) })}
                    </span>
                  </p>
                </div>
                <Icon
                  name="chevronDown"
                  className="mt-1 h-4 w-4 shrink-0 text-[#8a8780] transition-transform group-open:rotate-180"
                />
              </div>

              <div className="mt-4 grid gap-4 rounded-2xl bg-[#f6f5f1] p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
                <OfficerChip role={t("leader")} name={leaderName} />
                <OfficerChip role={t("secretary")} name={secretaryName} />
                <div className="sm:text-right">
                  <p className="text-[12px] text-[#8a8780]">{t("members")}</p>
                  <p className="lp-heading text-[18px] leading-tight tabular-nums">{unit.memberCount ?? 0}</p>
                </div>
              </div>
            </summary>

            <div className="border-t border-black/[0.06] px-4 py-5 sm:px-5">
              <form
                action={(formData) => handleSubmit(unit._id, formData)}
                className="grid gap-4 md:grid-cols-2"
              >
                {!isBranchScopedRole(currentUserRole) ? (
                  <Field label={tCommon("branch")}>
                    <select name={`branchId-${unit._id}`} defaultValue={branchId} className="ui-input">
                      <option value="">{tCommon("selectBranch")}</option>
                      {branches.map((branch) => (
                        <option key={branch._id} value={branch._id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <input type="hidden" name={`branchId-${unit._id}`} value={branchId} />
                )}

                <Field label={t("unitName")}>
                  <input name={`name-${unit._id}`} defaultValue={unit.name} className="ui-input" />
                </Field>

                <Field label={t("leader")}>
                  <select name={`leaderMemberId-${unit._id}`} defaultValue={getLeaderId(unit)} className="ui-input">
                    <option value="">{t("selectLeader")}</option>
                    {branchMembers.map((member) => (
                      <option key={member._id} value={member._id}>
                        {getMemberName(member)}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label={t("secretary")}>
                  <select name={`secretaryMemberId-${unit._id}`} defaultValue={getSecretaryId(unit)} className="ui-input">
                    <option value="">{t("selectSecretary")}</option>
                    {branchMembers.map((member) => (
                      <option key={member._id} value={member._id}>
                        {getMemberName(member)}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label={t("meetingDay")}>
                  <select name={`meetingDay-${unit._id}`} defaultValue={unit.meetingDay} className="ui-input">
                    {WEEKDAY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {labels.weekday(option.value)}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label={t("prayerDay")}>
                  <select name={`prayerDay-${unit._id}`} defaultValue={unit.prayerDay} className="ui-input">
                    {WEEKDAY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {labels.weekday(option.value)}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label={tCommon("notes")} className="md:col-span-2">
                  <textarea name={`notes-${unit._id}`} defaultValue={unit.notes || ""} className="ui-input" />
                </Field>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-4 md:col-span-2">
                  <label className="flex items-center gap-2.5 text-[14px] text-[#55534e]">
                    <input
                      type="checkbox"
                      name={`isActive-${unit._id}`}
                      defaultChecked={unit.isActive}
                      className="h-4 w-4"
                    />
                    {t("activeUnit")}
                  </label>
                  <Button type="submit" size="sm" disabled={loadingId === unit._id}>
                    {loadingId === unit._id ? tCommon("saving") : t("update")}
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
