import Link from "next/link";
import { MetricCard } from "@/components/metric-card";
import { OversightRegionEditorCard } from "@/components/oversight-region-editor-card";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { TeamPills } from "@/components/structure-cards";
import { UserCreateForm } from "@/components/user-create-form";
import { Icon } from "@/components/app/icons";
import { Badge, ButtonLink, Card, CardHeader, EmptyState } from "@/components/ui/ui";
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
      <div className="space-y-3">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#8a8780]">
          <Link href="/structure" className="rounded-md px-1 py-0.5 font-medium text-[#6b6b6b] transition-colors hover:bg-white hover:text-[#111111]">
            Structure
          </Link>
          <span aria-hidden>/</span>
          <span aria-current="page" className="px-1 font-medium text-[#111111]">
            {region.name}
          </span>
        </nav>
        <PageHeader
          eyebrow="National area"
          title={region.name}
          description="See the whole national area, drill into its districts and manage the national record without losing sight of the branches and leaders in its care."
          action={
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/structure" variant="secondary">
                Back to structure
              </ButtonLink>
              <ButtonLink href={`/users?oversightRegion=${encodeURIComponent(region.name)}`} icon="users">
                Open national staff
              </ButtonLink>
            </div>
          }
        />
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          label="Guests and members"
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

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="space-y-4">
          <OversightRegionEditorCard region={region} canEdit={canEdit} />

          {canCreateNationalLeadership ? (
            <Card className="app-rise p-1.5" style={{ animationDelay: "60ms" }}>
              <UserCreateForm
                branches={[]}
                currentUserRole={user.role}
                defaultOversightRegion={region.name}
                oversightRegions={[region]}
                districts={districtOptions}
                allowedRoles={["national_admin", "national_pastor"]}
                title="Add national leadership"
                description="Create national admins and national pastors inside this national area so they get the right scope straight away."
                submitLabel="Add national leader"
              />
            </Card>
          ) : null}

          <Card className="app-rise p-6 sm:p-7" style={{ animationDelay: "120ms" }}>
            <CardHeader label="National leadership" title="Who leads this area" />
            <div className="mt-5 grid gap-4">
              <div className="rounded-2xl bg-[#f6f5f1] p-4">
                <p className="text-[12px] font-medium text-[#6b6b6b]">National admins</p>
                <div className="mt-3">
                  <TeamPills
                    users={regionStructure.nationalAdmins}
                    emptyLabel="No national admin assigned in this national area."
                  />
                </div>
              </div>
              <div className="rounded-2xl bg-[#f6f5f1] p-4">
                <p className="text-[12px] font-medium text-[#6b6b6b]">National pastors</p>
                <div className="mt-3">
                  <TeamPills
                    users={regionStructure.nationalPastors}
                    emptyLabel="No national pastor assigned in this national area."
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card className="app-rise self-start p-6 sm:p-7" style={{ animationDelay: "60ms" }}>
          <CardHeader
            label="District drill-down"
            title="Districts in this area"
            description="Open a district to see its branches and teams."
            action={
              <Badge>
                <span className="tabular-nums">{regionStructure.districts.length}</span> districts
              </Badge>
            }
          />
          <div className="mt-6 space-y-4">
            {regionStructure.districts.length === 0 ? (
              <EmptyState icon="pin" title="No districts yet">
                No districts have been attached to this national area yet.
              </EmptyState>
            ) : (
              regionStructure.districts.map((district) => (
                <article
                  key={`${region.name}-${district.name}`}
                  className="rounded-2xl border border-black/[0.06] p-5 transition-colors hover:border-black/[0.12]"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f6f5f1] text-[#111111]">
                        <Icon name="pin" className="h-[18px] w-[18px]" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12px] text-[#8a8780]">District</p>
                        <h3 className="lp-heading text-[18px]">{district.name}</h3>
                        <p className="mt-1 text-[13px] text-[#6b6b6b]">
                          <span className="tabular-nums">{district.branchCount}</span> branches ·{" "}
                          <span className="tabular-nums">{district.guestCount}</span> guests ·{" "}
                          <span className="tabular-nums">{district.memberCount}</span> members
                        </p>
                      </div>
                    </div>
                    {districtIdByName.get(district.name) ? (
                      <ButtonLink href={`/structure/district/${districtIdByName.get(district.name)}`} size="sm">
                        Open district
                      </ButtonLink>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl bg-[#f6f5f1] p-4">
                      <p className="text-[12px] font-medium text-[#6b6b6b]">District admins</p>
                      <div className="mt-3">
                        <TeamPills
                          users={district.districtAdmins}
                          emptyLabel="No district admin assigned."
                        />
                      </div>
                    </div>
                    <div className="rounded-2xl bg-[#f6f5f1] p-4">
                      <p className="text-[12px] font-medium text-[#6b6b6b]">District pastors</p>
                      <div className="mt-3">
                        <TeamPills
                          users={district.districtPastors}
                          emptyLabel="No district pastor assigned."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <ButtonLink
                      href={`/structure?oversightRegion=${encodeURIComponent(region.name)}&district=${encodeURIComponent(district.name)}`}
                      variant="secondary"
                      size="sm"
                    >
                      Focus in overview
                    </ButtonLink>
                    <ButtonLink
                      href={`/users?oversightRegion=${encodeURIComponent(region.name)}&district=${encodeURIComponent(district.name)}`}
                      variant="ghost"
                      size="sm"
                      icon="users"
                    >
                      Open district staff
                    </ButtonLink>
                  </div>
                </article>
              ))
            )}
          </div>
        </Card>
      </section>
    </Shell>
  );
}
