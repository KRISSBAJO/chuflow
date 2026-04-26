import Link from "next/link";
import { MetricCard } from "@/components/metric-card";
import { OversightRegionEditorCard } from "@/components/oversight-region-editor-card";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { TeamPills } from "@/components/structure-cards";
import { UserCreateForm } from "@/components/user-create-form";
import { requireServerRole } from "@/lib/auth";
import {
  formatRoleLabel,
  getManageableUserRoleOptions,
  isGlobalRole,
} from "@/lib/permissions";
import { serverGet } from "@/lib/server-api";
import type {
  DistrictOption,
  OrgStructureSummary,
  OversightRegionOption,
  OversightRegionStructureSummary,
} from "@/lib/types";

function buildFallbackRegion(region: OversightRegionOption): OversightRegionStructureSummary {
  return {
    name: region.name,
    districtCount: 0,
    branchCount: region.branchCount,
    guestCount: 0,
    memberCount: 0,
    nationalAdmins: [],
    nationalPastors: [],
    districts: [],
  };
}

export default async function NationalStructureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireServerRole("/structure");
  const { id } = await params;
  const region = await serverGet<OversightRegionOption>(`/oversight-regions/${id}`);
  const [structure, districtOptions] = await Promise.all([
    serverGet<OrgStructureSummary>("/branches/structure"),
    serverGet<DistrictOption[]>(
      `/districts?oversightRegion=${encodeURIComponent(region.name)}`,
    ),
  ]);

  const regionStructure =
    structure.oversightRegions.find((item) => item.name === region.name) ??
    buildFallbackRegion(region);
  const districtIdByName = new Map(
    districtOptions.map((district) => [district.name, district._id]),
  );
  const canEdit =
    isGlobalRole(user.role) ||
    (user.role === "national_admin" && user.oversightRegion === region.name);
  const canCreateNationalLeadership = getManageableUserRoleOptions(user.role).some((role) =>
    ["national_admin", "national_pastor"].includes(role),
  );
  const nationalLeaderCount =
    regionStructure.nationalAdmins.length + regionStructure.nationalPastors.length;
  const districtLeaderCount = regionStructure.districts.reduce(
    (total, district) =>
      total + district.districtAdmins.length + district.districtPastors.length,
    0,
  );

  return (
    <Shell>
      <PageHeader
        eyebrow="National Detail"
        title={region.name}
        description="Inspect the full national area, drill into districts underneath it, and manage the national record without losing sight of the branches and leaders under its care."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/structure"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              Back to structure
            </Link>
            <Link
              href={`/users?oversightRegion=${encodeURIComponent(region.name)}`}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Open national staff
            </Link>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Districts"
          value={regionStructure.districts.length}
          delta="Managed districts in this national area"
          tone="warm"
        />
        <MetricCard
          label="Branches"
          value={regionStructure.branchCount}
          delta="Branches currently attached here"
          tone="cool"
        />
        <MetricCard
          label="Guests + Members"
          value={regionStructure.guestCount + regionStructure.memberCount}
          delta={`${regionStructure.guestCount} guests · ${regionStructure.memberCount} members`}
          tone="warm"
        />
        <MetricCard
          label="Leaders"
          value={nationalLeaderCount + districtLeaderCount}
          delta={`${formatRoleLabel(user.role)} view`}
          tone="cool"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-4">
          <OversightRegionEditorCard region={region} canEdit={canEdit} />

          {canCreateNationalLeadership ? (
            <section className="surface rounded-[28px] p-1.5">
              <UserCreateForm
                branches={[]}
                currentUserRole={user.role}
                defaultOversightRegion={region.name}
                oversightRegions={[region]}
                districts={districtOptions}
                allowedRoles={["national_admin", "national_pastor"]}
                title="Add national leadership"
                description="Create national admins and national pastors directly inside this national area so they inherit the correct scope immediately."
                submitLabel="Add national leader"
              />
            </section>
          ) : null}

          <section className="surface rounded-[28px] p-6">
            <p className="eyebrow">National Leadership</p>
            <div className="mt-4 grid gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-500">
                  National Admins
                </p>
                <div className="mt-3">
                  <TeamPills
                    users={regionStructure.nationalAdmins}
                    emptyLabel="No national admin assigned in this national area."
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-600">
                  National Pastors
                </p>
                <div className="mt-3">
                  <TeamPills
                    users={regionStructure.nationalPastors}
                    emptyLabel="No national pastor assigned in this national area."
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="surface rounded-[28px] p-6">
          <p className="eyebrow">District Drill-Down</p>
          <div className="mt-4 space-y-4">
            {regionStructure.districts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
                No districts have been attached to this national area yet.
              </div>
            ) : (
              regionStructure.districts.map((district) => (
                <article
                  key={`${region.name}-${district.name}`}
                  className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        District
                      </p>
                      <h2 className="mt-2 text-xl font-semibold text-slate-950">
                        {district.name}
                      </h2>
                      <p className="mt-2 text-sm text-slate-500">
                        {district.branchCount} branches · {district.guestCount} guests ·{" "}
                        {district.memberCount} members
                      </p>
                    </div>
                    {districtIdByName.get(district.name) ? (
                      <Link
                        href={`/structure/district/${districtIdByName.get(district.name)}`}
                        className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
                      >
                        Open district
                      </Link>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        District Admins
                      </p>
                      <div className="mt-3">
                        <TeamPills
                          users={district.districtAdmins}
                          emptyLabel="No district admin assigned."
                        />
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        District Pastors
                      </p>
                      <div className="mt-3">
                        <TeamPills
                          users={district.districtPastors}
                          emptyLabel="No district pastor assigned."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/structure?oversightRegion=${encodeURIComponent(region.name)}&district=${encodeURIComponent(district.name)}`}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                    >
                      Focus in overview
                    </Link>
                    <Link
                      href={`/users?oversightRegion=${encodeURIComponent(region.name)}&district=${encodeURIComponent(district.name)}`}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                    >
                      Open district staff
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </section>
    </Shell>
  );
}
