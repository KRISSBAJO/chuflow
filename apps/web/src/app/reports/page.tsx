import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { requireServerRole } from "@/lib/auth";
import { canFilterAcrossBranches } from "@/lib/permissions";
import { serverGet } from "@/lib/server-api";
import type { BranchSummary, ReportsSummary, SettingsOverview } from "@/lib/types";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; branchId?: string }>;
}) {
  const user = await requireServerRole("/reports");
  const params = await searchParams;
  const settingsOverview = await serverGet<SettingsOverview>("/settings/overview").catch(() => ({
    app: {
      organizationName: "ChuFlow",
      organizationTagline: "From Membership to Ministry",
      publicConnectEnabled: true,
      defaultReportDays: 30,
    },
    preferences: {
      interfaceDensity: "comfortable" as const,
      defaultReportDays: 30,
    },
  }));
  const days =
    Number(params.days) ||
    user.preferences?.defaultReportDays ||
    settingsOverview.preferences.defaultReportDays ||
    settingsOverview.app.defaultReportDays ||
    30;
  const branchId = canFilterAcrossBranches(user.role) ? params.branchId?.trim() : user.branchId;
  const query = new URLSearchParams({ days: String(days) });

  if (branchId) {
    query.set("branchId", branchId);
  }

  const [summary, branches] = await Promise.all([
    serverGet<ReportsSummary>(`/reports/summary?${query.toString()}`),
    serverGet<BranchSummary[]>("/branches").catch(() => []),
  ]);

  const metrics = [
    {
      label: "Guest total",
      value: summary.totals.guestTotal,
      delta: "Current scoped guest records",
      tone: "warm" as const,
    },
    {
      label: "Member total",
      value: summary.totals.memberTotal,
      delta: "Current scoped member records",
      tone: "cool" as const,
    },
    {
      label: "Attendance total",
      value: summary.totals.attendanceTotal,
      delta: "Attendance recorded in the last 30 days",
      tone: "cool" as const,
    },
    {
      label: "First timers",
      value: summary.totals.firstTimersTotal,
      delta: "Captured from attendance summaries",
      tone: "warm" as const,
    },
    {
      label: "New converts",
      value: summary.totals.newConvertsTotal,
      delta: "Counted across recorded services",
      tone: "cool" as const,
    },
    {
      label: "Conversion rate",
      value: `${summary.totals.conversionRate}%`,
      delta: `Return rate ${summary.totals.returnRate}%`,
      tone: "warm" as const,
    },
  ];

  return (
    <Shell>
      <PageHeader
        eyebrow="Reports"
        title="Leadership reporting console"
        description={`Live ministry reporting across capture, follow-up, conversion, and attendance for the last ${days} days.`}
        action={
          <form className="flex flex-wrap items-center gap-2">
            <select
              name="days"
              defaultValue={String(days)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
            >
              {[7, 14, 30, 60, 90].map((value) => (
                <option key={value} value={value}>
                  Last {value} days
                </option>
              ))}
            </select>
            {canFilterAcrossBranches(user.role) ? (
              <select
                name="branchId"
                defaultValue={branchId || ""}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
              >
                <option value="">All branches</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            ) : null}
            <button className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">
              Apply
            </button>
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/reports/export.csv?${query.toString()}`}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Export CSV
            </a>
          </form>
        }
      />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="surface rounded-[32px] p-7">
          <p className="eyebrow">Daily trend</p>
          <div className="mt-5 space-y-3">
            {summary.trends.slice(-10).map((trend) => (
              <div key={trend.date} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">{trend.date}</p>
                  <div className="flex gap-3 text-sm">
                    <span className="rounded-full bg-orange-50 px-3 py-1 font-semibold text-orange-900">
                      {trend.guests} guests
                    </span>
                    <span className="rounded-full bg-sky-50 px-3 py-1 font-semibold text-sky-900">
                      {trend.attendance} attendance
                    </span>
                    <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-900">
                      {trend.firstTimers} first timers
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="surface rounded-[32px] p-7">
          <p className="eyebrow">Follow-up breakdown</p>
          <div className="mt-5 space-y-3">
            {summary.followUpBreakdown.map((item) => (
              <div key={item._id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <span className="font-semibold capitalize text-slate-900">{item._id.replace(/_/g, " ")}</span>
                <span className="text-2xl font-bold text-slate-950">{item.total}</span>
              </div>
            ))}
          </div>
        </section>
      </section>
      <section className="grid gap-4 lg:grid-cols-3">
        <section className="surface rounded-[24px] p-5">
          <p className="eyebrow">Range</p>
          <p className="mt-3 text-sm text-slate-600">
            {new Date(summary.range.startDate).toLocaleDateString()} to{" "}
            {new Date(summary.range.endDate).toLocaleDateString()}
          </p>
        </section>
        <section className="surface rounded-[24px] p-5">
          <p className="eyebrow">Summary submissions</p>
          <p className="mt-3 text-sm text-slate-600">
            {summary.totals.summarySubmissionTotal} service totals recorded in the current range.
          </p>
        </section>
        <section className="surface rounded-[24px] p-5">
          <p className="eyebrow">Adults / children</p>
          <p className="mt-3 text-sm text-slate-600">
            Adults {summary.totals.adultsTotal} · Children {summary.totals.childrenTotal}
          </p>
        </section>
      </section>
      <section className="surface rounded-[32px] p-7">
        <p className="eyebrow">Service mix</p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {["Service", "People", "First timers", "New converts", "Summaries"].map((column) => (
                  <th key={column} className="px-4 py-3 font-semibold">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {summary.serviceMix.map((service) => (
                <tr key={service._id} className="border-t border-slate-100">
                  <td className="px-4 py-4 font-semibold capitalize text-slate-900">{service._id.replace(/_/g, " ")}</td>
                  <td className="px-4 py-4 text-slate-600">{service.totalPeople}</td>
                  <td className="px-4 py-4 text-slate-600">{service.firstTimers}</td>
                  <td className="px-4 py-4 text-slate-600">{service.newConverts}</td>
                  <td className="px-4 py-4 text-slate-600">{service.summarySubmissions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Shell>
  );
}
