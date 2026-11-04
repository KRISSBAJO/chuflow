import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { Badge, Button, buttonClass, Card, CardHeader, EmptyState, formatStatus, statusTone, TableWrap } from "@/components/ui/ui";
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

function growthTone(value: number) {
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-red-700";
  return "text-[#6b6b6b]";
}

const WEEKLY_NUMBER_COLUMNS = [
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
];

const BRANCH_NUMBER_COLUMNS = ["Reports", "Current", "Previous", "Growth", "Growth %", "FT", "NC", "Cells"];

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
        title="Weekly spiritual indices"
        description="Review branch submissions, district totals, national rollups and growth, then export weekly reporting in one click."
        action={
          <a href={exportUrl} className={buttonClass("primary")}>
            Export CSV
          </a>
        }
      />

      <form
        className="app-rise grid gap-2 rounded-2xl border border-black/[0.06] bg-white p-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center"
        style={{ animationDelay: "60ms" }}
      >
        <input
          type="date"
          name="dateFrom"
          aria-label="From date"
          defaultValue={dateInputValue(report.filters.dateFrom)}
          className="ui-input lg:w-auto"
        />
        <input
          type="date"
          name="dateTo"
          aria-label="To date"
          defaultValue={dateInputValue(report.filters.dateTo)}
          className="ui-input lg:w-auto"
        />
        {canCrossFilter ? (
          <>
            <select
              name="oversightRegion"
              aria-label="National area"
              defaultValue={oversightRegion || ""}
              className="ui-input lg:w-auto lg:min-w-[170px] lg:flex-1"
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
              aria-label="District"
              defaultValue={district || ""}
              className="ui-input lg:w-auto lg:min-w-[150px] lg:flex-1"
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
              aria-label="Branch"
              defaultValue={branchId || ""}
              className="ui-input lg:w-auto lg:min-w-[150px] lg:flex-1"
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
          aria-label="Status"
          defaultValue={params.status || ""}
          className="ui-input lg:w-auto lg:min-w-[140px]"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <Button type="submit" variant="secondary" icon="search">
          Apply
        </Button>
      </form>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Reports" value={String(report.totals.reports ?? 0)} delta={`${report.totals.pending ?? 0} pending review`} tone="cool" />
        <MetricCard label="Current attendance" value={formatNumber(report.totals.currentAttendance)} delta={`Previous ${formatNumber(report.totals.previousAttendance)}`} tone="warm" />
        <MetricCard label="Growth" value={formatNumber(report.totals.growth)} delta={formatPercent(report.totals.averageGrowthPercent)} tone="cool" />
        <MetricCard label="First timers" value={formatNumber(report.totals.firstTimersCount)} delta={`${formatNumber(report.totals.newConvertsCount)} new converts`} tone="warm" />
        <MetricCard label="Cells" value={formatNumber(report.totals.cellCount)} delta={`${formatNumber(report.totals.newCellCount)} new cells`} tone="cool" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="app-rise min-w-0 p-6 sm:p-7">
          <CardHeader
            label="Growth over time"
            title="Weekly trend"
            action={
              <Badge>
                {dateInputValue(report.filters.dateFrom)} to {dateInputValue(report.filters.dateTo)}
              </Badge>
            }
          />
          <div className="mt-6">
            {report.trends.length === 0 ? (
              <EmptyState icon="trendUp" title="No trend yet">
                No weekly report trend data in this range.
              </EmptyState>
            ) : (
              <ul className="space-y-4">
                {report.trends.slice(-12).map((trend, index) => (
                  <li key={trend.key} className="grid items-center gap-x-4 gap-y-1.5 sm:grid-cols-[120px_minmax(0,1fr)_auto]">
                    <span className="truncate text-[13px] font-medium text-[#111111]">{trend.label}</span>
                    <span className="block h-2 overflow-hidden rounded-full bg-[#f1f0ec]">
                      <span
                        className="app-bar block h-full rounded-full bg-[#ea580c]"
                        style={{
                          width: `${Math.max(4, (trend.currentAttendance / maxTrendAttendance) * 100)}%`,
                          animationDelay: `${index * 50}ms`,
                        }}
                      />
                    </span>
                    <span className="flex items-baseline justify-end gap-2 text-[14px] tabular-nums">
                      <span className="font-semibold text-[#111111]">{formatNumber(trend.currentAttendance)}</span>
                      <span className={`w-14 text-right text-[12px] font-medium ${growthTone(trend.growth)}`}>
                        {trend.growth > 0 ? "+" : ""}
                        {formatNumber(trend.growth)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="app-rise min-w-0 p-6 sm:p-7" style={{ animationDelay: "60ms" }}>
          <CardHeader label="District totals" title="By district" />
          <div className="mt-6">
            {report.districtTotals.length === 0 ? (
              <EmptyState icon="structure" title="No district totals">
                District totals will appear once reports are submitted.
              </EmptyState>
            ) : (
              <TableWrap>
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>District</th>
                      <th className="text-right">Reports</th>
                      <th className="text-right">Current</th>
                      <th className="text-right">Growth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.districtTotals.map((districtTotal) => (
                      <tr key={districtTotal.key}>
                        <td className="font-medium">{districtTotal.label}</td>
                        <td className="text-right tabular-nums text-[#55534e]">{districtTotal.reports}</td>
                        <td className="text-right tabular-nums">{formatNumber(districtTotal.currentAttendance)}</td>
                        <td className={`text-right font-medium tabular-nums ${growthTone(districtTotal.growth)}`}>
                          {formatNumber(districtTotal.growth)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </div>
        </Card>
      </section>

      <Card className="app-rise min-w-0 p-6 sm:p-7">
        <CardHeader
          label="Branch rollup"
          title="All branches in scope"
          action={<Badge>{report.scope.branchCount} branches watched</Badge>}
        />
        <div className="mt-6">
          {report.branchTotals.length === 0 ? (
            <EmptyState icon="branches" title="No branch totals">
              Branch totals will appear once reports are submitted.
            </EmptyState>
          ) : (
            <TableWrap>
              <table className="ui-table min-w-[900px]">
                <thead>
                  <tr>
                    <th>Branch</th>
                    <th>District</th>
                    {BRANCH_NUMBER_COLUMNS.map((column) => (
                      <th key={column} className="text-right">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.branchTotals.map((branchTotal) => (
                    <tr key={branchTotal.key}>
                      <td className="font-medium">{branchTotal.label}</td>
                      <td className="text-[#55534e]">{branchTotal.district}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{branchTotal.reports}</td>
                      <td className="text-right tabular-nums">{formatNumber(branchTotal.currentAttendance)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(branchTotal.previousAttendance)}</td>
                      <td className={`text-right font-medium tabular-nums ${growthTone(branchTotal.growth)}`}>{formatNumber(branchTotal.growth)}</td>
                      <td className={`text-right font-medium tabular-nums ${growthTone(branchTotal.growth)}`}>{formatPercent(branchTotal.growthPercent)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(branchTotal.firstTimersCount)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(branchTotal.newConvertsCount)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(branchTotal.cellCount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </div>
      </Card>

      <Card className="app-rise min-w-0 p-6 sm:p-7">
        <CardHeader
          label="Submissions"
          title="Weekly spiritual indices"
          description="FT first timers · NC new converts · BFC believers foundation class · HGB Holy Ghost baptism · WB water baptism · CHOP covenant hour of prayer · WSF Winners satellite fellowship."
          action={<Badge>Matches the CSV export</Badge>}
        />
        <div className="mt-6">
          <TableWrap>
            <table className="ui-table min-w-[1320px]">
              <thead>
                <tr>
                  <th>Week</th>
                  <th>Branch</th>
                  <th>Status</th>
                  {WEEKLY_NUMBER_COLUMNS.map((column) => (
                    <th key={column} className="text-right">
                      {column}
                    </th>
                  ))}
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {report.items.length === 0 ? (
                  <tr>
                    <td colSpan={20} className="py-10 text-center text-[#8a8780]">
                      No weekly reports match the current filters.
                    </td>
                  </tr>
                ) : (
                  report.items.map((item) => (
                    <tr key={item._id} className="align-top">
                      <td className="whitespace-nowrap font-medium tabular-nums">{dateInputValue(item.reportWeek)}</td>
                      <td>
                        <p className="font-medium text-[#111111]">{item.branch.name}</p>
                        <p className="text-[12px] text-[#8a8780]">{item.branch.district}</p>
                      </td>
                      <td>
                        <Badge tone={statusTone(item.status)} dot>
                          {formatStatus(item.status)}
                        </Badge>
                      </td>
                      <td className="text-right font-medium tabular-nums">{formatNumber(item.currentAttendance)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.previousAttendance)}</td>
                      <td className={`text-right font-medium tabular-nums ${growthTone(item.growth)}`}>{formatNumber(item.growth)}</td>
                      <td className={`text-right font-medium tabular-nums ${growthTone(item.growth)}`}>{formatPercent(item.growthPercent)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.averageLastYear)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.averageLastPeriod)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.firstTimersCount)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.newConvertsCount)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.believersFoundationClassCount)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.holySpiritBaptismCount)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.waterBaptismCount)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.covenantHourOfPrayerAttendance)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.winnersSatelliteFellowshipAverage)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.cellCount)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.newCellCount)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.wofbiAttendance)}</td>
                      <td className="max-w-[280px] text-[13px] text-[#55534e]">{item.remarks || ""}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="text-[14px] font-semibold text-[#111111]">
                <tr className="[&>td]:border-t [&>td]:border-black/[0.08] [&>td]:bg-[#f6f5f1] [&>td]:px-3 [&>td]:py-3.5">
                  <td colSpan={3} className="rounded-l-xl">Totals</td>
                  <td className="text-right tabular-nums">{formatNumber(report.totals.currentAttendance)}</td>
                  <td className="text-right tabular-nums">{formatNumber(report.totals.previousAttendance)}</td>
                  <td className={`text-right tabular-nums ${growthTone(report.totals.growth)}`}>{formatNumber(report.totals.growth)}</td>
                  <td className={`text-right tabular-nums ${growthTone(report.totals.growth)}`}>{formatPercent(report.totals.averageGrowthPercent)}</td>
                  <td colSpan={2}></td>
                  <td className="text-right tabular-nums">{formatNumber(report.totals.firstTimersCount)}</td>
                  <td className="text-right tabular-nums">{formatNumber(report.totals.newConvertsCount)}</td>
                  <td className="text-right tabular-nums">{formatNumber(report.totals.believersFoundationClassCount)}</td>
                  <td className="text-right tabular-nums">{formatNumber(report.totals.holySpiritBaptismCount)}</td>
                  <td className="text-right tabular-nums">{formatNumber(report.totals.waterBaptismCount)}</td>
                  <td className="text-right tabular-nums">{formatNumber(report.totals.covenantHourOfPrayerAttendance)}</td>
                  <td className="text-right tabular-nums">{formatNumber(report.totals.winnersSatelliteFellowshipAverage)}</td>
                  <td className="text-right tabular-nums">{formatNumber(report.totals.cellCount)}</td>
                  <td className="text-right tabular-nums">{formatNumber(report.totals.newCellCount)}</td>
                  <td className="text-right tabular-nums">{formatNumber(report.totals.wofbiAttendance)}</td>
                  <td className="rounded-r-xl"></td>
                </tr>
              </tfoot>
            </table>
          </TableWrap>
        </div>
      </Card>
    </Shell>
  );
}
