import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { DistrictEditorCard } from "@/components/district-editor-card";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { BranchCard, TeamPills } from "@/components/structure-cards";
import { UserCreateForm } from "@/components/user-create-form";
import { Icon } from "@/components/app/icons";
import { Badge, ButtonLink, Card, CardHeader, EmptyState } from "@/components/ui/ui";
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
  const t = await getTranslations("org.structureDistrict");
  const tCommon = await getTranslations("common");

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
      <div className="space-y-3">
        <HierarchyTrail
          ariaLabel={t("breadcrumb")}
          items={[
            { label: t("structure"), href: "/structure" },
            { label: district.oversightRegion, href: nationalAreaHref },
            { label: district.name },
          ]}
        />
        <PageHeader
          eyebrow={t("eyebrow")}
          title={district.name}
          description={t("description")}
          action={
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={nationalAreaHref} variant="secondary">
                {t("backToNational")}
              </ButtonLink>
              <ButtonLink
                href={`/users?oversightRegion=${encodeURIComponent(district.oversightRegion)}&district=${encodeURIComponent(district.name)}`}
                icon="users"
              >
                {t("openStaff")}
              </ButtonLink>
            </div>
          }
        />
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t("branches")}
          value={districtStructure.branchCount}
          delta={t("branchesCaption")}
          tone="warm"
        />
        <MetricCard
          label={t("guests")}
          value={districtStructure.guestCount}
          delta={t("guestsCaption")}
          tone="cool"
        />
        <MetricCard
          label={t("members")}
          value={districtStructure.memberCount}
          delta={t("membersCaption")}
          tone="warm"
        />
        <MetricCard
          label={t("leadersAndSupport")}
          value={districtLeaderCount + supportStaffCount}
          delta={t("leadersCaption", { leaders: districtLeaderCount, support: supportStaffCount })}
          tone="cool"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="space-y-4">
          <DistrictEditorCard
            district={district}
            oversightRegions={oversightRegions}
            canEdit={canEdit}
            canChangeOversightRegion={isGlobalRole(user.role)}
          />

          {canCreateDistrictLeadership ? (
            <Card className="app-rise p-1.5" style={{ animationDelay: "60ms" }}>
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
                <p className="text-[12px] font-medium text-[#6b6b6b]">{t("districtAdmins")}</p>
                <div className="mt-3">
                  <TeamPills
                    users={districtStructure.districtAdmins}
                    emptyLabel={t("noDistrictAdmin")}
                  />
                </div>
              </div>
              <div className="rounded-2xl bg-[#f6f5f1] p-4">
                <p className="text-[12px] font-medium text-[#6b6b6b]">{t("districtPastors")}</p>
                <div className="mt-3">
                  <TeamPills
                    users={districtStructure.districtPastors}
                    emptyLabel={t("noDistrictPastor")}
                  />
                </div>
              </div>
              <Link
                href={nationalAreaHref}
                className="group flex items-center gap-3 rounded-2xl border border-black/[0.06] p-4 transition-colors hover:border-black/[0.12] hover:bg-[#fbfaf8]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f6f5f1] text-[#111111]">
                  <Icon name="structure" className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] text-[#8a8780]">{tCommon("nationalArea")}</span>
                  <span className="block text-[14px] font-medium text-[#111111]">{district.oversightRegion}</span>
                </span>
                <Icon
                  name="arrowRight"
                  className="h-4 w-4 text-[#8a8780] transition-transform group-hover:translate-x-0.5 group-hover:text-[#111111]"
                />
              </Link>
            </div>
          </Card>
        </div>

        <Card className="app-rise self-start p-6 sm:p-7" style={{ animationDelay: "60ms" }}>
          <CardHeader
            label={t("branchesLabel")}
            title={t("branchesTitle")}
            description={t("branchesDescription")}
            action={
              <Badge>
                {t.rich("branchesBadge", { count: districtStructure.branches.length, n: (chunks) => <span className="tabular-nums">{chunks}</span> })}
              </Badge>
            }
          />
          <div className="mt-6 grid gap-4">
            {districtStructure.branches.length === 0 ? (
              <EmptyState icon="branches" title={t("emptyTitle")}>
                {t("emptyBody")}
              </EmptyState>
            ) : (
              districtStructure.branches.map((branch) => (
                <BranchCard key={branch._id} branch={branch} />
              ))
            )}
          </div>
        </Card>
      </section>
    </Shell>
  );
}

function HierarchyTrail({ items, ariaLabel }: { items: { label: string; href?: string }[]; ariaLabel: string }) {
  return (
    <nav aria-label={ariaLabel} className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#8a8780]">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
          {index > 0 ? <span aria-hidden>/</span> : null}
          {item.href ? (
            <Link href={item.href} className="rounded-md px-1 py-0.5 font-medium text-[#6b6b6b] transition-colors hover:bg-white hover:text-[#111111]">
              {item.label}
            </Link>
          ) : (
            <span aria-current="page" className="px-1 font-medium text-[#111111]">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
