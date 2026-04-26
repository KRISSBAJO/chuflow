import Link from "next/link";
import { DistrictEditorCard } from "@/components/district-editor-card";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { BranchCard, TeamPills } from "@/components/structure-cards";
import { UserCreateForm } from "@/components/user-create-form";
import { requireServerRole } from "@/lib/auth";
import {
  getManageableUserRoleOptions,
  isGlobalRole,
} from "@/lib/permissions";
import { serverGet } from "@/lib/server-api";
import type {
  DistrictOption,
  OrgStructureSummary,
  OversightRegionOption,
  DistrictStructureSummary,
} from "@/lib/types";

function buildFallbackDistrict(): DistrictStructureSummary {
  return {
    name: "",
    branchCount: 0,
    guestCount: 0,
    memberCount: 0,
    districtAdmins: [],
    districtPastors: [],
    branches: [],
  };
}

export default async function DistrictStructureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireServerRole("/structure");
  const { id } = await params;

  const [district, oversightRegions, structure] = await Promise.all([
    serverGet<DistrictOption>(`/districts/${id}`),
    serverGet<OversightRegionOption[]>("/oversight-regions"),
    serverGet<OrgStructureSummary>("/branches/structure"),
  ]);

  const regionStructure = structure.oversightRegions.find(
    (item) => item.name === district.oversightRegion,
  );
  const nationalAreaId =
    oversightRegions.find((item) => item.name === district.oversightRegion)?._id ??
    null;
  const nationalAreaHref = nationalAreaId
    ? `/structure/national/${nationalAreaId}`
    : "/structure";
  const districtStructure =
    regionStructure?.districts.find((item) => item.name === district.name) ??
    buildFallbackDistrict();
  const canEdit =
    isGlobalRole(user.role) ||
    (user.role === "national_admin" && user.oversightRegion === district.oversightRegion) ||
    (user.role === "district_admin" &&
      user.oversightRegion === district.oversightRegion &&
      user.district === district.name);
  const canCreateDistrictLeadership = getManageableUserRoleOptions(user.role).some((role) =>
    ["district_admin", "district_pastor"].includes(role),
  );
  const districtLeaderCount =
    districtStructure.districtAdmins.length + districtStructure.districtPastors.length;
  const supportStaffCount = districtStructure.branches.reduce(
    (total, branch) =>
      total + branch.followUpTeam.length + branch.ushers.length,
    0,
  );

  return (
    <Shell>
      <PageHeader
        eyebrow="District Detail"
        title={district.name}
        description="Open a district and see its branches, district leadership, and branch support teams in one scoped drill-down."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href={nationalAreaHref}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              Back to national area
            </Link>
            <Link
              href={`/users?oversightRegion=${encodeURIComponent(district.oversightRegion)}&district=${encodeURIComponent(district.name)}`}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Open district staff
            </Link>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Branches"
          value={districtStructure.branchCount}
          delta="Branches in this district"
          tone="warm"
        />
        <MetricCard
          label="Guests"
          value={districtStructure.guestCount}
          delta="Visible guest records across district branches"
          tone="cool"
        />
        <MetricCard
          label="Members"
          value={districtStructure.memberCount}
          delta="Visible member records across district branches"
          tone="warm"
        />
        <MetricCard
          label="Leaders + Support"
          value={districtLeaderCount + supportStaffCount}
          delta={`${districtLeaderCount} district leaders · ${supportStaffCount} support staff`}
          tone="cool"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-4">
          <DistrictEditorCard
            district={district}
            oversightRegions={oversightRegions}
            canEdit={canEdit}
            canChangeOversightRegion={isGlobalRole(user.role)}
          />

          {canCreateDistrictLeadership ? (
            <section className="surface rounded-[28px] p-1.5">
              <UserCreateForm
                branches={[]}
                currentUserRole={user.role}
                defaultOversightRegion={district.oversightRegion}
                defaultDistrict={district.name}
                oversightRegions={oversightRegions.filter(
                  (region) => region.name === district.oversightRegion,
                )}
                districts={[district]}
                allowedRoles={["district_admin", "district_pastor"]}
                title="Add district leadership"
                description="Create district admins and district pastors right inside this district so leadership stays attached to the correct district scope."
                submitLabel="Add district leader"
              />
            </section>
          ) : null}

          <section className="surface rounded-[28px] p-6">
            <p className="eyebrow">District Leadership</p>
            <div className="mt-4 grid gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  District Admins
                </p>
                <div className="mt-3">
                  <TeamPills
                    users={districtStructure.districtAdmins}
                    emptyLabel="No district admin assigned."
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  District Pastors
                </p>
                <div className="mt-3">
                  <TeamPills
                    users={districtStructure.districtPastors}
                    emptyLabel="No district pastor assigned."
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  National Area
                </p>
                <div className="mt-3">
                  <Link
                    href={nationalAreaHref}
                    className="inline-flex rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    {district.oversightRegion}
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="surface rounded-[28px] p-6">
          <p className="eyebrow">Branches In District</p>
          <div className="mt-4 grid gap-4">
            {districtStructure.branches.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
                No branches are currently attached to this district.
              </div>
            ) : (
              districtStructure.branches.map((branch) => (
                <BranchCard key={branch._id} branch={branch} />
              ))
            )}
          </div>
        </section>
      </section>
    </Shell>
  );
}
