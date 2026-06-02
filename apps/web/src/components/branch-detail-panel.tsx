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

export function BranchDetailPanel({
  branch,
  currentUserRole,
  defaultOversightRegion,
  defaultDistrict,
  oversightRegions,
  districts,
  templates,
}: {
  branch: BranchOverview;
  currentUserRole: string;
  defaultOversightRegion?: string;
  defaultDistrict?: string;
  oversightRegions: OversightRegionOption[];
  districts: DistrictOption[];
  templates: IntakeTemplate[];
}) {
  const router = useRouter();
  const canEdit = canManageBranchStructure(currentUserRole);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState(
    defaultOversightRegion || branch.oversightRegion,
  );
  const attendanceTemplate = templates.find(
    (template) =>
      template.kind === "attendance" &&
      template.isActive &&
      template.branchId === branch._id,
  ) || templates.find((template) => template.kind === "attendance" && template.isActive);
  const attendanceShareUrl = attendanceTemplate
    ? `${attendanceTemplate.shareUrl || `/intake/${attendanceTemplate.slug}`}${
        (attendanceTemplate.shareUrl || attendanceTemplate.slug).includes("?") ? "&" : "?"
      }branchId=${encodeURIComponent(branch._id)}`
    : null;
  const weeklyReportTemplate = templates.find(
    (template) =>
      template.kind === "weekly_report" &&
      template.isActive &&
      template.branchId === branch._id,
  ) || templates.find(
    (template) =>
      template.kind === "weekly_report" &&
      template.isActive &&
      template.oversightRegion === branch.oversightRegion &&
      template.district === branch.district,
  ) || templates.find((template) => template.kind === "weekly_report" && template.isActive);
  const weeklyReportShareUrl = weeklyReportTemplate
    ? `${weeklyReportTemplate.shareUrl || `/intake/${weeklyReportTemplate.slug}`}${
        (weeklyReportTemplate.shareUrl || weeklyReportTemplate.slug).includes("?") ? "&" : "?"
      }branchId=${encodeURIComponent(branch._id)}`
    : null;

  const availableDistricts = useMemo(() => {
    if (isDistrictRole(currentUserRole) && defaultDistrict) {
      return districts.filter((district) => district.name === defaultDistrict);
    }

    const region = isGlobalRole(currentUserRole)
      ? selectedRegion
      : defaultOversightRegion || branch.oversightRegion;

    return districts.filter((district) => district.oversightRegion === region);
  }, [
    branch.oversightRegion,
    currentUserRole,
    defaultDistrict,
    defaultOversightRegion,
    districts,
    selectedRegion,
  ]);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch(`${API_URL}/branches/${branch._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: formData.get("name"),
          oversightRegion: formData.get("oversightRegion"),
          district: formData.get("district"),
          address: formData.get("address"),
          city: formData.get("city"),
          state: formData.get("state"),
          country: formData.get("country"),
          contactInfo: formData.get("contactInfo"),
          serviceTimes: formData.get("serviceTimes"),
          status: formData.get("status"),
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
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-6">
        <section className="surface rounded-[24px] p-6">
          <p className="eyebrow">Operating Snapshot</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["Guests", branch.metrics.guestCount],
              ["Members", branch.metrics.memberCount],
              ["Branch admins", branch.metrics.branchAdminCount],
              ["Support team", branch.metrics.followUpCount + branch.metrics.usherCount],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="surface rounded-[24px] p-6">
          <p className="eyebrow">Leadership</p>
          <div className="mt-4 space-y-4">
            <TeamBlock title="Branch admins" users={branch.admins} empty="No branch admin assigned." />
            <PastoralLeadershipCard
              residentPastors={branch.residentPastors}
              associatePastors={branch.associatePastors}
            />
            <TeamBlock title="Follow-up team" users={branch.followUpTeam} empty="No follow-up staff assigned." />
            <TeamBlock title="Usher team" users={branch.ushers} empty="No usher staff assigned." />
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href={`/users?branchId=${branch._id}`}
            className="rounded-xl bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white"
          >
            Open branch staff
          </a>
          <a
            href={`/guests?branchId=${branch._id}`}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700"
          >
            Open branch guests
          </a>
        </div>

        {attendanceShareUrl ? (
          <ShareLinkCard
            title="Attendance entry link"
            url={attendanceShareUrl}
            description="Share this with branch staff or service leads for attendance submission."
          />
        ) : null}
        {weeklyReportShareUrl ? (
          <ShareLinkCard
            title="Weekly report link"
            url={weeklyReportShareUrl}
            description="Send this branch-scoped spiritual indices report to branch leaders for weekly district reporting."
          />
        ) : null}
      </div>

      <section className="surface rounded-[24px] p-6">
        <p className="eyebrow">Branch Profile</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">Manage branch details</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Update the branch identity, location, contact details, and operating status without crowding the directory.
        </p>

        {canEdit ? (
          <form action={handleSubmit} className="mt-6 grid gap-3 md:grid-cols-2">
            <input name="name" defaultValue={branch.name} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none" />
            <input name="status" defaultValue={branch.status} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none" />

            {isGlobalRole(currentUserRole) ? (
              <select
                name="oversightRegion"
                value={selectedRegion}
                onChange={(event) => setSelectedRegion(event.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none"
              >
                {oversightRegions.map((region) => (
                  <option key={region._id} value={region.name}>
                    {region.name}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input type="hidden" name="oversightRegion" value={defaultOversightRegion ?? branch.oversightRegion} />
                <input value={defaultOversightRegion || branch.oversightRegion} readOnly className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-3 text-sm text-slate-500 outline-none" />
              </>
            )}

            {isDistrictRole(currentUserRole) ? (
              <>
                <input type="hidden" name="district" value={defaultDistrict ?? branch.district} />
                <input value={defaultDistrict || branch.district} readOnly className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-3 text-sm text-slate-500 outline-none" />
              </>
            ) : (
              <select
                name="district"
                defaultValue={branch.district}
                disabled={availableDistricts.length === 0}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none"
              >
                {availableDistricts.length === 0 ? <option value="">Create district first</option> : null}
                {availableDistricts.map((district) => (
                  <option key={district._id} value={district.name}>
                    {district.name}
                  </option>
                ))}
              </select>
            )}

            <input name="city" defaultValue={branch.city} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none" />
            <input name="state" defaultValue={branch.state} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none" />
            <input name="country" defaultValue={branch.country} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none" />
            <input name="serviceTimes" defaultValue={branch.serviceTimes} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none" />
            <input name="contactInfo" defaultValue={branch.contactInfo} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none md:col-span-2" />
            <input name="address" defaultValue={branch.address} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none md:col-span-2" />
            <p className="text-xs text-slate-500 md:col-span-2">
              National areas and districts are managed from{" "}
              <a href="/structure" className="font-semibold text-slate-900 underline">
                Structure
              </a>
              .
            </p>
            <button
              type="submit"
              disabled={loading || (!isDistrictRole(currentUserRole) && availableDistricts.length === 0)}
              className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white md:w-fit"
            >
              {loading ? "Saving..." : "Update branch"}
            </button>
            {status ? <p className="text-sm text-slate-600 md:col-span-2">{status}</p> : null}
          </form>
        ) : (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm leading-6 text-slate-600">
            You can review staffing, regional placement, member load, and guest movement here. Structural branch edits stay with the admin layer for this scope.
          </div>
        )}
      </section>
    </div>
  );
}

function TeamBlock({
  title,
  users,
  empty,
}: {
  title: string;
  users: BranchOverview["admins"];
  empty: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
        {title}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {users.length > 0 ? (
          users.map((user) => (
            <span key={user._id} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
              {user.firstName} {user.lastName}
            </span>
          ))
        ) : (
          <span className="text-sm text-slate-500">{empty}</span>
        )}
      </div>
    </div>
  );
}
