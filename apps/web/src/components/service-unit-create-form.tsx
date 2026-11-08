"use client";
import { MemberCustomFields, memberFieldPayload, useMemberFields } from "@/components/member-custom-fields";

import { savedToastId } from "@/lib/action-feedback";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createdHref } from "@/lib/directory";
import { toast } from "sonner";
import { Button, Field } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";
import {
  useMemberFormLabels,
  WEEKDAY_OPTIONS,
} from "@/lib/member-form-options";
import { isBranchScopedRole } from "@/lib/permissions";
import type { BranchSummary, MemberListItem } from "@/lib/types";

function getBranchId(member: MemberListItem) {
  return member.branchId?._id;
}

function getMemberName(member: MemberListItem) {
  return `${member.firstName} ${member.lastName}`;
}

export function ServiceUnitCreateForm({
  branches,
  members,
  defaultBranchId,
  currentUserRole,
  showHeader = true,
  onSuccess,
}: {
  branches: BranchSummary[];
  members: MemberListItem[];
  defaultBranchId?: string;
  currentUserRole: string;
  showHeader?: boolean;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const { form: fieldDefinition, failed: fieldFailure } = useMemberFields(undefined, true, "/guests/ministry-form/service-unit");
  const tf = useTranslations("admin.settings.guestFields");

  const t = useTranslations("org.serviceUnitForm");
  const tCommon = useTranslations("common");
  const labels = useMemberFormLabels();
  const [loading, setLoading] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState(
    defaultBranchId || branches[0]?._id || "",
  );

  const filteredMembers = useMemo(
    () =>
      members.filter((member) =>
        selectedBranchId ? getBranchId(member) === selectedBranchId : true,
      ),
    [members, selectedBranchId],
  );

  async function handleSubmit(formData: FormData) {
    if (!fieldDefinition) return;
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/service-units`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...memberFieldPayload(fieldDefinition, formData),
          branchId: (formData.get("branchId") as string) || defaultBranchId,
          name: formData.get("name"),
          leaderMemberId:
            (formData.get("leaderMemberId") as string) || undefined,
          secretaryMemberId:
            (formData.get("secretaryMemberId") as string) || undefined,
          meetingDay: formData.get("meetingDay"),
          prayerDay: formData.get("prayerDay"),
          isActive: formData.get("isActive") === "on",
          notes: formData.get("notes") || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || t("createError"));
      }

      toast.success(t("createdTitle"), {
        id: savedToastId(result),
        description: t("createdBody"),
      });
      onSuccess?.();
      router.push(
        createdHref("/service-units?sort=newest", result, t("entityName")),
      );
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("createError");
      toast.error(t("createFailed"), {
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }

  const leadershipRequired = filteredMembers.length > 0;

  return (
    <form
      action={handleSubmit}
      className={showHeader ? "rounded-2xl bg-white p-5 sm:p-6" : undefined}
    >
      {showHeader ? (
        <div className="mb-5">
          <h3 className="lp-heading text-[18px] leading-tight">
            {t("heading")}
          </h3>
          <p className="mt-1.5 text-[14px] leading-[1.6] text-[#6b6b6b]">
            {t("intro")}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
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

        <Field label={t("unitName")} required>
          <input
            name="name"
            placeholder={t("unitNamePlaceholder")}
            className="ui-input"
            required
          />
        </Field>

        <Field label={t("leader")} required={leadershipRequired}>
          <select
            name="leaderMemberId"
            className="ui-input"
            required={leadershipRequired}
          >
            <option value="">{t("selectLeader")}</option>
            {filteredMembers.map((member) => (
              <option key={member._id} value={member._id}>
                {getMemberName(member)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("secretary")} required={leadershipRequired}>
          <select
            name="secretaryMemberId"
            className="ui-input"
            required={leadershipRequired}
          >
            <option value="">{t("selectSecretary")}</option>
            {filteredMembers.map((member) => (
              <option key={member._id} value={member._id}>
                {getMemberName(member)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("meetingDay")} required>
          <select
            name="meetingDay"
            defaultValue="Saturday"
            className="ui-input"
            required
          >
            {WEEKDAY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {labels.weekday(option.value)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("prayerDay")} required>
          <select
            name="prayerDay"
            defaultValue="Friday"
            className="ui-input"
            required
          >
            {WEEKDAY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {labels.weekday(option.value)}
              </option>
            ))}
          </select>
        </Field>

        {!fieldDefinition?.hiddenStaff.includes("notes") ? <Field label={tCommon("notes")} className="md:col-span-2">
          <textarea
            name="notes"
            placeholder={t("notesPlaceholder")}
            className="ui-input"
          />
        </Field> : null}
      </div>

      <p className="mt-4 rounded-xl bg-[#f6f5f1] px-4 py-3 text-[13px] leading-[1.6] text-[#6b6b6b]">
        {leadershipRequired ? t("leadershipHint") : t("noMembersHint")}
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-5">
        <label className="flex items-center gap-2.5 text-[14px] text-[#55534e]">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked
            className="h-4 w-4"
          />
          {t("activeUnit")}
        </label>
        {fieldFailure ? <p role="alert">{tf("extraLoadFailed")}</p> : null}
      {fieldDefinition?.fields.length ? <MemberCustomFields fields={fieldDefinition.fields} /> : null}
<Button type="submit" disabled={loading || !fieldDefinition}>
          {loading ? t("creating") : t("create")}
        </Button>
      </div>
    </form>
  );
}
