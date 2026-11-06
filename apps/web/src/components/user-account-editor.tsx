"use client";
import { toast } from "sonner";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/app/icons";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Field,
  statusTone,
} from "@/components/ui/ui";
import { useAppFormat, useRoleLabel, useStatusLabel } from "@/i18n/labels";
import { API_URL } from "@/lib/api";
import {
  getManageableUserRoleOptions,
  isBranchScopedRole,
  isDistrictRole,
  isGlobalRole,
  isNationalRole,
  type AppRole,
} from "@/lib/permissions";
import type {
  BranchSummary,
  DistrictOption,
  OversightRegionOption,
  UserSummary,
} from "@/lib/types";

const READ_ONLY_INPUT = "ui-input bg-[#f6f5f1] text-[#6b6b6b]";

export function UserAccountEditor({
  users,
  branches,
  currentUserRole,
  currentUserId,
  defaultBranchId,
  defaultOversightRegion,
  defaultDistrict,
  oversightRegions,
  districts,
  section,
  returnHref,
}: {
  users: UserSummary[];
  section: "profile" | "access" | "security";
  returnHref: string;
  branches: BranchSummary[];
  currentUserRole: string;
  currentUserId?: string;
  defaultBranchId?: string;
  defaultOversightRegion?: string;
  defaultDistrict?: string;
  oversightRegions: OversightRegionOption[];
  districts: DistrictOption[];
}) {
  const router = useRouter();
  const tw = useTranslations("workspace");
  const t = useTranslations("org.userList");
  const tForm = useTranslations("org.userForm");
  const tCommon = useTranslations("common");
  const roleLabel = useRoleLabel();
  const statusLabel = useStatusLabel();
  const { dateTime } = useAppFormat();
  const READ_ONLY_HINT = tForm("readOnlyHint");

  const [welcomeLoading, setWelcomeLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>(
    {},
  );
  const [selectedRegions, setSelectedRegions] = useState<
    Record<string, string>
  >({});
  const branchMap = new Map(
    branches.map((branch) => [branch._id, branch.name]),
  );
  const roleOptions = getManageableUserRoleOptions(currentUserRole);

  function getScopeLabel(user: UserSummary) {
    if (isGlobalRole(user.role)) {
      return t("overallOversight");
    }

    if (isNationalRole(user.role)) {
      return user.oversightRegion || t("nationalScope");
    }

    if (isDistrictRole(user.role)) {
      if (user.district && user.oversightRegion) {
        return `${user.district} · ${user.oversightRegion}`;
      }

      return user.district || t("districtScope");
    }

    return user.branchId
      ? branchMap.get(user.branchId) || t("assignedBranch")
      : t("branchScope");
  }

  function getSelectedRegion(userId: string, userRegion?: string) {
    return (
      selectedRegions[userId] ||
      userRegion ||
      defaultOversightRegion ||
      oversightRegions[0]?.name ||
      ""
    );
  }

  function getAvailableDistricts(userId: string, userRegion?: string) {
    if (isDistrictRole(currentUserRole) && defaultDistrict) {
      return districts.filter((district) => district.name === defaultDistrict);
    }

    const activeRegion = isGlobalRole(currentUserRole)
      ? getSelectedRegion(userId, userRegion)
      : defaultOversightRegion || userRegion;

    return districts.filter(
      (district) => district.oversightRegion === activeRegion,
    );
  }

  async function sendWelcome(userId: string) {
    setWelcomeLoading(true);
    try {
      const response = await fetch(`${API_URL}/users/${userId}/welcome`, {
        method: "POST",
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(t("welcomeFailed"));
      if (result.status === "accepted") toast.success(t("welcomeAccepted"));
      else if (result.status === "recently_requested")
        toast.info(t("welcomeRecent"));
      else if (result.status === "inactive") toast.info(t("welcomeInactive"));
      else toast.error(t("welcomeFailed"));
      router.refresh();
    } catch {
      toast.error(t("welcomeFailed"));
    } finally {
      setWelcomeLoading(false);
    }
  }

  async function handleSubmit(userId: string, formData: FormData) {
    setLoadingId(userId);

    try {
      const branchId = isBranchScopedRole(currentUserRole)
        ? defaultBranchId || undefined
        : formData.get(`branchId-${userId}`) || undefined;
      const password = formData.get(`password-${userId}`);

      const response = await fetch(`${API_URL}/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          section === "profile"
            ? {
                firstName: formData.get(`firstName-${userId}`),
                lastName: formData.get(`lastName-${userId}`),
                email: formData.get(`email-${userId}`),
              }
            : section === "security"
              ? {
                  isActive: formData.get(`isActive-${userId}`) === "on",
                  ...(password ? { password } : {}),
                }
              : {
                  role: formData.get(`role-${userId}`),
                  branchId,
                  oversightRegion:
                    formData.get(`oversightRegion-${userId}`) || undefined,
                  district: formData.get(`district-${userId}`) || undefined,
                },
        ),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || t("updateError"));
      }

      toast.success(t("updated"));
      router.replace(returnHref, { scroll: false });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("updateError"));
    } finally {
      setLoadingId(null);
    }
  }

  if (users.length === 0) {
    return (
      <EmptyState icon="users" title={t("emptyTitle")}>
        {t("emptyBody")}
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {users.map((user) => {
        const selectedRole = (selectedRoles[user._id] || user.role) as AppRole;
        const isRestrictedRow =
          user._id === currentUserId ||
          !roleOptions.includes(user.role as AppRole);
        const availableDistricts = getAvailableDistricts(
          user._id,
          user.oversightRegion,
        );
        const fullName = `${user.firstName} ${user.lastName}`.trim();
        const userStatus = user.isActive ? "active" : "inactive";

        const regionSelect = (
          <select
            name={`oversightRegion-${user._id}`}
            value={getSelectedRegion(user._id, user.oversightRegion)}
            onChange={(event) =>
              setSelectedRegions((current) => ({
                ...current,
                [user._id]: event.target.value,
              }))
            }
            className="ui-input"
            required
          >
            <option value="">{tForm("selectNationalArea")}</option>
            {oversightRegions.map((region) => (
              <option key={region._id} value={region.name}>
                {region.name}
              </option>
            ))}
          </select>
        );

        const regionReadOnly = (
          <>
            <input
              type="hidden"
              name={`oversightRegion-${user._id}`}
              value={defaultOversightRegion ?? ""}
            />
            <input
              value={defaultOversightRegion || tForm("currentOversightRegion")}
              readOnly
              className={READ_ONLY_INPUT}
            />
          </>
        );

        return (
          <section
            key={user._id}
            className="group rounded-2xl border border-black/[0.06] bg-white transition-colors open:border-black/[0.12] hover:border-black/[0.12]"
          >
            <div className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 sm:px-5 [&::-webkit-details-marker]:hidden">
              <Avatar name={fullName || user.email} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-[#111111]">
                  {fullName}
                </p>
                <p className="truncate text-[13px] text-[#6b6b6b]">
                  {user.email}
                  <span className="text-[#8a8780]">
                    {" "}
                    · {getScopeLabel(user)}
                  </span>
                </p>
              </div>
              <div className="hidden flex-wrap items-center justify-end gap-2 sm:flex">
                <Badge>{roleLabel(user.role)}</Badge>
                <Badge tone={statusTone(userStatus)} dot>
                  {statusLabel(userStatus)}
                </Badge>
              </div>
              <Icon
                name="chevronDown"
                className="h-4 w-4 shrink-0 text-[#8a8780] transition-transform group-open:rotate-180"
              />
            </div>

            <div className="border-t border-black/[0.06] px-4 py-5 sm:px-5">
              <div className="mb-4 flex flex-wrap items-center gap-2 sm:hidden">
                <Badge>{roleLabel(user.role)}</Badge>
                <Badge tone={statusTone(userStatus)} dot>
                  {statusLabel(userStatus)}
                </Badge>
              </div>

              {isRestrictedRow ? (
                <div className="rounded-2xl bg-[#f6f5f1] p-4 text-[14px] text-[#55534e]">
                  {t("restricted")}
                </div>
              ) : (
                <form
                  action={(formData) => handleSubmit(user._id, formData)}
                  className="grid gap-4 md:grid-cols-2"
                >
                  {section === "profile" && (
                    <>
                      <Field label={tCommon("firstName")}>
                        <input
                          name={`firstName-${user._id}`}
                          defaultValue={user.firstName}
                          className="ui-input"
                        />
                      </Field>
                      <Field label={tCommon("lastName")}>
                        <input
                          name={`lastName-${user._id}`}
                          defaultValue={user.lastName}
                          className="ui-input"
                        />
                      </Field>
                      <Field label={tCommon("email")} className="md:col-span-2">
                        <input
                          name={`email-${user._id}`}
                          type="email"
                          defaultValue={user.email}
                          className="ui-input"
                        />
                      </Field>
                    </>
                  )}
                  {section === "access" && (
                    <Field label={tForm("role")}>
                      <select
                        name={`role-${user._id}`}
                        value={selectedRole}
                        onChange={(event) =>
                          setSelectedRoles((current) => ({
                            ...current,
                            [user._id]: event.target.value,
                          }))
                        }
                        className="ui-input"
                      >
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {roleLabel(role)}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                  {section === "security" && (
                    <Field label={t("newPassword")} hint={t("newPasswordHint")}>
                      <input
                        name={`password-${user._id}`}
                        type="password"
                        placeholder={t("newPasswordPlaceholder")}
                        className="ui-input"
                      />
                    </Field>
                  )}
                  {section === "access" && (
                    <>
                      {selectedRole === "super_admin" ? (
                        <div className="rounded-2xl bg-[#f6f5f1] p-4 text-[14px] text-[#55534e] md:col-span-2">
                          {t("superAdminNote")}
                        </div>
                      ) : null}

                      {isNationalRole(selectedRole) ? (
                        isGlobalRole(currentUserRole) ? (
                          <Field
                            label={tCommon("nationalArea")}
                            required
                            className="md:col-span-2"
                          >
                            {regionSelect}
                          </Field>
                        ) : (
                          <Field
                            label={tCommon("nationalArea")}
                            hint={READ_ONLY_HINT}
                            className="md:col-span-2"
                          >
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
                            <Field
                              label={tCommon("nationalArea")}
                              hint={READ_ONLY_HINT}
                            >
                              {regionReadOnly}
                            </Field>
                          )}
                          <Field label={tCommon("district")} required>
                            <select
                              name={`district-${user._id}`}
                              defaultValue={user.district || ""}
                              className="ui-input"
                              required
                              disabled={availableDistricts.length === 0}
                            >
                              {availableDistricts.length === 0 ? (
                                <option value="">
                                  {tForm("createDistrictFirst")}
                                </option>
                              ) : null}
                              {availableDistricts.map((district) => (
                                <option
                                  key={district._id}
                                  value={district.name}
                                >
                                  {district.name}
                                </option>
                              ))}
                            </select>
                          </Field>
                        </>
                      ) : null}

                      {isBranchScopedRole(selectedRole) ? (
                        isBranchScopedRole(currentUserRole) ? (
                          <Field
                            label={tCommon("branch")}
                            hint={READ_ONLY_HINT}
                            className="md:col-span-2"
                          >
                            <input
                              type="hidden"
                              name={`branchId-${user._id}`}
                              value={defaultBranchId ?? ""}
                            />
                            <input
                              value={
                                branchMap.get(defaultBranchId || "") ||
                                tForm("currentBranchScope")
                              }
                              readOnly
                              className={READ_ONLY_INPUT}
                            />
                          </Field>
                        ) : (
                          <Field
                            label={tCommon("branch")}
                            required
                            className="md:col-span-2"
                          >
                            <select
                              name={`branchId-${user._id}`}
                              defaultValue={user.branchId || ""}
                              className="ui-input"
                              required
                            >
                              <option value="">
                                {tCommon("selectBranch")}
                              </option>
                              {branches.map((branch) => (
                                <option key={branch._id} value={branch._id}>
                                  {branch.name}
                                </option>
                              ))}
                            </select>
                          </Field>
                        )
                      ) : null}

                      <p className="text-[13px] text-[#8a8780] md:col-span-2">
                        {tForm.rich("managedFrom", {
                          link: (chunks) => (
                            <a
                              href="/structure"
                              className="font-medium text-[#111111] underline underline-offset-2 hover:text-[#ea580c]"
                            >
                              {chunks}
                            </a>
                          ),
                        })}
                      </p>
                    </>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-4 md:col-span-2">
                    {section === "security" && (
                      <label className="flex items-center gap-2.5 text-[14px] text-[#55534e]">
                        <input
                          name={`isActive-${user._id}`}
                          type="checkbox"
                          defaultChecked={!!user.isActive}
                          className="h-4 w-4"
                        />
                        {t("canSignIn")}
                      </label>
                    )}
                    <a href={returnHref} className="text-sm underline">
                      {tw("cancel")}
                    </a>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={loadingId === user._id}
                    >
                      {loadingId === user._id ? tCommon("saving") : t("update")}
                    </Button>
                  </div>
                </form>
              )}

              {section === "security" && user._id !== currentUserId && (
                <div className="mt-6 border-t border-black/[0.06] pt-5">
                  <h3 className="font-medium">{t("welcomeTitle")}</h3>
                  <p className="my-2 max-w-xl text-sm text-[#6b6b6b]">
                    {t("welcomeHint")}
                  </p>
                  {user.welcomeEmailStatus && (
                    <p className="mb-3 text-xs text-[#6b6b6b]">
                      {t("welcomeLast", { status: user.welcomeEmailStatus })}
                    </p>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    disabled={welcomeLoading || !user.isActive}
                    onClick={() => sendWelcome(user._id)}
                  >
                    {welcomeLoading ? t("sendingWelcome") : t("sendWelcome")}
                  </Button>
                </div>
              )}
              <p className="mt-4 flex items-center gap-1.5 text-[12px] text-[#8a8780]">
                <Icon name="clock" className="h-3.5 w-3.5" />
                {user.lastLoginAt
                  ? t("lastSignedIn", { when: dateTime(user.lastLoginAt) })
                  : t("noSignIn")}
              </p>
            </div>
          </section>
        );
      })}
    </div>
  );
}
