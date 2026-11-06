"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createdHref } from "@/lib/directory";
import { Button, EmptyState, Field } from "@/components/ui/ui";
import { useRoleLabel } from "@/i18n/labels";
import { API_URL } from "@/lib/api";
import {
  getManageableUserRoleOptions,
  isBranchScopedRole,
  isDistrictRole,
  isGlobalRole,
  isNationalRole,
} from "@/lib/permissions";
import type {
  BranchSummary,
  DistrictOption,
  OversightRegionOption,
} from "@/lib/types";

const READ_ONLY_INPUT = "ui-input bg-[#f6f5f1] text-[#6b6b6b]";

export function UserCreateForm({
  branches,
  currentUserRole,
  defaultBranchId,
  defaultOversightRegion,
  defaultDistrict,
  oversightRegions,
  districts,
  allowedRoles,
  title,
  description,
  submitLabel,
  showHeader = true,
}: {
  branches: BranchSummary[];
  currentUserRole: string;
  defaultBranchId?: string;
  defaultOversightRegion?: string;
  defaultDistrict?: string;
  oversightRegions: OversightRegionOption[];
  districts: DistrictOption[];
  allowedRoles?: string[];
  title?: string;
  description?: string;
  submitLabel?: string;
  showHeader?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("org.userForm");
  const tCommon = useTranslations("common");
  const roleLabel = useRoleLabel();
  const READ_ONLY_HINT = t("readOnlyHint");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const creatorIsBranchScoped = isBranchScopedRole(currentUserRole);
  const defaultBranchName = branches.find((branch) => branch._id === defaultBranchId)?.name;
  const manageableRoles = getManageableUserRoleOptions(currentUserRole);
  const roleOptions = allowedRoles
    ? manageableRoles.filter((role) => allowedRoles.includes(role))
    : manageableRoles;
  const [selectedRole, setSelectedRole] = useState<string>(
    roleOptions.includes("usher") ? "usher" : roleOptions.includes("follow_up") ? "follow_up" : "",
  );
  const [selectedOversightRegion, setSelectedOversightRegion] = useState(
    defaultOversightRegion || oversightRegions[0]?.name || "",
  );

  const availableDistricts = useMemo(() => {
    if (isDistrictRole(currentUserRole) && defaultDistrict) {
      return districts.filter((district) => district.name === defaultDistrict);
    }

    const activeRegion = isGlobalRole(currentUserRole)
      ? selectedOversightRegion
      : defaultOversightRegion;

    return districts.filter((district) => district.oversightRegion === activeRegion);
  }, [
    currentUserRole,
    defaultDistrict,
    defaultOversightRegion,
    districts,
    selectedOversightRegion,
  ]);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setStatus(null);

    try {
      const branchId = creatorIsBranchScoped
        ? defaultBranchId || undefined
        : formData.get("branchId") || undefined;
      const response = await fetch(`${API_URL}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          firstName: formData.get("firstName"),
          lastName: formData.get("lastName"),
          email: formData.get("email"),
          password: formData.get("password"),
          role: formData.get("role"),
          branchId: branchId || undefined,
          oversightRegion: formData.get("oversightRegion") || undefined,
          district: formData.get("district") || undefined,
          isActive: formData.get("isActive") === "on",
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || t("createError"));
      }

      setStatus(t("created"));
      router.push(createdHref(`/users?search=${encodeURIComponent(String(formData.get("email") || ""))}`, result, t("entityName")));
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("createError"));
    } finally {
      setLoading(false);
    }
  }

  const regionSelect = (
    <select
      name="oversightRegion"
      value={selectedOversightRegion}
      onChange={(event) => setSelectedOversightRegion(event.target.value)}
      className="ui-input"
      required
    >
      <option value="">{t("selectNationalArea")}</option>
      {oversightRegions.map((region) => (
        <option key={region._id} value={region.name}>
          {region.name}
        </option>
      ))}
    </select>
  );

  const regionReadOnly = (
    <>
      <input type="hidden" name="oversightRegion" value={defaultOversightRegion ?? ""} />
      <input value={defaultOversightRegion || t("currentOversightRegion")} readOnly className={READ_ONLY_INPUT} />
    </>
  );

  return (
    <form action={handleSubmit} className={showHeader ? "rounded-2xl bg-white p-5 sm:p-6" : undefined}>
      {showHeader ? (
        <div className="mb-5">
          <h3 className="lp-heading text-[18px] leading-tight">{title ?? t("title")}</h3>
          {description ? (
            <p className="mt-1.5 text-[14px] leading-[1.6] text-[#6b6b6b]">{description}</p>
          ) : null}
        </div>
      ) : null}

      {roleOptions.length === 0 ? (
        <EmptyState icon="users" title={t("noRolesTitle")}>
          {t("noRolesBody")}
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={tCommon("firstName")} required>
              <input name="firstName" placeholder={tCommon("firstName")} className="ui-input" required />
            </Field>
            <Field label={tCommon("lastName")} required>
              <input name="lastName" placeholder={tCommon("lastName")} className="ui-input" required />
            </Field>
            <Field label={tCommon("email")} required className="md:col-span-2">
              <input name="email" type="email" placeholder={t("emailPlaceholder")} className="ui-input" required />
            </Field>
            <Field label={t("tempPassword")} required hint={t("tempPasswordHint")}>
              <input name="password" type="password" placeholder={t("tempPassword")} className="ui-input" required />
            </Field>
            <Field label={t("role")} required hint={t("roleHint")}>
              <select
                name="role"
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value)}
                className="ui-input"
                required
              >
                <option value="" disabled>{t("chooseRole")}</option>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
                  </option>
                ))}
              </select>
            </Field>

            {selectedRole === "super_admin" ? (
              <div className="rounded-2xl bg-[#f6f5f1] p-4 text-[14px] leading-[1.6] text-[#55534e] md:col-span-2">
                {t("superAdminNote")}
              </div>
            ) : null}

            {isNationalRole(selectedRole) ? (
              isGlobalRole(currentUserRole) ? (
                <Field label={tCommon("nationalArea")} required className="md:col-span-2">
                  {regionSelect}
                </Field>
              ) : (
                <Field label={tCommon("nationalArea")} hint={READ_ONLY_HINT} className="md:col-span-2">
                  {regionReadOnly}
                </Field>
              )
            ) : null}

            {isDistrictRole(selectedRole) ? (
              <>
                {isGlobalRole(currentUserRole) ? (
                  <Field label={tCommon("nationalArea")} required>
                    {regionSelect}
                  </Field>
                ) : (
                  <Field label={tCommon("nationalArea")} hint={READ_ONLY_HINT}>
                    {regionReadOnly}
                  </Field>
                )}
                <Field label={tCommon("district")} required>
                  <select
                    name="district"
                    defaultValue=""
                    className="ui-input"
                    required
                    disabled={availableDistricts.length === 0}
                  >
                    <option value="">
                      {availableDistricts.length === 0 ? t("createDistrictFirst") : t("selectDistrict")}
                    </option>
                    {availableDistricts.map((district) => (
                      <option key={district._id} value={district.name}>
                        {district.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            ) : null}

            {isBranchScopedRole(selectedRole) ? (
              creatorIsBranchScoped ? (
                <Field label={tCommon("branch")} hint={READ_ONLY_HINT} className="md:col-span-2">
                  <input type="hidden" name="branchId" value={defaultBranchId ?? ""} />
                  <input value={defaultBranchName || t("currentBranchScope")} readOnly className={READ_ONLY_INPUT} />
                </Field>
              ) : (
                <Field label={tCommon("branch")} required className="md:col-span-2">
                  <select name="branchId" defaultValue="" className="ui-input" required>
                    <option value="">{tCommon("selectBranch")}</option>
                    {branches.map((branch) => (
                      <option key={branch._id} value={branch._id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )
            ) : null}
          </div>

          <p className="mt-4 text-[13px] text-[#8a8780]">
            {t.rich("managedFrom", {
              link: (chunks) => (
                <a href="/structure" className="font-medium text-[#111111] underline underline-offset-2 hover:text-[#ea580c]">
                  {chunks}
                </a>
              ),
            })}
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-5">
            <label className="flex items-center gap-2.5 text-[14px] text-[#55534e]">
              <input name="isActive" type="checkbox" defaultChecked className="h-4 w-4" />
              {t("activeImmediately")}
            </label>
            <Button type="submit" disabled={loading}>
              {loading ? tCommon("saving") : submitLabel ?? t("submit")}
            </Button>
          </div>
        </>
      )}

      {status ? (
        <p role="status" className="mt-4 rounded-xl bg-[#f6f5f1] px-4 py-3 text-[14px] text-[#55534e]">
          {status}
        </p>
      ) : null}
    </form>
  );
}
