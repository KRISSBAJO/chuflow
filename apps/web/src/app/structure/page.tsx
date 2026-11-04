import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/app/icons";
import { HierarchyCatalogPanel } from "@/components/hierarchy-catalog-panel";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { Avatar, Badge, Button, ButtonLink, Card, CardHeader, EmptyState, formatStatus, Stat, statusTone } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { formatRoleLabel, getUserScopeLabel } from "@/lib/permissions";
import { serverGet } from "@/lib/server-api";
import type {
    BranchOverview,
    DistrictOption,
    OversightRegionOption,
    OrgStructureSummary,
    OversightRegionStructureSummary,
    UserSummary,
} from "@/lib/types";

function normalize(value?: string) {
  return value?.trim().toLowerCase() || "";
}

function text(value?: string | null, fallback = "") {
  return value?.trim() || fallback;
}

function list<T>(value?: T[] | null): T[] {
  return Array.isArray(value) ? value : [];
}

function matchesPerson(user: UserSummary, search: string) {
  if (!search) {
    return false;
  }

  return [user.firstName, user.lastName, user.email, user.role]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(search));
}

function matchesAnyPerson(users: UserSummary[], search: string) {
  return users.some((user) => matchesPerson(user, search));
}

function matchesBranch(branch: BranchOverview, search: string) {
  if (!search) {
    return true;
  }

  const branchFields = [
    branch.name,
    branch.city,
    branch.state,
    branch.country,
    branch.district,
    branch.oversightRegion,
    branch.contactInfo,
    branch.serviceTimes,
  ];

  if (branchFields.some((value) => normalize(value).includes(search))) {
    return true;
  }

  return [
    ...list(branch.admins),
    ...list(branch.residentPastors),
    ...list(branch.followUpTeam),
    ...list(branch.ushers),
  ].some((user) => matchesPerson(user, search));
}

function filterStructure(
  structure: OrgStructureSummary,
  selectedRegion?: string,
  selectedDistrict?: string,
  searchText?: string,
): OrgStructureSummary {
  const search = normalize(searchText);
  const overallHeads = list(structure.overallHeads);
  const sourceRegions = list(structure.oversightRegions);
  const filteredOverallHeads = search
    ? overallHeads.filter((user) => matchesPerson(user, search))
    : overallHeads;

  const oversightRegions = sourceRegions
    .filter((region) => !selectedRegion || region.name === selectedRegion)
    .map((region) => {
      const regionMatches =
        !search ||
        normalize(region.name).includes(search) ||
        matchesAnyPerson(list(region.nationalAdmins), search) ||
        matchesAnyPerson(list(region.nationalPastors), search);

      const districts = list(region.districts)
        .filter((district) => !selectedDistrict || district.name === selectedDistrict)
        .map((district) => {
          const districtMatches =
            regionMatches ||
            !search ||
            normalize(district.name).includes(search) ||
            matchesAnyPerson(list(district.districtAdmins), search) ||
            matchesAnyPerson(list(district.districtPastors), search);

          const branches = districtMatches
            ? list(district.branches)
            : list(district.branches).filter((branch) => matchesBranch(branch, search));

          return {
            ...district,
            branchCount: branches.length,
            guestCount: branches.reduce(
              (total, branch) => total + branch.metrics.guestCount,
              0,
            ),
            memberCount: branches.reduce(
              (total, branch) => total + branch.metrics.memberCount,
              0,
            ),
            branches,
          };
        })
        .filter((district) => district.branches.length > 0);

      return {
        ...region,
        districtCount: districts.length,
        branchCount: districts.reduce(
          (total, district) => total + district.branchCount,
          0,
        ),
        guestCount: districts.reduce(
          (total, district) => total + district.guestCount,
          0,
        ),
        memberCount: districts.reduce(
          (total, district) => total + district.memberCount,
          0,
        ),
        districts,
      };
    })
    .filter((region) => region.districts.length > 0);

  const visibleBranches = oversightRegions.flatMap((region) =>
    region.districts.flatMap((district) => district.branches),
  );

  return {
    ...structure,
    overallHeads: filteredOverallHeads,
    oversightRegions,
    summary: {
      overallHeadCount: filteredOverallHeads.length,
      oversightRegionCount: oversightRegions.length,
      districtCount: oversightRegions.reduce(
        (total, region) => total + region.districtCount,
        0,
      ),
      branchCount: visibleBranches.length,
      guestCount: visibleBranches.reduce(
        (total, branch) => total + branch.metrics.guestCount,
        0,
      ),
      memberCount: visibleBranches.reduce(
        (total, branch) => total + branch.metrics.memberCount,
        0,
      ),
      nationalLeaderCount: oversightRegions.reduce(
        (total, region) =>
          total + list(region.nationalAdmins).length + list(region.nationalPastors).length,
        0,
      ),
      districtLeaderCount: oversightRegions.reduce(
        (total, region) =>
          total +
          region.districts.reduce(
            (districtTotal, district) =>
              districtTotal +
              list(district.districtAdmins).length +
              list(district.districtPastors).length,
            0,
          ),
        0,
      ),
      branchLeaderCount: visibleBranches.reduce(
        (total, branch) =>
          total +
          list(branch.admins).length +
          list(branch.residentPastors).length,
        0,
      ),
      supportStaffCount: visibleBranches.reduce(
        (total, branch) =>
          total +
          list(branch.followUpTeam).length +
          list(branch.ushers).length,
        0,
      ),
    },
  };
}

function TeamPills({
  users,
  emptyLabel,
}: {
  users: UserSummary[];
  emptyLabel: string;
}) {
  const visibleUsers = list(users);

  if (visibleUsers.length === 0) {
    return <p className="text-[13px] text-[#8a8780]">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {visibleUsers.map((user) => {
        const name = `${text(user.firstName, "Unknown")} ${text(user.lastName, "User")}`;
        return (
          <span
            key={user._id}
            className="inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-white py-1 pl-1 pr-3 text-[13px] font-medium text-[#111111]"
          >
            <Avatar name={name} className="h-6 w-6 text-[10px]" />
            {name}
          </span>
        );
      })}
    </div>
  );
}

function TeamGroup({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-2xl p-4 ${className ?? "bg-[#f6f5f1]"}`}>
      <p className="text-[12px] font-medium text-[#6b6b6b]">{label}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function LevelIcon({ name }: { name: IconName }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f6f5f1] text-[#111111]">
      <Icon name={name} className="h-[18px] w-[18px]" />
    </span>
  );
}

function CountLine({ items }: { items: [number, string][] }) {
  return (
    <p className="mt-1 text-[13px] text-[#6b6b6b]">
      {items.map(([value, label], index) => (
        <span key={label}>
          {index > 0 ? " · " : null}
          <span className="tabular-nums">{value}</span> {label}
        </span>
      ))}
    </p>
  );
}

function BranchCard({ branch }: { branch: BranchOverview }) {
  const status = text(branch.status, "active");

  return (
    <article className="rounded-2xl border border-black/[0.06] bg-white p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <LevelIcon name="branches" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-[15px] font-semibold text-[#111111]">{text(branch.name, "Unnamed branch")}</h4>
              <Badge tone={statusTone(status)} dot>
                {formatStatus(status)}
              </Badge>
            </div>
            <p className="mt-1 text-[13px] text-[#55534e]">
              {text(branch.city, "City not set")}, {text(branch.state, "State not set")} · {text(branch.serviceTimes, "Service times not set")}
            </p>
            <p className="mt-0.5 text-[13px] text-[#8a8780]">{text(branch.contactInfo, "Contact information not set")}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="flame">
            <span className="tabular-nums">{branch.metrics.guestCount}</span> guests
          </Badge>
          <Badge>
            <span className="tabular-nums">{branch.metrics.memberCount}</span> members
          </Badge>
          <Badge>
            <span className="tabular-nums">{branch.metrics.activeUserCount}</span> active staff
          </Badge>
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <TeamGroup label="Branch admins">
          <TeamPills users={list(branch.admins)} emptyLabel="No branch admin assigned yet." />
        </TeamGroup>
        <TeamGroup label="Resident pastors">
          <TeamPills users={list(branch.residentPastors)} emptyLabel="No resident pastor assigned yet." />
        </TeamGroup>
        <TeamGroup label="Follow-up team">
          <TeamPills users={list(branch.followUpTeam)} emptyLabel="No follow-up team assigned." />
        </TeamGroup>
        <TeamGroup label="Ushers">
          <TeamPills users={list(branch.ushers)} emptyLabel="No usher team assigned." />
        </TeamGroup>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <ButtonLink href="/branches" variant="secondary" size="sm" icon="branches">
          Open branches
        </ButtonLink>
        <ButtonLink href={`/users?branchId=${branch._id}`} size="sm" icon="users">
          Open branch staff
        </ButtonLink>
      </div>
    </article>
  );
}

function RegionSection({
  region,
  selectedDistrict,
  regionIdByName,
  districtIdByKey,
}: {
  region: OversightRegionStructureSummary;
  selectedDistrict?: string;
  regionIdByName: Map<string, string>;
  districtIdByKey: Map<string, string>;
}) {
  const regionId = regionIdByName.get(region.name);
  const districts = list(region.districts);

  return (
    <details
      open={districts.length <= 2 || !!selectedDistrict}
      className="app-card group/region app-rise p-6 sm:p-7"
    >
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="lp-flame-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white">
              <Icon name="structure" className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[#6b6b6b]">National area</p>
              <h2 className="lp-heading mt-0.5 flex items-center gap-2 text-[22px] leading-tight">
                {text(region.name, "Unnamed region")}
                <Icon
                  name="chevronDown"
                  className="h-4 w-4 text-[#8a8780] transition-transform group-open/region:rotate-180"
                />
              </h2>
              <CountLine
                items={[
                  [region.branchCount, "branches"],
                  [region.districtCount, "districts"],
                  [region.guestCount, "guests"],
                  [region.memberCount, "members"],
                ]}
              />
              {regionId ? (
                <div className="mt-3">
                  <ButtonLink href={`/structure/national/${regionId}`} variant="secondary" size="sm">
                    Open national detail
                  </ButtonLink>
                </div>
              ) : null}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:min-w-[420px] xl:max-w-[520px]">
            <TeamGroup label="National admins">
              <TeamPills users={list(region.nationalAdmins)} emptyLabel="No national admin assigned." />
            </TeamGroup>
            <TeamGroup label="National pastors">
              <TeamPills users={list(region.nationalPastors)} emptyLabel="No national pastor assigned." />
            </TeamGroup>
          </div>
        </div>
      </summary>

      <div className="mt-6 space-y-4 border-l-2 border-black/[0.06] pl-4 sm:pl-5">
        {districts.map((district) => {
          const districtId = districtIdByKey.get(`${region.name}::${district.name}`);
          const branches = list(district.branches);

          return (
            <details
              key={`${region.name}-${district.name}`}
              open={branches.length <= 2 || district.name === selectedDistrict}
              className="group/district rounded-2xl bg-[#f6f5f1] p-4 sm:p-5"
            >
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#111111] shadow-[0_1px_2px_rgba(17,17,17,0.06)]">
                      <Icon name="pin" className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-[#8a8780]">District</p>
                      <h3 className="lp-heading mt-0.5 flex items-center gap-2 text-[18px] leading-tight">
                        {text(district.name, "Unnamed district")}
                        <Icon
                          name="chevronDown"
                          className="h-4 w-4 text-[#8a8780] transition-transform group-open/district:rotate-180"
                        />
                      </h3>
                      <CountLine
                        items={[
                          [district.branchCount, "branches"],
                          [district.guestCount, "guests"],
                          [district.memberCount, "members"],
                        ]}
                      />
                      {districtId ? (
                        <div className="mt-3">
                          <ButtonLink href={`/structure/district/${districtId}`} variant="secondary" size="sm">
                            Open district detail
                          </ButtonLink>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:min-w-[400px] xl:max-w-[500px]">
                    <TeamGroup label="District admins" className="bg-white">
                      <TeamPills users={list(district.districtAdmins)} emptyLabel="No district admin assigned." />
                    </TeamGroup>
                    <TeamGroup label="District pastors" className="bg-white">
                      <TeamPills users={list(district.districtPastors)} emptyLabel="No district pastor assigned." />
                    </TeamGroup>
                  </div>
                </div>
              </summary>

              <div className="mt-5 grid gap-3">
                {branches.map((branch) => (
                  <BranchCard key={branch._id} branch={branch} />
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </details>
  );
}

export default async function StructurePage({
  searchParams,
}: {
  searchParams: Promise<{
    oversightRegion?: string;
    district?: string;
    search?: string;
  }>;
}) {
  const user = await requireServerRole("/structure");
  const params = await searchParams;
  const selectedRegion = params.oversightRegion?.trim();
  const selectedDistrict = params.district?.trim();
  const search = params.search?.trim();

  const [structure, oversightRegions, districts] = await Promise.all([
    serverGet<OrgStructureSummary>("/branches/structure"),
    serverGet<OversightRegionOption[]>("/oversight-regions").catch(() => []),
    serverGet<DistrictOption[]>(
      selectedRegion
        ? `/districts?oversightRegion=${encodeURIComponent(selectedRegion)}`
        : "/districts",
    ).catch(() => []),
  ]);
  const filteredStructure = filterStructure(
    structure,
    selectedRegion,
    selectedDistrict,
    search,
  );

  const regionOptions = structure.oversightRegions.map((region) => region.name);
  const districtOptions = structure.oversightRegions
    .filter((region) => !selectedRegion || region.name === selectedRegion)
    .flatMap((region) => region.districts.map((district) => district.name));
  const scopeLabel = getUserScopeLabel({
    role: user.role,
    oversightRegion: user.oversightRegion,
    district: user.district,
  });
  const regionIdByName = new Map(
    oversightRegions.map((region) => [region.name, region._id]),
  );
  const districtIdByKey = new Map(
    districts.map((district) => [
      `${district.oversightRegion}::${district.name}`,
      district._id,
    ]),
  );

  return (
    <Shell>
      <PageHeader
        eyebrow="Structure"
        title="National to district to branch structure"
        description="See the live church hierarchy in one place: who carries oversight, where branches sit, and how staffing and branch load are spread."
      />

      <Card className="app-rise p-4 sm:p-5">
        <form className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
          <input
            name="search"
            defaultValue={search || ""}
            placeholder="Search branch, district or leader"
            aria-label="Search structure"
            className="ui-input lg:min-w-[260px] lg:flex-1"
          />
          {regionOptions.length > 1 ? (
            <select
              name="oversightRegion"
              defaultValue={selectedRegion || ""}
              aria-label="National area"
              className="ui-input lg:w-auto lg:min-w-[200px]"
            >
              <option value="">All regions</option>
              {regionOptions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          ) : null}
          {districtOptions.length > 1 ? (
            <select
              name="district"
              defaultValue={selectedDistrict || ""}
              aria-label="District"
              className="ui-input lg:w-auto lg:min-w-[200px]"
            >
              <option value="">All districts</option>
              {districtOptions.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" variant="secondary" icon="search">
              Filter
            </Button>
            {selectedRegion || selectedDistrict || search ? (
              <ButtonLink href="/structure" variant="ghost">
                Clear
              </ButtonLink>
            ) : null}
          </div>
        </form>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Overall heads"
          value={filteredStructure.summary.overallHeadCount}
          delta="Platform-wide oversight accounts"
          tone="warm"
        />
        <MetricCard
          label="Regions"
          value={filteredStructure.summary.oversightRegionCount}
          delta="Visible oversight regions"
          tone="cool"
        />
        <MetricCard
          label="Districts"
          value={filteredStructure.summary.districtCount}
          delta="Visible districts in scope"
          tone="warm"
        />
        <MetricCard
          label="Branches"
          value={filteredStructure.summary.branchCount}
          delta="Branches in current hierarchy view"
          tone="cool"
        />
        <MetricCard
          label="Leaders and support"
          value={
            filteredStructure.summary.nationalLeaderCount +
            filteredStructure.summary.districtLeaderCount +
            filteredStructure.summary.branchLeaderCount +
            filteredStructure.summary.supportStaffCount
          }
          delta={`Scope: ${scopeLabel || formatRoleLabel(user.role)}`}
          tone="warm"
        />
      </section>

      <HierarchyCatalogPanel
        currentUserRole={user.role}
        defaultOversightRegion={user.oversightRegion}
        oversightRegions={oversightRegions}
        districts={districts}
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Card className="app-rise self-start p-6 sm:p-7">
          <CardHeader label="Oversight summary" title={scopeLabel || formatRoleLabel(user.role)} description="This view is limited to the branches, districts and regions your account can see." />
          <div className="mt-6 space-y-4">
            <TeamGroup label="Overall oversight admin">
              <TeamPills
                users={filteredStructure.overallHeads}
                emptyLabel="No overall oversight admin found in the current scope."
              />
            </TeamGroup>

            <div>
              <p className="text-[13px] font-medium text-[#6b6b6b]">Leadership distribution</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Stat label="National" value={filteredStructure.summary.nationalLeaderCount} />
                <Stat label="District" value={filteredStructure.summary.districtLeaderCount} />
                <Stat label="Branch leaders" value={filteredStructure.summary.branchLeaderCount} />
                <Stat label="Support staff" value={filteredStructure.summary.supportStaffCount} />
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          {filteredStructure.oversightRegions.length === 0 ? (
            <Card className="app-rise p-6 sm:p-7">
              <EmptyState icon="structure" title="Nothing matched">
                No structure matched the current filters.
              </EmptyState>
            </Card>
          ) : (
            filteredStructure.oversightRegions.map((region) => (
              <RegionSection
                key={region.name}
                region={region}
                selectedDistrict={selectedDistrict}
                regionIdByName={regionIdByName}
                districtIdByKey={districtIdByKey}
              />
            ))
          )}
        </div>
      </section>
    </Shell>
  );
}
