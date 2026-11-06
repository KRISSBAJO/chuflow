import Link from "next/link";
import { WorkspaceTabs } from "@/components/workspace-tabs";
import { ExportMenu } from "@/components/export-menu";
import { ReportComparison } from "@/components/report-comparison";
import { DirectoryPagination } from "@/components/directory-controls";
import { browseDirectory } from "@/lib/directory";
import { detailHref } from "@/lib/workspace-navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { FilterPanel } from "@/components/filter-panel";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  formatStatus,
  statusTone,
  TableWrap,
} from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { canFilterAcrossBranches } from "@/lib/permissions";
import { serverGet } from "@/lib/server-api";
import type { BranchSummary, WeeklyReportListResponse } from "@/lib/types";

function dateInputValue(value?: string) {
  return value ? value.slice(0, 10) : "";
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

type StatusKey = Parameters<
  Awaited<ReturnType<typeof getTranslations<"statuses">>>
>[0];

export default async function WeeklyReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireServerRole("/weekly-reports");
  const params = await searchParams;
  const tw = await getTranslations("workspace");
  const canCrossFilter = canFilterAcrossBranches(user.role, user.hasOversight);
  const query = new URLSearchParams();
  const weekStart = new Date();
  weekStart.setUTCDate(
    weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7),
  );
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const branchId = canCrossFilter ? params.branchId?.trim() : user.branchId;
  const oversightRegion = canCrossFilter
    ? params.oversightRegion?.trim()
    : user.oversightRegion;
  const district = canCrossFilter ? params.district?.trim() : user.district;

  for (const [key, value] of Object.entries({
    branchId,
    oversightRegion,
    district,
    status: params.status,
    dateFrom: params.dateFrom || weekStart.toISOString().slice(0, 10),
    dateTo: params.dateTo || weekEnd.toISOString().slice(0, 10),
  })) {
    if (value) query.set(key, value);
  }

  const [report, branches, t, tStatus, format] = await Promise.all([
    serverGet<WeeklyReportListResponse>(
      `/intake-templates/weekly-reports?${query.toString()}`,
    ),
    serverGet<BranchSummary[]>("/branches").catch(() => []),
    getTranslations("services.weeklyReports"),
    getTranslations("statuses"),
    getFormatter(),
  ]);
  const formatNumber = (value?: number) => format.number(value ?? 0);
  const statusLabel = (value: string) =>
    tStatus.has(value.toLowerCase() as StatusKey)
      ? tStatus(value.toLowerCase() as StatusKey)
      : formatStatus(value);
  const scopedBranches =
    report.scope.branches.length > 0 ? report.scope.branches : branches;
  const nationalAreas = Array.from(
    new Set(
      scopedBranches.map((branch) => branch.oversightRegion).filter(Boolean),
    ),
  ).sort();
  const districts = Array.from(
    new Set(
      scopedBranches
        .filter(
          (branch) =>
            !oversightRegion || branch.oversightRegion === oversightRegion,
        )
        .map((branch) => branch.district)
        .filter(Boolean),
    ),
  ).sort();
  const branchOptions = scopedBranches.filter(
    (branch) =>
      (!oversightRegion || branch.oversightRegion === oversightRegion) &&
      (!district || branch.district === district),
  );

  const maxTrendAttendance = Math.max(
    ...report.trends.map((trend) => trend.currentAttendance),
    1,
  );

  const matched = browseDirectory(
    report.items,
    params,
    (item) =>
      `${item.branch.name} ${item.branch.district} ${item.reportWeek || ""}`,
    (item) => item.branch.name,
  );
  const reporting = report.scope.branches.filter((b) => b.hasReport).length;
  const period = `${dateInputValue(report.filters.dateFrom)} – ${dateInputValue(report.filters.dateTo)}`;
  return (
    <Shell>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        action={
          <ExportMenu
            resource="weekly-reports"
            filters={Object.fromEntries(query)}
          />
        }
      />
      <form className="space-y-3">
        <input type="hidden" name="tab" value={params.tab || "overview"} />
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-black/5 bg-white p-4">
          <label className="text-xs text-[#6b6b6b]">
            {tw("period")}
            <input
              aria-label={t("fromDate")}
              className="ui-input mt-1"
              type="date"
              name="dateFrom"
              defaultValue={dateInputValue(report.filters.dateFrom)}
            />
          </label>
          <label className="text-xs text-[#6b6b6b]">
            —
            <input
              aria-label={t("toDate")}
              className="ui-input mt-1"
              type="date"
              name="dateTo"
              min={dateInputValue(report.filters.dateFrom)}
              defaultValue={dateInputValue(report.filters.dateTo)}
            />
          </label>
          <Button type="submit" variant="secondary">
            {tw("apply")}
          </Button>
          <p className="text-xs text-[#8a8780]">{tw("rangeHint")}</p>
        </div>
        <FilterPanel>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {canCrossFilter && (
              <>
                <select
                  aria-label={t("nationalArea")}
                  name="oversightRegion"
                  defaultValue={oversightRegion || ""}
                  className="ui-input"
                >
                  <option value="">{t("allNationalAreas")}</option>
                  {nationalAreas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={t("district")}
                  name="district"
                  defaultValue={district || ""}
                  className="ui-input"
                >
                  <option value="">{t("allDistricts")}</option>
                  {districts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={t("branch")}
                  name="branchId"
                  defaultValue={branchId || ""}
                  className="ui-input"
                >
                  <option value="">{t("allBranches")}</option>
                  {branchOptions.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            <select
              aria-label={t("status")}
              name="status"
              defaultValue={params.status || ""}
              className="ui-input"
            >
              <option value="">{t("allStatuses")}</option>
              {["pending", "approved", "rejected"].map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
            <Button type="submit">{tw("apply")}</Button>
          </div>
        </FilterPanel>
      </form>
      <WorkspaceTabs
        defaultTab="overview"
        tabs={[
          {
            id: "overview",
            label: tw("overview"),
            content: (
              <>
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    label={t("metrics.reports")}
                    value={report.totals.reports || 0}
                    delta={t("metrics.pendingReview", {
                      count: report.totals.pending || 0,
                    })}
                    tone="cool"
                  />
                  <MetricCard
                    label={t("metrics.currentAttendance")}
                    value={formatNumber(report.totals.currentAttendance)}
                    delta={t("metrics.previous", {
                      count: formatNumber(report.totals.previousAttendance),
                    })}
                    tone="warm"
                  />
                  <MetricCard
                    label={t("metrics.growth")}
                    value={formatNumber(report.totals.growth)}
                    delta={formatPercent(report.totals.averageGrowthPercent)}
                    tone="cool"
                  />
                  <MetricCard
                    label={t("metrics.firstTimers")}
                    value={formatNumber(report.totals.firstTimersCount)}
                    delta={t("metrics.newConverts", {
                      count: formatNumber(report.totals.newConvertsCount),
                    })}
                    tone="warm"
                  />
                </section>
                <Card className="p-6">
                  <CardHeader
                    title={tw("reporting")}
                    description={period}
                    action={
                      <Badge tone="flame">
                        {reporting} / {report.scope.branchCount}
                      </Badge>
                    }
                  />
                  <div className="mt-5 h-2 rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-orange-500"
                      style={{
                        width: `${report.scope.branchCount ? (reporting / report.scope.branchCount) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <p className="mt-4 text-sm text-[#6b6b6b]">
                    {tw("noReportHint")}
                  </p>
                  <h3 className="mt-5 text-sm font-medium">
                    {tw("missingChurches")}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {report.scope.branches
                      .filter((b) => !b.hasReport)
                      .map((b) => (
                        <Badge key={b._id}>{b.name}</Badge>
                      ))}
                  </div>
                </Card>
              </>
            ),
          },
          {
            id: "submissions",
            label: tw("submissions"),
            count: report.items.length,
            content: (
              <Card className="p-6">
                <CardHeader title={tw("submissions")} description={period} />
                <form className="my-5 flex flex-wrap gap-3">
                  <input type="hidden" name="tab" value="submissions" />
                  {Object.entries(params)
                    .filter(
                      ([key, value]) =>
                        value && !["tab", "search", "page"].includes(key),
                    )
                    .map(([key, value]) => (
                      <input key={key} type="hidden" name={key} value={value} />
                    ))}
                  <input
                    name="search"
                    aria-label={tw("searchReports")}
                    placeholder={tw("searchReports")}
                    defaultValue={params.search}
                    className="ui-input max-w-md"
                  />
                  <Button type="submit" variant="secondary">
                    {tw("search")}
                  </Button>
                </form>
                <TableWrap>
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th>{tw("reportWeek")}</th>
                        <th>{tw("church")}</th>
                        <th>{tw("status")}</th>
                        <th>{tw("attendance")}</th>
                        <th>{tw("growthColumn")}</th>
                        <th>{tw("open")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matched.items.map((item) => (
                        <tr
                          id={`record-${item._id}`}
                          key={item._id}
                          className="scroll-mt-24"
                        >
                          <td>{dateInputValue(item.reportWeek)}</td>
                          <td>{item.branch.name}</td>
                          <td>
                            <Badge tone={statusTone(item.status)}>
                              {statusLabel(item.status)}
                            </Badge>
                          </td>
                          <td className="tabular-nums">
                            {formatNumber(item.currentAttendance)}
                          </td>
                          <td className={growthTone(item.growth)}>
                            {formatNumber(item.growth)} (
                            {formatPercent(item.growthPercent)})
                          </td>
                          <td>
                            <Link
                              href={detailHref(
                                "/weekly-reports",
                                item._id,
                                params,
                              )}
                              className="whitespace-nowrap text-orange-700"
                            >
                              {tw("open")} ↗
                            </Link>
                          </td>
                        </tr>
                      ))}
                      {!matched.items.length && (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-8 text-center text-[#8a8780]"
                          >
                            {tw("noResults")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </TableWrap>
                <DirectoryPagination
                  path="/weekly-reports"
                  params={params}
                  page={matched.page}
                  pageSize={matched.pageSize}
                  total={matched.total}
                  totalPages={matched.totalPages}
                />
              </Card>
            ),
          },
          {
            id: "comparison",
            label: tw("comparison"),
            content: (
              <ReportComparison
                branches={report.scope.branches}
                items={report.items}
              />
            ),
          },
          {
            id: "trends",
            label: tw("trends"),
            content: (
              <Card className="p-6">
                <CardHeader title={t("trend.title")} description={period} />
                <div className="mt-6">
                  {!report.trends.length ? (
                    <EmptyState icon="trendUp" title={t("trend.emptyTitle")}>
                      {t("trend.emptyBody")}
                    </EmptyState>
                  ) : (
                    <ul className="space-y-4">
                      {report.trends.map((trend) => (
                        <li
                          key={trend.key}
                          className="grid items-center gap-3 sm:grid-cols-[8rem_1fr_5rem]"
                        >
                          <span className="text-sm">{trend.label}</span>
                          <span className="h-2 rounded-full bg-white">
                            <span
                              className="block h-full rounded-full bg-orange-500"
                              style={{
                                width: `${(trend.currentAttendance / maxTrendAttendance) * 100}%`,
                              }}
                            />
                          </span>
                          <span className="text-right text-sm tabular-nums">
                            {formatNumber(trend.currentAttendance)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            ),
          },
        ]}
      />
    </Shell>
  );
}
