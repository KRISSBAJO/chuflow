"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/app/icons";
import { Avatar, Badge, Button, EmptyState, Field, formatStatus, statusTone } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";
import {
  formatRoleLabel,
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

const READ_ONLY_HINT = "Set by your current scope.";
const READ_ONLY_INPUT = "ui-input bg-[#f6f5f1] text-[#6b6b6b]";

export function UserManagementList({
  users,
  branches,
  currentUserRole,
  currentUserId,
  defaultBranchId,
  defaultOversightRegion,
  defaultDistrict,
  oversightRegions,
  districts,
}: {
  users: UserSummary[];
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
  const [status, setStatus] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [selectedRegions, setSelectedRegions] = useState<Record<string, string>>(
    {},
  );
  const branchMap = new Map(branches.map((branch) => [branch._id, branch.name]));
  const roleOptions = getManageableUserRoleOptions(currentUserRole);

  function getScopeLabel(user: UserSummary) {
    if (isGlobalRole(user.role)) {
      return "Overall oversight";
    }

    if (isNationalRole(user.role)) {
      return user.oversightRegion || "National scope";
    }

    if (isDistrictRole(user.role)) {
      if (user.district && user.oversightRegion) {
        return `${user.district} · ${user.oversightRegion}`;
      }

      return user.district || "District scope";
    }

    return user.branchId ? branchMap.get(user.branchId) || "Assigned branch" : "Branch scope";
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

    return districts.filter((district) => district.oversightRegion === activeRegion);
  }

  async function handleSubmit(userId: string, formData: FormData) {
    setLoadingId(userId);
    setStatus(null);

    try {
      const branchId =
        isBranchScopedRole(currentUserRole)
          ? defaultBranchId || undefined
          : formData.get(`branchId-${userId}`) || undefined;
      const password = formData.get(`password-${userId}`);

      const response = await fetch(`${API_URL}/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          firstName: formData.get(`firstName-${userId}`),
          lastName: formData.get(`lastName-${userId}`),
          email: formData.get(`email-${userId}`),
          role: formData.get(`role-${userId}`),
          branchId,
          oversightRegion: formData.get(`oversightRegion-${userId}`) || undefined,
          district: formData.get(`district-${userId}`) || undefined,
          isActive: formData.get(`isActive-${userId}`) === "on",
          password: password || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to update user");
      }

      setStatus("User updated successfully.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to update user");
    } finally {
      setLoadingId(null);
    }
  }

  if (users.length === 0) {
    return (
      <EmptyState icon="users" title="No users found">
        No staff accounts match these filters. Try widening the scope or clearing the search.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {users.map((user) => {
        const selectedRole = (selectedRoles[user._id] || user.role) as AppRole;
        const isRestrictedRow =
          user._id === currentUserId || !roleOptions.includes(user.role as AppRole);
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
            <option value="">Select national area</option>
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
            <input value={defaultOversightRegion || "Current oversight region"} readOnly className={READ_ONLY_INPUT} />
          </>
        );

        return (
          <details
            key={user._id}
            className="group rounded-2xl border border-black/[0.06] bg-white transition-colors open:border-black/[0.12] hover:border-black/[0.12]"
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 sm:px-5 [&::-webkit-details-marker]:hidden">
              <Avatar name={fullName || user.email} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-[#111111]">{fullName}</p>
                <p className="truncate text-[13px] text-[#6b6b6b]">
                  {user.email}
                  <span className="text-[#8a8780]"> · {getScopeLabel(user)}</span>
                </p>
              </div>
              <div className="hidden flex-wrap items-center justify-end gap-2 sm:flex">
                <Badge>{formatRoleLabel(user.role)}</Badge>
                <Badge tone={statusTone(userStatus)} dot>
                  {formatStatus(userStatus)}
                </Badge>
              </div>
              <Icon
                name="chevronDown"
                className="h-4 w-4 shrink-0 text-[#8a8780] transition-transform group-open:rotate-180"
              />
            </summary>

            <div className="border-t border-black/[0.06] px-4 py-5 sm:px-5">
              <div className="mb-4 flex flex-wrap items-center gap-2 sm:hidden">
                <Badge>{formatRoleLabel(user.role)}</Badge>
                <Badge tone={statusTone(userStatus)} dot>
                  {formatStatus(userStatus)}
                </Badge>
              </div>

              {isRestrictedRow ? (
                <div className="rounded-2xl bg-[#f6f5f1] p-4 text-[14px] text-[#55534e]">
                  You can view this account but not edit it from your current scope.
                </div>
              ) : (
                <form action={(formData) => handleSubmit(user._id, formData)} className="grid gap-4 md:grid-cols-2">
                  <Field label="First name">
                    <input name={`firstName-${user._id}`} defaultValue={user.firstName} className="ui-input" />
                  </Field>
                  <Field label="Last name">
                    <input name={`lastName-${user._id}`} defaultValue={user.lastName} className="ui-input" />
                  </Field>
                  <Field label="Email" className="md:col-span-2">
                    <input name={`email-${user._id}`} type="email" defaultValue={user.email} className="ui-input" />
                  </Field>
                  <Field label="Role">
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
                          {formatRoleLabel(role)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="New password" hint="Leave blank to keep the current password.">
                    <input
                      name={`password-${user._id}`}
                      type="password"
                      placeholder="Optional new password"
                      className="ui-input"
                    />
                  </Field>

                  {selectedRole === "super_admin" ? (
                    <div className="rounded-2xl bg-[#f6f5f1] p-4 text-[14px] text-[#55534e] md:col-span-2">
                      This account keeps overall oversight access.
                    </div>
                  ) : null}

                  {isNationalRole(selectedRole) ? (
                    isGlobalRole(currentUserRole) ? (
                      <Field label="National area" required className="md:col-span-2">
                        {regionSelect}
                      </Field>
                    ) : (
                      <Field label="National area" hint={READ_ONLY_HINT} className="md:col-span-2">
                        {regionReadOnly}
                      </Field>
                    )
                  ) : null}

                  {isDistrictRole(selectedRole) ? (
                    <>
                      {isGlobalRole(currentUserRole) ? (
                        <Field label="National area" required>
                          {regionSelect}
                        </Field>
                      ) : (
                        <Field label="National area" hint={READ_ONLY_HINT}>
                          {regionReadOnly}
                        </Field>
                      )}
                      <Field label="District" required>
                        <select
                          name={`district-${user._id}`}
                          defaultValue={user.district || ""}
                          className="ui-input"
                          required
                          disabled={availableDistricts.length === 0}
                        >
                          {availableDistricts.length === 0 ? (
                            <option value="">Create district first</option>
                          ) : null}
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
                    isBranchScopedRole(currentUserRole) ? (
                      <Field label="Branch" hint={READ_ONLY_HINT} className="md:col-span-2">
                        <input type="hidden" name={`branchId-${user._id}`} value={defaultBranchId ?? ""} />
                        <input
                          value={branchMap.get(defaultBranchId || "") || "Current branch scope"}
                          readOnly
                          className={READ_ONLY_INPUT}
                        />
                      </Field>
                    ) : (
                      <Field label="Branch" required className="md:col-span-2">
                        <select
                          name={`branchId-${user._id}`}
                          defaultValue={user.branchId || ""}
                          className="ui-input"
                          required
                        >
                          <option value="">Select branch</option>
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
                    National areas and districts are managed from{" "}
                    <a href="/structure" className="font-medium text-[#111111] underline underline-offset-2 hover:text-[#ea580c]">
                      Structure
                    </a>
                    .
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-4 md:col-span-2">
                    <label className="flex items-center gap-2.5 text-[14px] text-[#55534e]">
                      <input name={`isActive-${user._id}`} type="checkbox" defaultChecked={!!user.isActive} className="h-4 w-4" />
                      User can sign in
                    </label>
                    <Button type="submit" size="sm" disabled={loadingId === user._id}>
                      {loadingId === user._id ? "Saving..." : "Update user"}
                    </Button>
                  </div>
                </form>
              )}

              <p className="mt-4 flex items-center gap-1.5 text-[12px] text-[#8a8780]">
                <Icon name="clock" className="h-3.5 w-3.5" />
                {user.lastLoginAt
                  ? `Last signed in ${new Date(user.lastLoginAt).toLocaleString()}`
                  : "No sign-in recorded yet"}
              </p>
            </div>
          </details>
        );
      })}
      {status ? (
        <p role="status" className="rounded-xl bg-[#f6f5f1] px-4 py-3 text-[14px] text-[#55534e]">
          {status}
        </p>
      ) : null}
    </div>
  );
}
