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

function DashboardTableSection({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.125em] text-teal-700">{eyebrow}</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function BranchAlertTable({
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
      <div className="m-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-5 py-3">Branch</th>
            <th className="px-5 py-3">District</th>
            <th className="px-5 py-3">Location</th>
            <th className="px-5 py-3">Signal</th>
            <th className="px-5 py-3 text-right">Open</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {items.map((item) => (
            <tr key={item._id}>
              <td className="px-5 py-3 font-semibold text-slate-950">{item.name}</td>
              <td className="px-5 py-3 text-slate-600">
                {item.district}
                <span className="block text-xs text-slate-400">{item.oversightRegion}</span>
              </td>
              <td className="px-5 py-3 text-slate-600">
                {item.city && item.state ? `${item.city}, ${item.state}` : "In scope"}
              </td>
              <td className="px-5 py-3">
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {metricLabel(item)}
                </span>
              </td>
              <td className="px-5 py-3 text-right">
                <Link
                  href={buildDashboardHref({ days, branchId: item._id })}
                  className="font-semibold text-teal-700 underline underline-offset-4 transition hover:text-teal-900"
                >
                  Dashboard
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GrowthTable({
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
      <div className="m-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-5 py-3">Branch</th>
            <th className="px-5 py-3">Guests</th>
            <th className="px-5 py-3">Members</th>
            <th className="px-5 py-3">Converts</th>
            <th className="px-5 py-3">Score</th>
            <th className="px-5 py-3 text-right">Open</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {items.map((item) => (
            <tr key={item._id}>
              <td className="px-5 py-3 font-semibold text-slate-950">
                {item.name}
                <span className="block text-xs font-normal text-slate-400">
                  {item.district} · {item.oversightRegion}
                </span>
              </td>
              <td className="px-5 py-3 text-slate-700">{formatCount(item.guestsCaptured)}</td>
              <td className="px-5 py-3 text-slate-700">{formatCount(item.membersAdded)}</td>
              <td className="px-5 py-3 text-slate-700">{formatCount(item.newConverts)}</td>
              <td className="px-5 py-3">
                <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  {formatCount(item.growthScore)}
                </span>
              </td>
              <td className="px-5 py-3 text-right">
                <Link
                  href={buildDashboardHref({ days, branchId: item._id })}
                  className="font-semibold text-teal-700 underline underline-offset-4 transition hover:text-teal-900"
                >
                  Dashboard
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PersonTable({
  items,
  emptyLabel,
}: {
  items: NonNullable<DashboardOverview["operational"]>["recentGuests"];
  emptyLabel: string;
}) {
  if (!items.length) {
    return (
      <div className="m-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-5 py-3">Name</th>
            <th className="px-5 py-3">Branch</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {items.map((item) => (
            <tr key={item._id}>
              <td className="px-5 py-3 font-semibold text-slate-950">
                {item.firstName} {item.lastName}
              </td>
              <td className="px-5 py-3 text-slate-600">{item.branchId?.name ?? "Branch"}</td>
              <td className="px-5 py-3 text-slate-600">{formatStatusLabel(item.visitStatus)}</td>
              <td className="px-5 py-3 text-slate-600">{formatDate(item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MemberTable({
  items,
  emptyLabel,
}: {
  items: NonNullable<DashboardOverview["operational"]>["newestMembers"];
  emptyLabel: string;
}) {
  if (!items.length) {
    return (
      <div className="m-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-5 py-3">Name</th>
            <th className="px-5 py-3">Branch</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {items.map((item) => (
            <tr key={item._id}>
              <td className="px-5 py-3 font-semibold text-slate-950">
                {[item.title, item.firstName, item.lastName].filter(Boolean).join(" ")}
              </td>
              <td className="px-5 py-3 text-slate-600">{item.branchId?.name ?? "Branch"}</td>
              <td className="px-5 py-3 text-slate-600">{formatStatusLabel(item.membershipStatus)}</td>
              <td className="px-5 py-3 text-slate-600">{formatDate(item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AttendanceMixTable({
  items,
}: {
  items: NonNullable<DashboardOverview["operational"]>["attendanceMix"];
}) {
  if (!items.length) {
    return (
      <div className="m-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
        No attendance movement has been recorded in this scope yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-5 py-3">Service</th>
            <th className="px-5 py-3">Total</th>
            <th className="px-5 py-3">First timers</th>
            <th className="px-5 py-3">Converts</th>
            <th className="px-5 py-3">Submissions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {items.map((item) => (
            <tr key={item._id}>
              <td className="px-5 py-3 font-semibold text-slate-950">
                {item._id.replace(/_/g, " ")}
              </td>
              <td className="px-5 py-3 text-slate-700">{formatCount(item.totalPeople)}</td>
              <td className="px-5 py-3 text-slate-700">{formatCount(item.firstTimers)}</td>
              <td className="px-5 py-3 text-slate-700">{formatCount(item.newConverts)}</td>
              <td className="px-5 py-3 text-slate-700">{formatCount(item.summarySubmissions)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
                className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                All network
              </Link>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                {dashboard.scope.label}
              </div>
            )}
            <Link
              href="/reports"
              className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
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
          <DashboardTableSection
            eyebrow="Reporting watchlist"
            title="Branches with no recent attendance submission"
          >
            <BranchAlertTable
              items={dashboard.executive.branchesWithoutRecentAttendance}
              days={dashboard.scope.days}
              emptyLabel="Every branch in this scope has submitted a recent attendance summary."
              metricLabel={(item) => formatDate(item.lastSubmittedAt)}
            />
          </DashboardTableSection>

          <DashboardTableSection
            eyebrow="Follow-up pressure"
            title="Branches carrying the highest backlog"
          >
            <BranchAlertTable
              items={dashboard.executive.highFollowUpBacklog}
              days={dashboard.scope.days}
              emptyLabel="No follow-up backlog is building up in the selected scope."
              metricLabel={(item) => `${formatCount(item.pendingFollowUp ?? 0)} pending`}
            />
          </DashboardTableSection>

          <DashboardTableSection
            eyebrow="Growth leaders"
            title="Top growth branches in the current range"
          >
            <GrowthTable
              items={dashboard.executive.topGrowthBranches}
              days={dashboard.scope.days}
              emptyLabel="No growth activity has been recorded in the current range yet."
            />
          </DashboardTableSection>

          <DashboardTableSection
            eyebrow="Coverage risk"
            title="Lowest growth branches in the current range"
          >
            <GrowthTable
              items={dashboard.executive.bottomGrowthBranches}
              days={dashboard.scope.days}
              emptyLabel="No branches in this scope are showing low activity yet."
            />
          </DashboardTableSection>
        </section>
      ) : null}

      {dashboard.operational ? (
        <section className="grid gap-6 xl:grid-cols-2">
          <DashboardTableSection eyebrow="Guest activity" title="Recent guest capture">
            <PersonTable
              items={dashboard.operational.recentGuests}
              emptyLabel="No recent guest activity in this scope yet."
            />
          </DashboardTableSection>

          <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.125em] text-teal-700">
              Follow-up pipeline
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              Live care workflow counts
            </h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {dashboard.operational.followUpPipeline.map((item) => (
                <div key={item.status} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {formatStatusLabel(item.status)}
                  </p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                    {formatCount(item.total)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <DashboardTableSection eyebrow="Attendance mix" title="Service movement in the current range">
            <AttendanceMixTable items={dashboard.operational.attendanceMix} />
          </DashboardTableSection>

          <DashboardTableSection eyebrow="Newest members" title="Recent member growth">
            <MemberTable
              items={dashboard.operational.newestMembers}
              emptyLabel="No new members have been added in this scope yet."
            />
          </DashboardTableSection>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.125em] text-teal-700">
            Operational detail
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
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
