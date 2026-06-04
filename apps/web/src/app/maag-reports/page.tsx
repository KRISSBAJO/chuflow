import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { requireServerRole } from "@/lib/auth";
import { API_URL } from "@/lib/api";
import { canFilterAcrossBranches } from "@/lib/permissions";
import { serverGet } from "@/lib/server-api";
import type { BranchSummary, MaagReportListResponse } from "@/lib/types";

function formatNumber(value?: number) {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

function money(value?: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value ?? 0);
}

function statusTone(status: string) {
  if (status === "approved") return "bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "bg-rose-50 text-rose-700";
  return "bg-amber-50 text-amber-700";
}

export default async function MaagReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireServerRole("/maag-reports");
  const params = await searchParams;
  const canCrossFilter = canFilterAcrossBranches(user.role);
  const query = new URLSearchParams();
  const branchId = canCrossFilter ? params.branchId?.trim() : user.branchId;
  const oversightRegion = canCrossFilter ? params.oversightRegion?.trim() : user.oversightRegion;
  const district = canCrossFilter ? params.district?.trim() : user.district;

  for (const [key, value] of Object.entries({
    branchId,
    oversightRegion,
    district,
    status: params.status,
    monthFrom: params.monthFrom,
    monthTo: params.monthTo,
  })) {
    if (value) query.set(key, value);
  }

  const [report, branches] = await Promise.all([
    serverGet<MaagReportListResponse>(`/intake-templates/maag-reports?${query.toString()}`),
    serverGet<BranchSummary[]>("/branches").catch(() => []),
  ]);
  const scopedBranches = report.scope.branches.length > 0 ? report.scope.branches : branches;
  const nationalAreas = Array.from(new Set(scopedBranches.map((branch) => branch.oversightRegion).filter(Boolean))).sort();
  const districts = Array.from(
    new Set(
      scopedBranches
        .filter((branch) => !oversightRegion || branch.oversightRegion === oversightRegion)
        .map((branch) => branch.district)
        .filter(Boolean),
    ),
  ).sort();
  const branchOptions = scopedBranches.filter(
    (branch) =>
      (!oversightRegion || branch.oversightRegion === oversightRegion) &&
      (!district || branch.district === district),
  );
  const exportUrl = `${API_URL}/intake-templates/maag-reports/export.csv?${query.toString()}`;

  return (
    <Shell>
      <PageHeader
        eyebrow="MAAG reports"
        title="Monthly MAAG reporting console"
        description="Collate monthly branch MAAG reports across facility, attendance, finance, spiritual indices, and pastor details."
        action={
          <form className="flex flex-wrap items-center gap-2">
            <input name="monthFrom" type="month" defaultValue={report.filters.monthFrom} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none" />
            <input name="monthTo" type="month" defaultValue={report.filters.monthTo} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none" />
            {canCrossFilter ? (
              <>
                <select name="oversightRegion" defaultValue={oversightRegion || ""} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none">
                  <option value="">All national areas</option>
                  {nationalAreas.map((area) => <option key={area} value={area}>{area}</option>)}
                </select>
                <select name="district" defaultValue={district || ""} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none">
                  <option value="">All districts</option>
                  {districts.map((districtName) => <option key={districtName} value={districtName}>{districtName}</option>)}
                </select>
                <select name="branchId" defaultValue={branchId || ""} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none">
                  <option value="">All branches</option>
                  {branchOptions.map((branch) => <option key={branch._id} value={branch._id}>{branch.name}</option>)}
                </select>
              </>
            ) : null}
            <select name="status" defaultValue={params.status || ""} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none">
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <button className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Apply</button>
            <a href={exportUrl} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Export CSV</a>
          </form>
        }
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Reports" value={String(report.totals.reports ?? 0)} delta={`${report.totals.pending ?? 0} pending`} tone="cool" />
        <MetricCard label="Avg attendance" value={formatNumber(report.totals.averageAttendance)} delta={`Highest ${formatNumber(report.totals.highestAttendance)}`} tone="warm" />
        <MetricCard label="Income" value={money(report.totals.incomeAmount)} delta={`Expense ${money(report.totals.expenseAmount)}`} tone="cool" />
        <MetricCard label="First timers" value={formatNumber(report.totals.firstTimersCount)} delta={`${formatNumber(report.totals.newConvertsCount)} new converts`} tone="warm" />
        <MetricCard label="Baptisms" value={formatNumber((report.totals.holyGhostBaptismCount ?? 0) + (report.totals.waterBaptismCount ?? 0))} delta="Holy Ghost + water" tone="cool" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <section className="surface rounded-[24px] p-5">
          <p className="eyebrow">District totals</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>{["District", "Reports", "Avg att'd", "Income", "FT", "NC"].map((column) => <th key={column} className="px-3 py-3 font-semibold">{column}</th>)}</tr>
              </thead>
              <tbody className="bg-white">
                {report.districtTotals.map((item) => (
                  <tr key={item.key} className="border-t border-slate-100">
                    <td className="px-3 py-3 font-semibold text-slate-900">{item.label}</td>
                    <td className="px-3 py-3 text-slate-600">{item.reports}</td>
                    <td className="px-3 py-3 text-slate-600">{formatNumber(item.averageAttendance)}</td>
                    <td className="px-3 py-3 text-slate-600">{money(item.incomeAmount)}</td>
                    <td className="px-3 py-3 text-slate-600">{formatNumber(item.firstTimersCount)}</td>
                    <td className="px-3 py-3 text-slate-600">{formatNumber(item.newConvertsCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="surface rounded-[24px] p-5">
          <p className="eyebrow">Monthly trend</p>
          <div className="mt-4 space-y-3">
            {report.trends.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">No MAAG reports in this range.</p>
            ) : report.trends.map((trend) => (
              <div key={trend.key} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <span className="font-semibold text-slate-900">{trend.label}</span>
                <span className="text-sm text-slate-600">{formatNumber(trend.averageAttendance)} avg att'd · {money(trend.incomeAmount)}</span>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="surface rounded-[24px] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Branch rollup</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">All branches in scope</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">{report.scope.branchCount} branches watched</span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>{["Branch", "District", "Reports", "Avg att'd", "Income", "Expense", "FT", "NC"].map((column) => <th key={column} className="px-4 py-3 font-semibold">{column}</th>)}</tr>
            </thead>
            <tbody className="bg-white">
              {report.branchTotals.map((item) => (
                <tr key={item.key} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-semibold text-slate-900">{item.label}</td>
                  <td className="px-4 py-3 text-slate-600">{item.district}</td>
                  <td className="px-4 py-3 text-slate-600">{item.reports}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(item.averageAttendance)}</td>
                  <td className="px-4 py-3 text-slate-600">{money(item.incomeAmount)}</td>
                  <td className="px-4 py-3 text-slate-600">{money(item.expenseAmount)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(item.firstTimersCount)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(item.newConvertsCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface rounded-[24px] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">MAAG report table</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">Monthly submissions</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">Export-ready</span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1500px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                {["Month", "Station", "Status", "Facility", "Head", "Main cap", "Main chairs", "Services", "Avg att'd", "Highest", "Adult", "Children", "CHOP", "Income", "ROF", "Expense", "WSF", "FT", "WOFBI", "NC", "BFC", "HGB", "WB", "Pastor", "Remarks"].map((column) => (
                  <th key={column} className="px-4 py-3 font-semibold">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {report.items.length === 0 ? (
                <tr><td colSpan={25} className="px-4 py-8 text-center text-slate-500">No MAAG reports match the current filters.</td></tr>
              ) : report.items.map((item) => (
                <tr key={item._id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3 font-semibold text-slate-900">{item.reportMonth}</td>
                  <td className="px-4 py-3"><p className="font-semibold text-slate-900">{item.stationName || item.branch.name}</p><p className="text-xs text-slate-500">{item.branch.district}</p></td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusTone(item.status)}`}>{item.status}</span></td>
                  <td className="px-4 py-3 text-slate-600">{item.facilityType}</td>
                  <td className="px-4 py-3 text-slate-600">{item.stationHeadDesignation}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(item.mainHallCapacity)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(item.mainChairsCount)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(item.servicesCount)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(item.averageAttendance)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(item.highestAttendance)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(item.averageAdultAttendance)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(item.averageChildrenAttendance)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(item.chopAverageAttendance)}</td>
                  <td className="px-4 py-3 text-slate-600">{money(item.incomeAmount)}</td>
                  <td className="px-4 py-3 text-slate-600">{money(item.rofAmount)}</td>
                  <td className="px-4 py-3 text-slate-600">{money(item.expenseAmount)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(item.wsfAverage)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(item.firstTimersCount)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(item.wofbiAttendance)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(item.newConvertsCount)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(item.foundationClassCount)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(item.holyGhostBaptismCount)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(item.waterBaptismCount)}</td>
                  <td className="px-4 py-3 text-slate-600">{item.pastorName || ""}</td>
                  <td className="max-w-[280px] px-4 py-3 text-slate-600">{item.stationStatusRemarks || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Shell>
  );
}
