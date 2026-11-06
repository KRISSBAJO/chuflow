import type { ReactNode } from "react";
import { getFormatter, getTranslations } from "next-intl/server";
import { FilterPanel } from "@/components/filter-panel";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { Badge, Button, buttonClass, Card, CardHeader, EmptyState, formatStatus, statusTone, TableWrap } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { API_URL } from "@/lib/api";
import { canFilterAcrossBranches } from "@/lib/permissions";
import { serverGet } from "@/lib/server-api";
import type { BranchSummary, MaagReportListResponse } from "@/lib/types";

const MAAG_TEXT_COLUMNS_START = ["month", "station", "status", "facility", "head"] as const;

const MAAG_NUMBER_COLUMNS = [
  "mainCap",
  "mainChairs",
  "services",
  "avgAttended",
  "highest",
  "adult",
  "children",
  "chop",
  "income",
  "rof",
  "expense",
  "wsf",
  "ft",
  "wofbi",
  "nc",
  "bfc",
  "hgb",
  "wb",
] as const;

const DISTRICT_COLUMNS = ["reports", "avgAttended", "income", "ft", "nc"] as const;
const BRANCH_COLUMNS = ["reports", "avgAttended", "income", "expense", "ft", "nc"] as const;

type StatusKey = Parameters<Awaited<ReturnType<typeof getTranslations<"statuses">>>>[0];

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

  const [report, branches, t, tStatus, format] = await Promise.all([
    serverGet<MaagReportListResponse>(`/intake-templates/maag-reports?${query.toString()}`),
    serverGet<BranchSummary[]>("/branches").catch(() => []),
    getTranslations("services.maagReports"),
    getTranslations("statuses"),
    getFormatter(),
  ]);
  const formatNumber = (value?: number) => format.number(value ?? 0);
  const money = (value?: number) => format.number(value ?? 0, { style: "currency", currency: "USD" });
  const statusLabel = (value: string) =>
    tStatus.has(value.toLowerCase() as StatusKey) ? tStatus(value.toLowerCase() as StatusKey) : formatStatus(value);
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
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        action={
          <a href={exportUrl} className={buttonClass("primary")}>
            {t("exportCsv")}
          </a>
        }
      />

      <FilterPanel><form
        className="app-rise grid gap-2 rounded-2xl border border-black/[0.06] bg-white p-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center"
        style={{ animationDelay: "60ms" }}
      >
        <input name="monthFrom" type="month" aria-label={t("fromMonth")} defaultValue={report.filters.monthFrom} className="ui-input lg:w-auto" />
        <input name="monthTo" type="month" aria-label={t("toMonth")} defaultValue={report.filters.monthTo} className="ui-input lg:w-auto" />
        {canCrossFilter ? (
          <>
            <select name="oversightRegion" aria-label={t("nationalArea")} defaultValue={oversightRegion || ""} className="ui-input lg:w-auto lg:min-w-[170px] lg:flex-1">
              <option value="">{t("allNationalAreas")}</option>
              {nationalAreas.map((area) => <option key={area} value={area}>{area}</option>)}
            </select>
            <select name="district" aria-label={t("district")} defaultValue={district || ""} className="ui-input lg:w-auto lg:min-w-[150px] lg:flex-1">
              <option value="">{t("allDistricts")}</option>
              {districts.map((districtName) => <option key={districtName} value={districtName}>{districtName}</option>)}
            </select>
            <select name="branchId" aria-label={t("branch")} defaultValue={branchId || ""} className="ui-input lg:w-auto lg:min-w-[150px] lg:flex-1">
              <option value="">{t("allBranches")}</option>
              {branchOptions.map((branch) => <option key={branch._id} value={branch._id}>{branch.name}</option>)}
            </select>
          </>
        ) : null}
        <select name="status" aria-label={t("status")} defaultValue={params.status || ""} className="ui-input lg:w-auto lg:min-w-[140px]">
          <option value="">{t("allStatuses")}</option>
          <option value="pending">{t("pending")}</option>
          <option value="approved">{t("approved")}</option>
          <option value="rejected">{t("rejected")}</option>
        </select>
        <Button type="submit" variant="secondary" icon="search">
          {t("apply")}
        </Button>
      </form></FilterPanel>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label={t("metrics.reports")} value={String(report.totals.reports ?? 0)} delta={t("metrics.pending", { count: report.totals.pending ?? 0 })} tone="cool" />
        <MetricCard label={t("metrics.avgAttendance")} value={formatNumber(report.totals.averageAttendance)} delta={t("metrics.highest", { count: formatNumber(report.totals.highestAttendance) })} tone="warm" />
        <MetricCard label={t("metrics.income")} value={money(report.totals.incomeAmount)} delta={t("metrics.expense", { amount: money(report.totals.expenseAmount) })} tone="cool" />
        <MetricCard label={t("metrics.firstTimers")} value={formatNumber(report.totals.firstTimersCount)} delta={t("metrics.newConverts", { count: formatNumber(report.totals.newConvertsCount) })} tone="warm" />
        <MetricCard label={t("metrics.baptisms")} value={formatNumber((report.totals.holyGhostBaptismCount ?? 0) + (report.totals.waterBaptismCount ?? 0))} delta={t("metrics.baptismsHint")} tone="cool" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="app-rise min-w-0 p-6 sm:p-7">
          <CardHeader label={t("districts.label")} title={t("districts.title")} />
          <div className="mt-6">
            {report.districtTotals.length === 0 ? (
              <EmptyState icon="structure" title={t("districts.emptyTitle")}>
                {t("districts.emptyBody")}
              </EmptyState>
            ) : (
              <TableWrap>
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>{t("district")}</th>
                      {DISTRICT_COLUMNS.map((column) => (
                        <th key={column} className="text-right">
                          {t(`columns.${column}`)}
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
          <CardHeader label={t("trend.label")} title={t("trend.title")} />
          <div className="mt-6">
            {report.trends.length === 0 ? (
              <EmptyState icon="maag" title={t("trend.emptyTitle")}>
                {t("trend.emptyBody")}
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
                      {t.rich("trend.income", {
                        amount: money(trend.incomeAmount),
                        n: (chunks: ReactNode) => <span className="tabular-nums">{chunks}</span>,
                      })}
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
          label={t("branches.label")}
          title={t("branches.title")}
          action={<Badge>{t("branches.watched", { count: report.scope.branchCount })}</Badge>}
        />
        <div className="mt-6">
          {report.branchTotals.length === 0 ? (
            <EmptyState icon="branches" title={t("branches.emptyTitle")}>
              {t("branches.emptyBody")}
            </EmptyState>
          ) : (
            <TableWrap>
              <table className="ui-table min-w-[900px]">
                <thead>
                  <tr>
                    <th>{t("branch")}</th>
                    <th>{t("district")}</th>
                    {BRANCH_COLUMNS.map((column) => (
                      <th key={column} className="text-right">
                        {t(`columns.${column}`)}
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
          label={t("submissions.label")}
          title={t("submissions.title")}
          action={<Badge>{t("submissions.matchesCsv")}</Badge>}
        />
        <div className="mt-6">
          <TableWrap>
            <table className="ui-table min-w-[1500px]">
              <thead>
                <tr>
                  {MAAG_TEXT_COLUMNS_START.map((column) => (
                    <th key={column}>{t(`columns.${column}`)}</th>
                  ))}
                  {MAAG_NUMBER_COLUMNS.map((column) => (
                    <th key={column} className="text-right">
                      {t(`columns.${column}`)}
                    </th>
                  ))}
                  <th>{t("columns.pastor")}</th>
                  <th>{t("columns.remarks")}</th>
                </tr>
              </thead>
              <tbody>
                {report.items.length === 0 ? (
                  <tr>
                    <td colSpan={25} className="py-10 text-center text-[#8a8780]">
                      {t("submissions.empty")}
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
                          {statusLabel(item.status)}
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
