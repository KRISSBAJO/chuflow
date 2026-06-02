import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { requireServerRole } from "@/lib/auth";
import { API_URL } from "@/lib/api";
import { canFilterAcrossBranches } from "@/lib/permissions";
import { serverGet } from "@/lib/server-api";
import type { BranchSummary, WeeklyReportListResponse } from "@/lib/types";

function dateInputValue(value?: string) {
  return value ? value.slice(0, 10) : "";
}

function formatNumber(value?: number) {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

function formatPercent(value?: number) {
  const number = value ?? 0;
  return `${number > 0 ? "+" : ""}${number}%`;
}

function statusTone(status: string) {
  switch (status) {
    case "approved":
      return "bg-emerald-50 text-emerald-700";
    case "rejected":
      return "bg-rose-50 text-rose-700";
    default:
      return "bg-amber-50 text-amber-700";
  }
}

function growthTone(value: number) {
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-rose-700";
  return "text-slate-600";
}

export default async function WeeklyReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireServerRole("/weekly-reports");
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
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  })) {
    if (value) query.set(key, value);
  }

  const [report, branches] = await Promise.all([
    serverGet<WeeklyReportListResponse>(`/intake-templates/weekly-reports?${query.toString()}`),
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
  const exportUrl = `${API_URL}/intake-templates/weekly-reports/export.csv?${query.toString()}`;
  const maxTrendAttendance = Math.max(...report.trends.map((trend) => trend.currentAttendance), 1);

  return (
    <Shell>
      <PageHeader
        eyebrow="Weekly reports"
        title="Weekly spiritual indices dashboard"
        description="Review branch submissions, district totals, national rollups, growth movement, and export-ready weekly reporting from one table."
        action={
          <form className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              name="dateFrom"
              defaultValue={dateInputValue(report.filters.dateFrom)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
            />
            <input
              type="date"
              name="dateTo"
              defaultValue={dateInputValue(report.filters.dateTo)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
            />
            {canCrossFilter ? (
              <>
                <select
                  name="oversightRegion"
                  defaultValue={oversightRegion || ""}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
                >
                  <option value="">All national areas</option>
                  {nationalAreas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
                <select
                  name="district"
                  defaultValue={district || ""}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
                >
                  <option value="">All districts</option>
                  {districts.map((districtName) => (
                    <option key={districtName} value={districtName}>
                      {districtName}
                    </option>
                  ))}
                </select>
                <select
                  name="branchId"
                  defaultValue={branchId || ""}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
                >
                  <option value="">All branches</option>
                  {branchOptions.map((branch) => (
                    <option key={branch._id} value={branch._id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            <select
              name="status"
              defaultValue={params.status || ""}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <button className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">
              Apply
            </button>
            <a href={exportUrl} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">
              Export CSV
            </a>
          </form>
        }
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Reports" value={String(report.totals.reports ?? 0)} delta={`${report.totals.pending ?? 0} pending review`} tone="cool" />
        <MetricCard label="Current attendance" value={formatNumber(report.totals.currentAttendance)} delta={`Previous ${formatNumber(report.totals.previousAttendance)}`} tone="warm" />
        <MetricCard label="Growth" value={formatNumber(report.totals.growth)} delta={formatPercent(report.totals.averageGrowthPercent)} tone="cool" />
        <MetricCard label="First timers" value={formatNumber(report.totals.firstTimersCount)} delta={`${formatNumber(report.totals.newConvertsCount)} new converts`} tone="warm" />
        <MetricCard label="Cells" value={formatNumber(report.totals.cellCount)} delta={`${formatNumber(report.totals.newCellCount)} new cells`} tone="cool" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="surface rounded-[24px] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Growth over time</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">Weekly trend</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
              {dateInputValue(report.filters.dateFrom)} to {dateInputValue(report.filters.dateTo)}
            </span>
          </div>
          <div className="mt-5 space-y-3">
            {report.trends.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
                No weekly report trend data in this range.
              </p>
            ) : (
              report.trends.slice(-12).map((trend) => (
                <div key={trend.key} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[140px_1fr_120px] md:items-center">
                  <p className="text-sm font-semibold text-slate-900">{trend.label}</p>
                  <div className="h-3 rounded-full bg-slate-100">
                    <div
                      className="h-3 rounded-full bg-slate-950"
                      style={{ width: `${Math.max(4, (trend.currentAttendance / maxTrendAttendance) * 100)}%` }}
                    />
                  </div>
                  <p className={`text-sm font-semibold ${growthTone(trend.growth)}`}>
                    {formatNumber(trend.currentAttendance)} · {formatNumber(trend.growth)}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="surface rounded-[24px] p-5">
          <p className="eyebrow">District totals</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  {["District", "Reports", "Current", "Growth"].map((column) => (
                    <th key={column} className="px-3 py-3 font-semibold">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white">
                {report.districtTotals.map((districtTotal) => (
                  <tr key={districtTotal.key} className="border-t border-slate-100">
                    <td className="px-3 py-3 font-semibold text-slate-900">{districtTotal.label}</td>
                    <td className="px-3 py-3 text-slate-600">{districtTotal.reports}</td>
                    <td className="px-3 py-3 text-slate-600">{formatNumber(districtTotal.currentAttendance)}</td>
                    <td className={`px-3 py-3 font-semibold ${growthTone(districtTotal.growth)}`}>
                      {formatNumber(districtTotal.growth)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="surface rounded-[24px] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Branch rollup</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">All branches in scope</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
            {report.scope.branchCount} branches watched
          </span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                {["Branch", "District", "Reports", "Current", "Previous", "Growth", "Growth %", "FT", "NC", "Cells"].map((column) => (
                  <th key={column} className="px-4 py-3 font-semibold">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {report.branchTotals.map((branchTotal) => (
                <tr key={branchTotal.key} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-semibold text-slate-900">{branchTotal.label}</td>
                  <td className="px-4 py-3 text-slate-600">{branchTotal.district}</td>
                  <td className="px-4 py-3 text-slate-600">{branchTotal.reports}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(branchTotal.currentAttendance)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(branchTotal.previousAttendance)}</td>
                  <td className={`px-4 py-3 font-semibold ${growthTone(branchTotal.growth)}`}>{formatNumber(branchTotal.growth)}</td>
                  <td className={`px-4 py-3 font-semibold ${growthTone(branchTotal.growth)}`}>{formatPercent(branchTotal.growthPercent)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(branchTotal.firstTimersCount)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(branchTotal.newConvertsCount)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(branchTotal.cellCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface rounded-[24px] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Submission table</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">Weekly spiritual indices</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
            Export-ready layout
          </span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1320px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                {[
                  "Week",
                  "Branch",
                  "Status",
                  "Current",
                  "Previous",
                  "Growth",
                  "Growth %",
                  "Avg LY",
                  "Avg recent",
                  "FT",
                  "NC",
                  "BFC",
                  "HGB",
                  "WB",
                  "CHOP",
                  "WSF",
                  "Cells",
                  "New cells",
                  "WOFBI",
                  "Remarks",
                ].map((column) => (
                  <th key={column} className="px-4 py-3 font-semibold">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {report.items.length === 0 ? (
                <tr>
                  <td colSpan={20} className="px-4 py-8 text-center text-slate-500">
                    No weekly reports match the current filters.
                  </td>
                </tr>
              ) : (
                report.items.map((item) => (
                  <tr key={item._id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3 font-semibold text-slate-900">{dateInputValue(item.reportWeek)}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{item.branch.name}</p>
                      <p className="text-xs text-slate-500">{item.branch.district}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusTone(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatNumber(item.currentAttendance)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatNumber(item.previousAttendance)}</td>
                    <td className={`px-4 py-3 font-semibold ${growthTone(item.growth)}`}>{formatNumber(item.growth)}</td>
                    <td className={`px-4 py-3 font-semibold ${growthTone(item.growth)}`}>{formatPercent(item.growthPercent)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatNumber(item.averageLastYear)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatNumber(item.averageLastPeriod)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatNumber(item.firstTimersCount)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatNumber(item.newConvertsCount)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatNumber(item.believersFoundationClassCount)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatNumber(item.holySpiritBaptismCount)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatNumber(item.waterBaptismCount)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatNumber(item.covenantHourOfPrayerAttendance)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatNumber(item.winnersSatelliteFellowshipAverage)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatNumber(item.cellCount)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatNumber(item.newCellCount)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatNumber(item.wofbiAttendance)}</td>
                    <td className="max-w-[280px] px-4 py-3 text-slate-600">{item.remarks || ""}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-950">
              <tr>
                <td className="px-4 py-3" colSpan={3}>Totals</td>
                <td className="px-4 py-3">{formatNumber(report.totals.currentAttendance)}</td>
                <td className="px-4 py-3">{formatNumber(report.totals.previousAttendance)}</td>
                <td className={`px-4 py-3 ${growthTone(report.totals.growth)}`}>{formatNumber(report.totals.growth)}</td>
                <td className={`px-4 py-3 ${growthTone(report.totals.growth)}`}>{formatPercent(report.totals.averageGrowthPercent)}</td>
                <td className="px-4 py-3" colSpan={2}></td>
                <td className="px-4 py-3">{formatNumber(report.totals.firstTimersCount)}</td>
                <td className="px-4 py-3">{formatNumber(report.totals.newConvertsCount)}</td>
                <td className="px-4 py-3">{formatNumber(report.totals.believersFoundationClassCount)}</td>
                <td className="px-4 py-3">{formatNumber(report.totals.holySpiritBaptismCount)}</td>
                <td className="px-4 py-3">{formatNumber(report.totals.waterBaptismCount)}</td>
                <td className="px-4 py-3">{formatNumber(report.totals.covenantHourOfPrayerAttendance)}</td>
                <td className="px-4 py-3">{formatNumber(report.totals.winnersSatelliteFellowshipAverage)}</td>
                <td className="px-4 py-3">{formatNumber(report.totals.cellCount)}</td>
                <td className="px-4 py-3">{formatNumber(report.totals.newCellCount)}</td>
                <td className="px-4 py-3">{formatNumber(report.totals.wofbiAttendance)}</td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </Shell>
  );
}
