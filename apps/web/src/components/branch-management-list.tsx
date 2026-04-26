"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";
import { PastoralLeadershipCard } from "@/components/structure-cards";
import { ShareLinkCard } from "@/components/share-link-card";
import {
  canManageBranchStructure,
  isDistrictRole,
  isGlobalRole,
} from "@/lib/permissions";
import type {
  BranchOverview,
  DistrictOption,
  IntakeTemplate,
  OversightRegionOption,
} from "@/lib/types";

export function BranchManagementList({
  branches,
  currentUserRole,
  defaultOversightRegion,
  defaultDistrict,
  oversightRegions,
  districts,
  templates,
}: {
  branches: BranchOverview[];
  currentUserRole: string;
  defaultOversightRegion?: string;
  defaultDistrict?: string;
  oversightRegions: OversightRegionOption[];
  districts: DistrictOption[];
  templates: IntakeTemplate[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [selectedRegions, setSelectedRegions] = useState<Record<string, string>>(
    {},
  );
  const canEdit = canManageBranchStructure(currentUserRole);
  const activeAttendanceTemplates = useMemo(
    () => templates.filter((template) => template.kind === "attendance" && template.isActive),
    [templates],
  );

  function getSelectedRegion(branchId: string, fallbackRegion: string) {
    return selectedRegions[branchId] || fallbackRegion;
  }

  function getAvailableDistricts(branchId: string, fallbackRegion: string) {
    const activeRegion = isGlobalRole(currentUserRole)
      ? getSelectedRegion(branchId, fallbackRegion)
      : defaultOversightRegion || fallbackRegion;

    if (isDistrictRole(currentUserRole) && defaultDistrict) {
      return districts.filter((district) => district.name === defaultDistrict);
    }

    return districts.filter((district) => district.oversightRegion === activeRegion);
  }

  function getAttendanceShareUrl(branchId: string) {
    const template =
      activeAttendanceTemplates.find((item) => item.branchId === branchId) ||
      activeAttendanceTemplates[0];

    if (!template) {
      return null;
    }

    const baseUrl = template.shareUrl || `/intake/${template.slug}`;
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}branchId=${encodeURIComponent(branchId)}`;
  }

  async function handleSubmit(branchId: string, formData: FormData) {
    setLoadingId(branchId);
    setStatus(null);

    try {
      const response = await fetch(`${API_URL}/branches/${branchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: formData.get(`name-${branchId}`),
          oversightRegion: formData.get(`oversightRegion-${branchId}`),
          district: formData.get(`district-${branchId}`),
          address: formData.get(`address-${branchId}`),
          city: formData.get(`city-${branchId}`),
          state: formData.get(`state-${branchId}`),
          country: formData.get(`country-${branchId}`),
          contactInfo: formData.get(`contactInfo-${branchId}`),
          serviceTimes: formData.get(`serviceTimes-${branchId}`),
          status: formData.get(`status-${branchId}`),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to update branch");
      }

      setStatus("Branch updated successfully.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to update branch");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {branches.map((branch) => {
        const availableDistricts = getAvailableDistricts(
          branch._id,
          branch.oversightRegion,
        );
        const residentPastorNames = branch.residentPastors.map(
          (user) => `${user.firstName} ${user.lastName}`,
        );
        const associatePastorNames = branch.associatePastors.map(
          (user) => `${user.firstName} ${user.lastName}`,
        );
        const residentPastorCount = branch.residentPastors.length;
        const associatePastorCount = branch.associatePastors.length;
        const attendanceShareUrl = getAttendanceShareUrl(branch._id);

        return (
          <details key={branch._id} className="rounded-[22px] border border-slate-200 bg-white">
            <summary className="cursor-pointer list-none px-4 py-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-slate-900">{branch.name}</p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                        branch.status === "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {branch.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {branch.city}, {branch.state} · {branch.district} · {branch.oversightRegion}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Guests</p>
                    <p className="mt-1 font-semibold text-slate-900">{branch.metrics.guestCount}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Members</p>
                    <p className="mt-1 font-semibold text-slate-900">{branch.metrics.memberCount}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Admins</p>
                    <p className="mt-1 font-semibold text-slate-900">{branch.metrics.branchAdminCount}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Pastors</p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {residentPastorCount + associatePastorCount}
                    </p>
                  </div>
                </div>
              </div>
              {residentPastorCount === 0 || associatePastorCount === 0 ? (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-amber-50 px-3 py-1.5 font-semibold text-amber-700">
                    {residentPastorCount === 0 && associatePastorCount === 0
                      ? "Resident pastor and associate pastor still need assignment"
                      : residentPastorCount === 0
                        ? "Resident pastor still needs assignment"
                        : "Associate pastor still needs assignment"}
                  </span>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">
                    Resident pastor: {residentPastorNames.join(", ")}
                  </span>
                  <span className="rounded-full bg-sky-50 px-3 py-1.5 font-semibold text-sky-700">
                    Associate pastor: {associatePastorNames.join(", ")}
                  </span>
                </div>
              )}
            </summary>
            <div className="border-t border-slate-200 px-4 py-4">
              <div className="grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
                <div className="space-y-3">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Branch admins</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {branch.admins.length > 0 ? (
                        branch.admins.map((user) => (
                          <span key={user._id} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                            {user.firstName} {user.lastName}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">No branch admin assigned yet.</span>
                      )}
                    </div>
                  </div>
                  <PastoralLeadershipCard
                    residentPastors={branch.residentPastors}
                    associatePastors={branch.associatePastors}
                  />
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Follow-up team</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {branch.followUpTeam.length > 0 ? (
                        branch.followUpTeam.map((user) => (
                          <span key={user._id} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                            {user.firstName} {user.lastName}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">No follow-up staff assigned.</span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Usher team</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {branch.ushers.length > 0 ? (
                        branch.ushers.map((user) => (
                          <span key={user._id} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                            {user.firstName} {user.lastName}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">No usher staff assigned.</span>
                      )}
                    </div>
                  </div>
                  {attendanceShareUrl ? (
                    <ShareLinkCard
                      title="Attendance entry link"
                      url={attendanceShareUrl}
                      description="Send this to branch staff or service leads so they can submit attendance for approval."
                    />
                  ) : null}
                  <a
                    href={`/users?branchId=${branch._id}`}
                    className="inline-flex rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    Open branch staff
                  </a>
                </div>
                {canEdit ? (
                  <form action={(formData) => handleSubmit(branch._id, formData)} className="grid gap-2.5 md:grid-cols-2">
                    <input
                      name={`name-${branch._id}`}
                      defaultValue={branch.name}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                    />
                    <input
                      name={`status-${branch._id}`}
                      defaultValue={branch.status}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                    />

                    {isGlobalRole(currentUserRole) ? (
                      <select
                        name={`oversightRegion-${branch._id}`}
                        value={getSelectedRegion(branch._id, branch.oversightRegion)}
                        onChange={(event) =>
                          setSelectedRegions((current) => ({
                            ...current,
                            [branch._id]: event.target.value,
                          }))
                        }
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                      >
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
                          name={`oversightRegion-${branch._id}`}
                          value={defaultOversightRegion ?? branch.oversightRegion}
                        />
                        <input
                          value={defaultOversightRegion || branch.oversightRegion}
                          readOnly
                          className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-500 outline-none"
                        />
                      </>
                    )}

                    {isDistrictRole(currentUserRole) ? (
                      <>
                        <input
                          type="hidden"
                          name={`district-${branch._id}`}
                          value={defaultDistrict ?? branch.district}
                        />
                        <input
                          value={defaultDistrict || branch.district}
                          readOnly
                          className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-500 outline-none"
                        />
                      </>
                    ) : (
                      <select
                        name={`district-${branch._id}`}
                        defaultValue={branch.district}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
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
                    )}

                    <input
                      name={`city-${branch._id}`}
                      defaultValue={branch.city}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                    />
                    <input
                      name={`state-${branch._id}`}
                      defaultValue={branch.state}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                    />
                    <input
                      name={`country-${branch._id}`}
                      defaultValue={branch.country}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                    />
                    <input
                      name={`serviceTimes-${branch._id}`}
                      defaultValue={branch.serviceTimes}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                    />
                    <input
                      name={`contactInfo-${branch._id}`}
                      defaultValue={branch.contactInfo}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none md:col-span-2"
                    />
                    <input
                      name={`address-${branch._id}`}
                      defaultValue={branch.address}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none md:col-span-2"
                    />
                    <p className="md:col-span-2 text-xs text-slate-500">
                      National areas and districts are managed from{" "}
                      <a href="/structure" className="font-semibold text-slate-900 underline">
                        Structure
                      </a>
                      .
                    </p>
                    <button
                      type="submit"
                      disabled={
                        loadingId === branch._id ||
                        (!isDistrictRole(currentUserRole) && availableDistricts.length === 0)
                      }
                      className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white md:w-fit"
                    >
                      {loadingId === branch._id ? "Saving..." : "Update branch"}
                    </button>
                  </form>
                ) : (
                  <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                    Branch leadership can review staffing, regional placement, member load, and guest movement here. Structural branch edits stay with the admin layer for this scope.
                  </div>
                )}
              </div>
            </div>
          </details>
        );
      })}
      {status ? <p className="text-sm text-slate-600">{status}</p> : null}
    </div>
  );
}
