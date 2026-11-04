"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createdHref } from "@/lib/directory";
import { Button, EmptyState, Field } from "@/components/ui/ui";
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

const READ_ONLY_HINT = "Set by your current scope.";
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
      router.push(createdHref(`/users?search=${encodeURIComponent(String(formData.get("email") || ""))}`, result, "User"));
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to create user");
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
      <input type="hidden" name="oversightRegion" value={defaultOversightRegion ?? ""} />
      <input value={defaultOversightRegion || "Current oversight region"} readOnly className={READ_ONLY_INPUT} />
    </>
  );

  return (
    <form action={handleSubmit} className={showHeader ? "rounded-2xl bg-white p-5 sm:p-6" : undefined}>
      {showHeader ? (
        <div className="mb-5">
          <h3 className="lp-heading text-[18px] leading-tight">{title}</h3>
          {description ? (
            <p className="mt-1.5 text-[14px] leading-[1.6] text-[#6b6b6b]">{description}</p>
          ) : null}
        </div>
      ) : null}

      {roleOptions.length === 0 ? (
        <EmptyState icon="users" title="No roles available">
          No user roles can be created from this scope.
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="First name" required>
              <input name="firstName" placeholder="First name" className="ui-input" required />
            </Field>
            <Field label="Last name" required>
              <input name="lastName" placeholder="Last name" className="ui-input" required />
            </Field>
            <Field label="Email" required className="md:col-span-2">
              <input name="email" type="email" placeholder="name@church.org" className="ui-input" required />
            </Field>
            <Field label="Temporary password" required hint="They can change it after signing in.">
              <input name="password" type="password" placeholder="Temporary password" className="ui-input" required />
            </Field>
            <Field label="Role" required>
              <select
                name="role"
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value)}
                className="ui-input"
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {formatRoleLabel(role)}
                  </option>
                ))}
              </select>
            </Field>

            {selectedRole === "super_admin" ? (
              <div className="rounded-2xl bg-[#f6f5f1] p-4 text-[14px] leading-[1.6] text-[#55534e] md:col-span-2">
                This account has overall oversight across every region, district, and branch.
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
                    name="district"
                    defaultValue=""
                    className="ui-input"
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
                </Field>
              </>
            ) : null}

            {isBranchScopedRole(selectedRole) ? (
              creatorIsBranchScoped ? (
                <Field label="Branch" hint={READ_ONLY_HINT} className="md:col-span-2">
                  <input type="hidden" name="branchId" value={defaultBranchId ?? ""} />
                  <input value={defaultBranchName || "Current branch scope"} readOnly className={READ_ONLY_INPUT} />
                </Field>
              ) : (
                <Field label="Branch" required className="md:col-span-2">
                  <select name="branchId" defaultValue="" className="ui-input" required>
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
          </div>

          <p className="mt-4 text-[13px] text-[#8a8780]">
            National areas and districts are managed from{" "}
            <a href="/structure" className="font-medium text-[#111111] underline underline-offset-2 hover:text-[#ea580c]">
              Structure
            </a>
            .
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-5">
            <label className="flex items-center gap-2.5 text-[14px] text-[#55534e]">
              <input name="isActive" type="checkbox" defaultChecked className="h-4 w-4" />
              Active immediately
            </label>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : submitLabel}
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
