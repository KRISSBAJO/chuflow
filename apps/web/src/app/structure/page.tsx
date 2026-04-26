import Link from "next/link";
import { HierarchyCatalogPanel } from "@/components/hierarchy-catalog-panel";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
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

  if (branchFields.some((value) => value.toLowerCase().includes(search))) {
    return true;
  }

  return [
    ...branch.admins,
    ...branch.residentPastors,
    ...branch.followUpTeam,
    ...branch.ushers,
  ].some((user) => matchesPerson(user, search));
}

function filterStructure(
  structure: OrgStructureSummary,
  selectedRegion?: string,
  selectedDistrict?: string,
  searchText?: string,
): OrgStructureSummary {
  const search = normalize(searchText);
  const filteredOverallHeads = search
    ? structure.overallHeads.filter((user) => matchesPerson(user, search))
    : structure.overallHeads;

  const oversightRegions = structure.oversightRegions
    .filter((region) => !selectedRegion || region.name === selectedRegion)
    .map((region) => {
      const regionMatches =
        !search ||
        region.name.toLowerCase().includes(search) ||
        matchesAnyPerson(region.nationalAdmins, search) ||
        matchesAnyPerson(region.nationalPastors, search);

      const districts = region.districts
        .filter((district) => !selectedDistrict || district.name === selectedDistrict)
        .map((district) => {
          const districtMatches =
            regionMatches ||
            !search ||
            district.name.toLowerCase().includes(search) ||
            matchesAnyPerson(district.districtAdmins, search) ||
            matchesAnyPerson(district.districtPastors, search);

          const branches = districtMatches
            ? district.branches
            : district.branches.filter((branch) => matchesBranch(branch, search));

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
          total + region.nationalAdmins.length + region.nationalPastors.length,
        0,
      ),
      districtLeaderCount: oversightRegions.reduce(
        (total, region) =>
          total +
          region.districts.reduce(
            (districtTotal, district) =>
              districtTotal +
              district.districtAdmins.length +
              district.districtPastors.length,
            0,
          ),
        0,
      ),
      branchLeaderCount: visibleBranches.reduce(
        (total, branch) =>
          total +
          branch.admins.length +
          branch.residentPastors.length,
        0,
      ),
      supportStaffCount: visibleBranches.reduce(
        (total, branch) =>
          total +
          branch.followUpTeam.length +
          branch.ushers.length,
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
  if (users.length === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {users.map((user) => (
        <span
          key={user._id}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
        >
          {user.firstName} {user.lastName}
        </span>
      ))}
    </div>
  );
}

function BranchCard({ branch }: { branch: BranchOverview }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-lg font-semibold text-slate-950">{branch.name}</h4>
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
            {branch.city}, {branch.state} · {branch.serviceTimes}
          </p>
          <p className="mt-1 text-sm text-slate-500">{branch.contactInfo}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-orange-50 px-3 py-1.5 font-semibold text-orange-700">
            {branch.metrics.guestCount} guests
          </span>
          <span className="rounded-full bg-cyan-50 px-3 py-1.5 font-semibold text-cyan-700">
            {branch.metrics.memberCount} members
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-700">
            {branch.metrics.activeUserCount} active staff
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Branch Admins
          </p>
          <div className="mt-3">
            <TeamPills users={branch.admins} emptyLabel="No branch admin assigned yet." />
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Resident Pastors
          </p>
          <div className="mt-3">
            <TeamPills users={branch.residentPastors} emptyLabel="No resident pastor assigned yet." />
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Follow-Up Team
          </p>
          <div className="mt-3">
            <TeamPills users={branch.followUpTeam} emptyLabel="No follow-up team assigned." />
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Ushers
          </p>
          <div className="mt-3">
            <TeamPills users={branch.ushers} emptyLabel="No usher team assigned." />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/branches`}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
        >
          Open branches
        </Link>
        <Link
          href={`/users?branchId=${branch._id}`}
          className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
        >
          Open branch staff
        </Link>
      </div>
    </div>
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

  return (
    <details
      open={region.districts.length <= 2 || !!selectedDistrict}
      className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-sm"
    >
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-600">
              Oversight Region
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">{region.name}</h2>
            <p className="mt-2 text-sm text-slate-500">
              {region.branchCount} branches · {region.districtCount} districts ·{" "}
              {region.guestCount} guests · {region.memberCount} members
            </p>
            <div className="mt-3">
              {regionId ? (
                <Link
                  href={`/structure/national/${regionId}`}
                  className="inline-flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                >
                  Open national detail
                </Link>
              ) : null}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-orange-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-500">
                National Admins
              </p>
              <div className="mt-3">
                <TeamPills users={region.nationalAdmins} emptyLabel="No national admin assigned." />
              </div>
            </div>
            <div className="rounded-2xl bg-cyan-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-600">
                National Pastors
              </p>
              <div className="mt-3">
                <TeamPills users={region.nationalPastors} emptyLabel="No national pastor assigned." />
              </div>
            </div>
          </div>
        </div>
      </summary>

      <div className="mt-6 space-y-4">
        {region.districts.map((district) => {
          const districtId = districtIdByKey.get(`${region.name}::${district.name}`);

          return (
            <details
              key={`${region.name}-${district.name}`}
              open={district.branches.length <= 2 || district.name === selectedDistrict}
              className="rounded-[24px] border border-slate-200 bg-slate-50 p-5"
            >
              <summary className="cursor-pointer list-none">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      District
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-950">{district.name}</h3>
                    <p className="mt-2 text-sm text-slate-500">
                      {district.branchCount} branches · {district.guestCount} guests ·{" "}
                      {district.memberCount} members
                    </p>
                    <div className="mt-3">
                      {districtId ? (
                        <Link
                          href={`/structure/district/${districtId}`}
                          className="inline-flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                        >
                          Open district detail
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-white p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        District Admins
                      </p>
                      <div className="mt-3">
                        <TeamPills users={district.districtAdmins} emptyLabel="No district admin assigned." />
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        District Pastors
                      </p>
                      <div className="mt-3">
                        <TeamPills users={district.districtPastors} emptyLabel="No district pastor assigned." />
                      </div>
                    </div>
                  </div>
                </div>
              </summary>

              <div className="mt-5 grid gap-4">
                {district.branches.map((branch) => (
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
        description="Browse the live church hierarchy in one place so leadership can see who is carrying oversight, where branches sit, and how staffing and branch load are distributed."
        action={
          <form className="flex flex-wrap items-center gap-2">
            <input
              name="search"
              defaultValue={search || ""}
              placeholder="Search branch, district, leader"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
            />
            {regionOptions.length > 1 ? (
              <select
                name="oversightRegion"
                defaultValue={selectedRegion || ""}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
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
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
              >
                <option value="">All districts</option>
                {districtOptions.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </select>
            ) : null}
            <button className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">
              Filter
            </button>
            {selectedRegion || selectedDistrict || search ? (
              <Link
                href="/structure"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                Clear
              </Link>
            ) : null}
          </form>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
          label="Leaders + support"
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

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="surface rounded-[28px] p-6">
          <p className="eyebrow">Oversight summary</p>
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Current scope
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                {scopeLabel || formatRoleLabel(user.role)}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                This hierarchy view is automatically limited to the branches, districts, and regions this account can see.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Overall oversight admin
              </p>
              <div className="mt-3">
                <TeamPills
                  users={filteredStructure.overallHeads}
                  emptyLabel="No overall oversight admin found in the current scope."
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Leadership distribution
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-orange-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-600">
                    National
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {filteredStructure.summary.nationalLeaderCount}
                  </p>
                </div>
                <div className="rounded-xl bg-cyan-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-600">
                    District
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {filteredStructure.summary.districtLeaderCount}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-100 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Branch leaders
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {filteredStructure.summary.branchLeaderCount}
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">
                    Support staff
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {filteredStructure.summary.supportStaffCount}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {filteredStructure.oversightRegions.length === 0 ? (
            <section className="surface rounded-[28px] p-8">
              <p className="text-sm text-slate-500">
                No structure matched the current filters.
              </p>
            </section>
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
        </section>
      </section>
    </Shell>
  );
}
