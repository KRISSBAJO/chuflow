"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

        return (
          <details key={user._id} className="rounded-[22px] border border-slate-200 bg-white">
            <summary className="cursor-pointer list-none px-4 py-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-semibold text-slate-900">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{user.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
                    {formatRoleLabel(user.role)}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 font-semibold ${
                      user.isActive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {user.isActive ? "active" : "inactive"}
                  </span>
                  <span className="rounded-full bg-orange-50 px-2.5 py-1 font-semibold text-orange-700">
                    {getScopeLabel(user)}
                  </span>
                </div>
              </div>
            </summary>
            <div className="border-t border-slate-200 px-4 py-4">
              {isRestrictedRow ? (
                <div className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
                  This record is view-only in your current management scope.
                </div>
              ) : (
                <form action={(formData) => handleSubmit(user._id, formData)} className="grid gap-2.5 md:grid-cols-2">
                  <input name={`firstName-${user._id}`} defaultValue={user.firstName} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none" />
                  <input name={`lastName-${user._id}`} defaultValue={user.lastName} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none" />
                  <input name={`email-${user._id}`} type="email" defaultValue={user.email} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none md:col-span-2" />
                  <select
                    name={`role-${user._id}`}
                    value={selectedRole}
                    onChange={(event) =>
                      setSelectedRoles((current) => ({
                        ...current,
                        [user._id]: event.target.value,
                      }))
                    }
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {formatRoleLabel(role)}
                      </option>
                    ))}
                  </select>

                  <div className="md:col-span-2">
                    {selectedRole === "super_admin" ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
                        This account keeps overall oversight access.
                      </div>
                    ) : null}

                    {isNationalRole(selectedRole) ? (
                      isGlobalRole(currentUserRole) ? (
                        <select
                          name={`oversightRegion-${user._id}`}
                          value={getSelectedRegion(user._id, user.oversightRegion)}
                          onChange={(event) =>
                            setSelectedRegions((current) => ({
                              ...current,
                              [user._id]: event.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                          required
                        >
                          <option value="">Select national area</option>
                          {oversightRegions.map((region) => (
                            <option key={region._id} value={region.name}>
                              {region.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <>
                          <input
                            type="hidden"
                            name={`oversightRegion-${user._id}`}
                            value={defaultOversightRegion ?? ""}
                          />
                          <input
                            value={defaultOversightRegion || "Current oversight region"}
                            readOnly
                            className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-500 outline-none"
                          />
                        </>
                      )
                    ) : null}

                    {isDistrictRole(selectedRole) ? (
                      <div className="grid gap-2.5 md:grid-cols-2">
                        {isGlobalRole(currentUserRole) ? (
                          <select
                            name={`oversightRegion-${user._id}`}
                            value={getSelectedRegion(user._id, user.oversightRegion)}
                            onChange={(event) =>
                              setSelectedRegions((current) => ({
                                ...current,
                                [user._id]: event.target.value,
                              }))
                            }
                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                            required
                          >
                            <option value="">Select national area</option>
                            {oversightRegions.map((region) => (
                              <option key={region._id} value={region.name}>
                                {region.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <>
                            <input
                              type="hidden"
                              name={`oversightRegion-${user._id}`}
                              value={defaultOversightRegion ?? ""}
                            />
                            <input
                              value={defaultOversightRegion || "Current oversight region"}
                              readOnly
                              className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-500 outline-none"
                            />
                          </>
                        )}
                        <select
                          name={`district-${user._id}`}
                          defaultValue={user.district || ""}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
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
                      </div>
                    ) : null}

                    {isBranchScopedRole(selectedRole) ? (
                      isBranchScopedRole(currentUserRole) ? (
                        <>
                          <input type="hidden" name={`branchId-${user._id}`} value={defaultBranchId ?? ""} />
                          <input
                            value={branchMap.get(defaultBranchId || "") || "Current branch scope"}
                            readOnly
                            className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-500 outline-none"
                          />
                        </>
                      ) : (
                        <select
                          name={`branchId-${user._id}`}
                          defaultValue={user.branchId || ""}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                          required
                        >
                          <option value="">Select branch</option>
                          {branches.map((branch) => (
                            <option key={branch._id} value={branch._id}>
                              {branch.name}
                            </option>
                          ))}
                        </select>
                      )
                    ) : null}
                  </div>

                  <input name={`password-${user._id}`} type="password" placeholder="Optional new password" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none md:col-span-2" />
                  <p className="md:col-span-2 text-xs text-slate-500">
                    National areas and districts are managed from{" "}
                    <a href="/structure" className="font-semibold text-slate-900 underline">
                      Structure
                    </a>
                    .
                  </p>
                  <label className="flex items-center gap-2 text-sm text-slate-600 md:col-span-2">
                    <input name={`isActive-${user._id}`} type="checkbox" defaultChecked={!!user.isActive} className="h-4 w-4 rounded border-slate-300" />
                    User can sign in
                  </label>
                  <button type="submit" disabled={loadingId === user._id} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white md:col-span-2 md:w-fit">
                    {loadingId === user._id ? "Saving..." : "Update user"}
                  </button>
                </form>
              )}
              {user.lastLoginAt ? (
                <p className="mt-3 text-xs uppercase tracking-[0.14em] text-slate-400">
                  Last login {new Date(user.lastLoginAt).toLocaleString()}
                </p>
              ) : (
                <p className="mt-3 text-xs uppercase tracking-[0.14em] text-slate-400">No login recorded yet</p>
              )}
            </div>
          </details>
        );
      })}
      {status ? <p className="text-sm text-slate-600">{status}</p> : null}
    </div>
  );
}
