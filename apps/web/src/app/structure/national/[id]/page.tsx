import Link from "next/link";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("org.structureNational");
  const tRoles = await getTranslations("roles");
  const roleLabel = (value: string) =>
    tRoles.has(value as Parameters<typeof tRoles>[0]) ? tRoles(value as Parameters<typeof tRoles>[0]) : formatRoleLabel(value);
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
        <nav aria-label={t("breadcrumb")} className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#8a8780]">
          <Link href="/structure" className="rounded-md px-1 py-0.5 font-medium text-[#6b6b6b] transition-colors hover:bg-white hover:text-[#111111]">
            {t("structure")}
          </Link>
          <span aria-hidden>/</span>
          <span aria-current="page" className="px-1 font-medium text-[#111111]">
            {region.name}
          </span>
        </nav>
        <PageHeader
          eyebrow={t("eyebrow")}
          title={region.name}
          description={t("description")}
          action={
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/structure" variant="secondary">
                {t("backToStructure")}
              </ButtonLink>
              <ButtonLink href={`/users?oversightRegion=${encodeURIComponent(region.name)}`} icon="users">
                {t("openStaff")}
              </ButtonLink>
            </div>
          }
        />
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t("districts")}
          value={regionStructure.districts.length}
          delta={t("districtsCaption")}
          tone="warm"
        />
        <MetricCard
          label={t("branches")}
          value={regionStructure.branchCount}
          delta={t("branchesCaption")}
          tone="cool"
        />
        <MetricCard
          label={t("guestsAndMembers")}
          value={regionStructure.guestCount + regionStructure.memberCount}
          delta={t("guestsMembersCaption", { guests: regionStructure.guestCount, members: regionStructure.memberCount })}
          tone="warm"
        />
        <MetricCard
          label={t("leaders")}
          value={nationalLeaderCount + districtLeaderCount}
          delta={t("roleView", { role: roleLabel(user.role) })}
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
                title={t("addLeadershipTitle")}
                description={t("addLeadershipDescription")}
                submitLabel={t("addLeader")}
              />
            </Card>
          ) : null}

          <Card className="app-rise p-6 sm:p-7" style={{ animationDelay: "120ms" }}>
            <CardHeader label={t("leadershipLabel")} title={t("leadershipTitle")} />
            <div className="mt-5 grid gap-4">
              <div className="rounded-2xl bg-[#f6f5f1] p-4">
                <p className="text-[12px] font-medium text-[#6b6b6b]">{t("nationalAdmins")}</p>
                <div className="mt-3">
                  <TeamPills
                    users={regionStructure.nationalAdmins}
                    emptyLabel={t("noNationalAdmin")}
                  />
                </div>
              </div>
              <div className="rounded-2xl bg-[#f6f5f1] p-4">
                <p className="text-[12px] font-medium text-[#6b6b6b]">{t("nationalPastors")}</p>
                <div className="mt-3">
                  <TeamPills
                    users={regionStructure.nationalPastors}
                    emptyLabel={t("noNationalPastor")}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card className="app-rise self-start p-6 sm:p-7" style={{ animationDelay: "60ms" }}>
          <CardHeader
            label={t("drillLabel")}
            title={t("drillTitle")}
            description={t("drillDescription")}
            action={
              <Badge>
                {t.rich("districtsBadge", { count: regionStructure.districts.length, n: (chunks) => <span className="tabular-nums">{chunks}</span> })}
              </Badge>
            }
          />
          <div className="mt-6 space-y-4">
            {regionStructure.districts.length === 0 ? (
              <EmptyState icon="pin" title={t("emptyTitle")}>
                {t("emptyBody")}
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
                        <p className="text-[12px] text-[#8a8780]">{t("district")}</p>
                        <h3 className="lp-heading text-[18px]">{district.name}</h3>
                        <p className="mt-1 text-[13px] text-[#6b6b6b]">
                          {t.rich("districtStats", {
                            branches: district.branchCount,
                            guests: district.guestCount,
                            members: district.memberCount,
                            n: (chunks) => <span className="tabular-nums">{chunks}</span>,
                          })}
                        </p>
                      </div>
                    </div>
                    {districtIdByName.get(district.name) ? (
                      <ButtonLink href={`/structure/district/${districtIdByName.get(district.name)}`} size="sm">
                        {t("openDistrict")}
                      </ButtonLink>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl bg-[#f6f5f1] p-4">
                      <p className="text-[12px] font-medium text-[#6b6b6b]">{t("districtAdmins")}</p>
                      <div className="mt-3">
                        <TeamPills
                          users={district.districtAdmins}
                          emptyLabel={t("noDistrictAdmin")}
                        />
                      </div>
                    </div>
                    <div className="rounded-2xl bg-[#f6f5f1] p-4">
                      <p className="text-[12px] font-medium text-[#6b6b6b]">{t("districtPastors")}</p>
                      <div className="mt-3">
                        <TeamPills
                          users={district.districtPastors}
                          emptyLabel={t("noDistrictPastor")}
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
                      {t("focusInOverview")}
                    </ButtonLink>
                    <ButtonLink
                      href={`/users?oversightRegion=${encodeURIComponent(region.name)}&district=${encodeURIComponent(district.name)}`}
                      variant="ghost"
                      size="sm"
                      icon="users"
                    >
                      {t("openDistrictStaff")}
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
