import type { ReactNode } from "react";
import Link from "next/link";
import { DashboardScopeFilterBar } from "@/components/dashboard-scope-filter-bar";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { requireServerRole } from "@/lib/auth";
import {
  canFilterAcrossBranches,
  formatRoleLabel,
  isGlobalRole,
  isNationalRole,
} from "@/lib/permissions";
import { serverGet } from "@/lib/server-api";
import type {
  BranchSummary,
  DashboardBranchAlert,
  DashboardGrowthBranch,
  DashboardOverview,
  DistrictOption,
  OversightRegionOption,
} from "@/lib/types";

type DashboardSearchParams = {
  days?: string;
  oversightRegion?: string;
  district?: string;
  branchId?: string;
};

const numberFormatter = new Intl.NumberFormat("en-US");

function normalizeParam(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function formatCount(value: number) {
  return numberFormatter.format(value);
}

function formatDate(value?: string | null) {
  if (!value) {
    return "No recent submission";
  }

  return new Date(value).toLocaleDateString();
}

function formatStatusLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildDashboardHref(filters: {
  days?: number | string;
  oversightRegion?: string;
  district?: string;
  branchId?: string;
}) {
  const query = new URLSearchParams();

  if (filters.days) {
    query.set("days", String(filters.days));
  }

  if (filters.oversightRegion) {
    query.set("oversightRegion", filters.oversightRegion);
  }

  if (filters.district) {
    query.set("district", filters.district);
  }

  if (filters.branchId) {
    query.set("branchId", filters.branchId);
  }

  const queryString = query.toString();
  return queryString ? `/dashboard?${queryString}` : "/dashboard";
}

function getDashboardTitle(scope: DashboardOverview["scope"]) {
  if (scope.kind === "all_network") {
    return "Executive ministry overview";
  }

  if (scope.kind === "national") {
    return "National ministry overview";
  }

  if (scope.kind === "district") {
    return "District ministry overview";
  }

  return "Branch operations overview";
}

function getDashboardDescription(scope: DashboardOverview["scope"]) {
  if (scope.kind === "all_network") {
    return "Network-level visibility across every church, with drill-down into the districts and branches that need attention first.";
  }

  if (scope.kind === "national") {
    return `Oversight across ${scope.label}, with district pressure points, branch reporting gaps, and growth movement in one place.`;
  }

  if (scope.kind === "district") {
    return `District-level visibility for ${scope.label}, with branch watchlists and the live operating detail your team needs.`;
  }

  return `Operational focus for ${scope.label}, built around guest movement, follow-up pressure, and attendance flow.`;
}

function WatchlistCard({
  eyebrow,
  title,
  emptyLabel,
  children,
}: {
  eyebrow: string;
  title: string;
  emptyLabel: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/60 bg-white/90 p-7 shadow-sm backdrop-blur-xl">
      <p className="text-xs font-semibold uppercase tracking-[0.125em] text-amber-600">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
      <div className="mt-6">{children || <p className="text-sm text-slate-500">{emptyLabel}</p>}</div>
    </section>
  );
}

function BranchAlertList({
  items,
  days,
  emptyLabel,
  metricLabel,
}: {
  items: DashboardBranchAlert[];
  days: number;
  emptyLabel: string;
  metricLabel: (item: DashboardBranchAlert) => string;
}) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item._id} className="rounded-2xl border border-slate-100 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">{item.name}</p>
              <p className="mt-1 text-sm text-slate-500">
                {item.district} · {item.oversightRegion}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
              {metricLabel(item)}
            </span>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            <p className="text-slate-500">
              {item.city && item.state ? `${item.city}, ${item.state}` : "Branch in active scope"}
            </p>
            <Link
              href={buildDashboardHref({ days, branchId: item._id })}
              className="font-semibold text-slate-900 underline underline-offset-4"
            >
              Open branch
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

function GrowthList({
  items,
  days,
  emptyLabel,
}: {
  items: DashboardGrowthBranch[];
  days: number;
  emptyLabel: string;
}) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item._id} className="rounded-2xl border border-slate-100 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">{item.name}</p>
              <p className="mt-1 text-sm text-slate-500">
                {item.district} · {item.oversightRegion}
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
              Score {item.growthScore}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">
            <span className="rounded-full bg-orange-50 px-3 py-2 text-orange-700">
              {item.guestsCaptured} guests
            </span>
            <span className="rounded-full bg-cyan-50 px-3 py-2 text-cyan-700">
              {item.membersAdded} members
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-700">
              {item.newConverts} converts
            </span>
          </div>
          <div className="mt-4 text-right">
            <Link
              href={buildDashboardHref({ days, branchId: item._id })}
              className="text-sm font-semibold text-slate-900 underline underline-offset-4"
            >
              Open branch
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const user = await requireServerRole("/dashboard");
  const params = await searchParams;

  const requestedDays = Number(params.days);
  const days =
    (Number.isFinite(requestedDays) && requestedDays > 0 ? requestedDays : undefined) ||
    user.preferences?.defaultReportDays ||
    30;

  const requestedOversightRegion = isGlobalRole(user.role)
    ? normalizeParam(params.oversightRegion)
    : user.oversightRegion;
  const requestedDistrict =
    isGlobalRole(user.role) || isNationalRole(user.role)
      ? normalizeParam(params.district)
      : user.district;
  const requestedBranchId = canFilterAcrossBranches(user.role)
    ? normalizeParam(params.branchId)
    : user.branchId;

  const dashboardQuery = new URLSearchParams({ days: String(days) });

  if (requestedOversightRegion) {
    dashboardQuery.set("oversightRegion", requestedOversightRegion);
  }

  if (requestedDistrict) {
    dashboardQuery.set("district", requestedDistrict);
  }

  if (requestedBranchId) {
    dashboardQuery.set("branchId", requestedBranchId);
  }

  const [dashboard, branches, oversightRegions, districts] = await Promise.all([
    serverGet<DashboardOverview>(`/reports/dashboard?${dashboardQuery.toString()}`),
    serverGet<BranchSummary[]>("/branches").catch(() => []),
    serverGet<OversightRegionOption[]>("/oversight-regions").catch(() => []),
    serverGet<DistrictOption[]>("/districts").catch(() => []),
  ]);

  const activeOversightRegion = dashboard.scope.oversightRegion;
  const activeDistrict = dashboard.scope.district;
  const canChooseRegion = isGlobalRole(user.role);
  const canChooseDistrict = isGlobalRole(user.role) || isNationalRole(user.role);
  const canChooseBranch = canFilterAcrossBranches(user.role);

  const metricCards = [
    {
      label: "Total guests",
      value: formatCount(dashboard.metrics.totalGuests),
      delta: `Current records in ${dashboard.scope.label.toLowerCase()}`,
      tone: "warm" as const,
    },
    {
      label: "Total members",
      value: formatCount(dashboard.metrics.totalMembers),
      delta: `Current membership in ${dashboard.scope.label.toLowerCase()}`,
      tone: "cool" as const,
    },
    {
      label: "Total attendance",
      value: formatCount(dashboard.metrics.totalAttendance),
      delta: `Recorded across the last ${dashboard.scope.days} days`,
      tone: "cool" as const,
    },
    {
      label: "Pending follow-up",
      value: formatCount(dashboard.metrics.pendingFollowUp),
      delta: "Still waiting in new or assigned status",
      tone: "warm" as const,
    },
  ];

  return (
    <Shell>
      <PageHeader
        eyebrow={formatRoleLabel(user.role)}
        title={getDashboardTitle(dashboard.scope)}
        description={getDashboardDescription(dashboard.scope)}
        action={
          <div className="flex flex-wrap items-center gap-3">
            {isGlobalRole(user.role) ? (
              <Link
                href={buildDashboardHref({ days })}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
              >
                All network
              </Link>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                {dashboard.scope.label}
              </div>
            )}
            <Link
              href="/reports"
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Open detailed reports
            </Link>
          </div>
        }
      />

      <DashboardScopeFilterBar
        canChooseRegion={canChooseRegion}
        canChooseDistrict={canChooseDistrict}
        canChooseBranch={canChooseBranch}
        days={dashboard.scope.days}
        oversightRegion={dashboard.scope.oversightRegion}
        district={dashboard.scope.district}
        branchId={dashboard.scope.branchId}
        oversightRegions={oversightRegions}
        districts={districts}
        branches={branches}
      />

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((stat) => (
          <MetricCard key={stat.label} {...stat} />
        ))}
      </section>

      {dashboard.scope.kind !== "branch" ? (
        <section className="grid gap-6 xl:grid-cols-2">
          <WatchlistCard
            eyebrow="Reporting watchlist"
            title="Branches with no recent attendance submission"
            emptyLabel="Every branch in this scope has submitted a recent attendance summary."
          >
            <BranchAlertList
              items={dashboard.executive.branchesWithoutRecentAttendance}
              days={dashboard.scope.days}
              emptyLabel="Every branch in this scope has submitted a recent attendance summary."
              metricLabel={(item) => formatDate(item.lastSubmittedAt)}
            />
          </WatchlistCard>

          <WatchlistCard
            eyebrow="Follow-up pressure"
            title="Branches carrying the highest backlog"
            emptyLabel="No follow-up backlog is building up in the selected scope."
          >
            <BranchAlertList
              items={dashboard.executive.highFollowUpBacklog}
              days={dashboard.scope.days}
              emptyLabel="No follow-up backlog is building up in the selected scope."
              metricLabel={(item) => `${formatCount(item.pendingFollowUp ?? 0)} pending`}
            />
          </WatchlistCard>

          <WatchlistCard
            eyebrow="Growth leaders"
            title="Top growth branches in the current range"
            emptyLabel="No growth activity has been recorded in the current range yet."
          >
            <GrowthList
              items={dashboard.executive.topGrowthBranches}
              days={dashboard.scope.days}
              emptyLabel="No growth activity has been recorded in the current range yet."
            />
          </WatchlistCard>

          <WatchlistCard
            eyebrow="Coverage risk"
            title="Lowest growth branches in the current range"
            emptyLabel="No branches in this scope are showing low activity yet."
          >
            <GrowthList
              items={dashboard.executive.bottomGrowthBranches}
              days={dashboard.scope.days}
              emptyLabel="No branches in this scope are showing low activity yet."
            />
          </WatchlistCard>
        </section>
      ) : null}

      {dashboard.operational ? (
        <section className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-3xl border border-white/60 bg-white/90 p-7 shadow-sm backdrop-blur-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.125em] text-amber-600">
              Guest activity
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              Recent guest capture
            </h2>
            <div className="mt-6 space-y-3">
              {dashboard.operational.recentGuests.length ? (
                dashboard.operational.recentGuests.map((guest) => (
                  <div key={guest._id} className="rounded-2xl border border-slate-100 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {guest.firstName} {guest.lastName}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {guest.branchId?.name ?? "Branch"} · {formatStatusLabel(guest.visitStatus)}
                        </p>
                      </div>
                      <span className="text-sm text-slate-500">{formatDate(guest.createdAt)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
                  No recent guest activity in this scope yet.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/60 bg-white/90 p-7 shadow-sm backdrop-blur-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.125em] text-amber-600">
              Follow-up pipeline
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              Live care workflow counts
            </h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {dashboard.operational.followUpPipeline.map((item) => (
                <div key={item.status} className="rounded-2xl border border-slate-100 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {formatStatusLabel(item.status)}
                  </p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">
                    {formatCount(item.total)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/60 bg-white/90 p-7 shadow-sm backdrop-blur-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.125em] text-amber-600">
              Attendance mix
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              Service movement in the current range
            </h2>
            <div className="mt-6 space-y-3">
              {dashboard.operational.attendanceMix.length ? (
                dashboard.operational.attendanceMix.map((service) => (
                  <div key={service._id} className="rounded-2xl border border-slate-100 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {service._id.replace(/_/g, " ")}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatCount(service.summarySubmissions)} summary submissions
                        </p>
                      </div>
                      <span className="text-2xl font-semibold text-slate-900">
                        {formatCount(service.totalPeople)}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-orange-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-orange-700">
                        {formatCount(service.firstTimers)} first timers
                      </span>
                      <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-emerald-700">
                        {formatCount(service.newConverts)} converts
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
                  No attendance movement has been recorded in this scope yet.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/60 bg-white/90 p-7 shadow-sm backdrop-blur-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.125em] text-amber-600">
              Newest members
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              Recent member growth
            </h2>
            <div className="mt-6 space-y-3">
              {dashboard.operational.newestMembers.length ? (
                dashboard.operational.newestMembers.map((member) => (
                  <div key={member._id} className="rounded-2xl border border-slate-100 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {[member.title, member.firstName, member.lastName].filter(Boolean).join(" ")}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {member.branchId?.name ?? "Branch"} · {formatStatusLabel(member.membershipStatus)}
                        </p>
                      </div>
                      <span className="text-sm text-slate-500">{formatDate(member.createdAt)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
                  No new members have been added in this scope yet.
                </div>
              )}
            </div>
          </section>
        </section>
      ) : (
        <section className="rounded-3xl border border-white/60 bg-white/90 p-8 shadow-sm backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.125em] text-amber-600">
            Operational detail
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            Drill into a district or branch for live activity
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            Newest members, guest activity, follow-up pipeline, and attendance mix stay hidden at the
            wider network level so this dashboard stays useful when the church network grows large.
          </p>
        </section>
      )}
    </Shell>
  );
}
