import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { Badge, Button, buttonClass, Card, CardHeader, EmptyState, formatStatus, statusTone, TableWrap } from "@/components/ui/ui";
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

const MAAG_TEXT_COLUMNS_START = ["Month", "Station", "Status", "Facility", "Head"];

const MAAG_NUMBER_COLUMNS = [
  "Main cap",
  "Main chairs",
  "Services",
  "Avg att'd",
  "Highest",
  "Adult",
  "Children",
  "CHOP",
  "Income",
  "ROF",
  "Expense",
  "WSF",
  "FT",
  "WOFBI",
  "NC",
  "BFC",
  "HGB",
  "WB",
];

export default async function MaagReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireServerRole("/maag-reports");
  const params = await searchParams;
  const canCrossFilter = canFilterAcrossBranches(user.role, user.hasOversight);
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

  const maxTrendAttendance = Math.max(...report.trends.map((trend) => trend.averageAttendance ?? 0), 1);

  return (
    <Shell>
      <PageHeader
        eyebrow="MAAG reports"
        title="Monthly MAAG reports"
        description="Collate monthly branch MAAG reports across facility, attendance, finance, spiritual indices and pastor details."
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
        <input name="monthFrom" type="month" aria-label="From month" defaultValue={report.filters.monthFrom} className="ui-input lg:w-auto" />
        <input name="monthTo" type="month" aria-label="To month" defaultValue={report.filters.monthTo} className="ui-input lg:w-auto" />
        {canCrossFilter ? (
          <>
            <select name="oversightRegion" aria-label="National area" defaultValue={oversightRegion || ""} className="ui-input lg:w-auto lg:min-w-[170px] lg:flex-1">
              <option value="">All national areas</option>
              {nationalAreas.map((area) => <option key={area} value={area}>{area}</option>)}
            </select>
            <select name="district" aria-label="District" defaultValue={district || ""} className="ui-input lg:w-auto lg:min-w-[150px] lg:flex-1">
              <option value="">All districts</option>
              {districts.map((districtName) => <option key={districtName} value={districtName}>{districtName}</option>)}
            </select>
            <select name="branchId" aria-label="Branch" defaultValue={branchId || ""} className="ui-input lg:w-auto lg:min-w-[150px] lg:flex-1">
              <option value="">All branches</option>
              {branchOptions.map((branch) => <option key={branch._id} value={branch._id}>{branch.name}</option>)}
            </select>
          </>
        ) : null}
        <select name="status" aria-label="Status" defaultValue={params.status || ""} className="ui-input lg:w-auto lg:min-w-[140px]">
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
        <MetricCard label="Reports" value={String(report.totals.reports ?? 0)} delta={`${report.totals.pending ?? 0} pending`} tone="cool" />
        <MetricCard label="Avg attendance" value={formatNumber(report.totals.averageAttendance)} delta={`Highest ${formatNumber(report.totals.highestAttendance)}`} tone="warm" />
        <MetricCard label="Income" value={money(report.totals.incomeAmount)} delta={`Expense ${money(report.totals.expenseAmount)}`} tone="cool" />
        <MetricCard label="First timers" value={formatNumber(report.totals.firstTimersCount)} delta={`${formatNumber(report.totals.newConvertsCount)} new converts`} tone="warm" />
        <MetricCard label="Baptisms" value={formatNumber((report.totals.holyGhostBaptismCount ?? 0) + (report.totals.waterBaptismCount ?? 0))} delta="Holy Ghost + water" tone="cool" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="app-rise min-w-0 p-6 sm:p-7">
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
                      {["Reports", "Avg att'd", "Income", "FT", "NC"].map((column) => (
                        <th key={column} className="text-right">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.districtTotals.map((item) => (
                      <tr key={item.key}>
                        <td className="font-medium">{item.label}</td>
                        <td className="text-right tabular-nums text-[#55534e]">{item.reports}</td>
                        <td className="text-right tabular-nums">{formatNumber(item.averageAttendance)}</td>
                        <td className="text-right tabular-nums">{money(item.incomeAmount)}</td>
                        <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.firstTimersCount)}</td>
                        <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.newConvertsCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </div>
        </Card>

        <Card className="app-rise min-w-0 p-6 sm:p-7" style={{ animationDelay: "60ms" }}>
          <CardHeader label="Monthly trend" title="Average attendance by month" />
          <div className="mt-6">
            {report.trends.length === 0 ? (
              <EmptyState icon="maag" title="No reports yet">
                No MAAG reports in this range.
              </EmptyState>
            ) : (
              <ul className="space-y-4">
                {report.trends.map((trend, index) => (
                  <li key={trend.key}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[14px] font-medium text-[#111111]">{trend.label}</span>
                      <span className="text-[15px] font-semibold tabular-nums text-[#111111]">
                        {formatNumber(trend.averageAttendance)}
                      </span>
                    </div>
                    <span className="mt-2 block h-2 overflow-hidden rounded-full bg-[#f1f0ec]">
                      <span
                        className="app-bar block h-full rounded-full bg-[#ea580c]"
                        style={{
                          width: `${Math.max(3, ((trend.averageAttendance ?? 0) / maxTrendAttendance) * 100)}%`,
                          animationDelay: `${index * 60}ms`,
                        }}
                      />
                    </span>
                    <p className="mt-1.5 text-[12px] text-[#8a8780]">
                      Income <span className="tabular-nums">{money(trend.incomeAmount)}</span>
                    </p>
                  </li>
                ))}
              </ul>
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
                    {["Reports", "Avg att'd", "Income", "Expense", "FT", "NC"].map((column) => (
                      <th key={column} className="text-right">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.branchTotals.map((item) => (
                    <tr key={item.key}>
                      <td className="font-medium">{item.label}</td>
                      <td className="text-[#55534e]">{item.district}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{item.reports}</td>
                      <td className="text-right tabular-nums">{formatNumber(item.averageAttendance)}</td>
                      <td className="text-right tabular-nums">{money(item.incomeAmount)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{money(item.expenseAmount)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.firstTimersCount)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.newConvertsCount)}</td>
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
          title="Monthly MAAG submissions"
          action={<Badge>Matches the CSV export</Badge>}
        />
        <div className="mt-6">
          <TableWrap>
            <table className="ui-table min-w-[1500px]">
              <thead>
                <tr>
                  {MAAG_TEXT_COLUMNS_START.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                  {MAAG_NUMBER_COLUMNS.map((column) => (
                    <th key={column} className="text-right">
                      {column}
                    </th>
                  ))}
                  <th>Pastor</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {report.items.length === 0 ? (
                  <tr>
                    <td colSpan={25} className="py-10 text-center text-[#8a8780]">
                      No MAAG reports match the current filters.
                    </td>
                  </tr>
                ) : (
                  report.items.map((item) => (
                    <tr key={item._id} className="align-top">
                      <td className="whitespace-nowrap font-medium tabular-nums">{item.reportMonth}</td>
                      <td>
                        <p className="font-medium text-[#111111]">{item.stationName || item.branch.name}</p>
                        <p className="text-[12px] text-[#8a8780]">{item.branch.district}</p>
                      </td>
                      <td>
                        <Badge tone={statusTone(item.status)} dot>
                          {formatStatus(item.status)}
                        </Badge>
                      </td>
                      <td className="text-[#55534e]">{item.facilityType}</td>
                      <td className="text-[#55534e]">{item.stationHeadDesignation}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.mainHallCapacity)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.mainChairsCount)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.servicesCount)}</td>
                      <td className="text-right font-medium tabular-nums">{formatNumber(item.averageAttendance)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.highestAttendance)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.averageAdultAttendance)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.averageChildrenAttendance)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.chopAverageAttendance)}</td>
                      <td className="text-right tabular-nums">{money(item.incomeAmount)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{money(item.rofAmount)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{money(item.expenseAmount)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.wsfAverage)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.firstTimersCount)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.wofbiAttendance)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.newConvertsCount)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.foundationClassCount)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.holyGhostBaptismCount)}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{formatNumber(item.waterBaptismCount)}</td>
                      <td className="whitespace-nowrap text-[#55534e]">{item.pastorName || ""}</td>
                      <td className="max-w-[280px] text-[13px] text-[#55534e]">{item.stationStatusRemarks || ""}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableWrap>
        </div>
      </Card>
    </Shell>
  );
}
