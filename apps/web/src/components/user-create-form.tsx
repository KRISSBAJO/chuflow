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
} from "@/lib/permissions";
import type {
  BranchSummary,
  DistrictOption,
  OversightRegionOption,
} from "@/lib/types";

export function UserCreateForm({
  branches,
  currentUserRole,
  defaultBranchId,
  defaultOversightRegion,
  defaultDistrict,
  oversightRegions,
  districts,
  allowedRoles,
  title = "Create user",
  description,
  submitLabel = "Create user",
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
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const creatorIsBranchScoped = isBranchScopedRole(currentUserRole);
  const defaultBranchName = branches.find((branch) => branch._id === defaultBranchId)?.name;
  const manageableRoles = getManageableUserRoleOptions(currentUserRole);
  const roleOptions = allowedRoles
    ? manageableRoles.filter((role) => allowedRoles.includes(role))
    : manageableRoles;
  const [selectedRole, setSelectedRole] = useState<string>(roleOptions[0] || "follow_up");
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
        throw new Error(result.message || "Unable to create user");
      }

      setStatus("User created successfully.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to create user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="rounded-[22px] bg-white p-4">
      {showHeader ? (
        <>
          <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
          ) : null}
        </>
      ) : null}
      {roleOptions.length === 0 ? (
        <p className={`${showHeader ? "mt-4" : ""} rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500`}>
          No user roles can be created from this scope.
        </p>
      ) : (
        <>
      <div className={`${showHeader ? "mt-4" : ""} grid gap-2.5 md:grid-cols-2`}>
        <input name="firstName" placeholder="First name" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none" required />
        <input name="lastName" placeholder="Last name" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none" required />
        <input name="email" type="email" placeholder="Email" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none md:col-span-2" required />
        <input name="password" type="password" placeholder="Temporary password" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none" required />
        <select
          name="role"
          value={selectedRole}
          onChange={(event) => setSelectedRole(event.target.value)}
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
              This account has overall oversight across every region, district, and branch.
            </div>
          ) : null}

          {isNationalRole(selectedRole) ? (
            isGlobalRole(currentUserRole) ? (
              <select
                name="oversightRegion"
                value={selectedOversightRegion}
                onChange={(event) => setSelectedOversightRegion(event.target.value)}
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
                <input type="hidden" name="oversightRegion" value={defaultOversightRegion ?? ""} />
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
                  name="oversightRegion"
                  value={selectedOversightRegion}
                  onChange={(event) => setSelectedOversightRegion(event.target.value)}
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
                  <input type="hidden" name="oversightRegion" value={defaultOversightRegion ?? ""} />
                  <input
                    value={defaultOversightRegion || "Current oversight region"}
                    readOnly
                    className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-500 outline-none"
                  />
                </>
              )}
              <select
                name="district"
                defaultValue=""
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                required
                disabled={availableDistricts.length === 0}
              >
                <option value="">
                  {availableDistricts.length === 0 ? "Create district first" : "Select district"}
                </option>
                {availableDistricts.map((district) => (
                  <option key={district._id} value={district.name}>
                    {district.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {isBranchScopedRole(selectedRole) ? (
            creatorIsBranchScoped ? (
              <>
                <input type="hidden" name="branchId" value={defaultBranchId ?? ""} />
                <input
                  value={defaultBranchName || "Current branch scope"}
                  readOnly
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-500 outline-none"
                />
              </>
            ) : (
              <select
                name="branchId"
                defaultValue=""
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
      </div>
      <p className="mt-4 text-xs text-slate-500">
        National areas and districts are managed from{" "}
        <a href="/structure" className="font-semibold text-slate-900 underline">
          Structure
        </a>
        .
      </p>
      <label className="mt-4 flex items-center gap-2 text-sm text-slate-600">
        <input name="isActive" type="checkbox" defaultChecked className="h-4 w-4 rounded border-slate-300" />
        Active immediately
      </label>
      <button type="submit" disabled={loading} className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">
        {loading ? "Saving..." : submitLabel}
      </button>
        </>
      )}
      {status ? <p className="mt-3 text-sm text-slate-600">{status}</p> : null}
    </form>
  );
}
