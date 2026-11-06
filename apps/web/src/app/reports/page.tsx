import { getFormatter, getTranslations } from "next-intl/server";
import { FilterPanel } from "@/components/filter-panel";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { Button, buttonClass, Card, CardHeader, EmptyState, formatStatus, Stat, TableWrap } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { canFilterAcrossBranches } from "@/lib/permissions";
import { serverGet } from "@/lib/server-api";
import type { BranchSummary, ReportsSummary, SettingsOverview } from "@/lib/types";

type StatusKey = Parameters<Awaited<ReturnType<typeof getTranslations<"statuses">>>>[0];

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
  const branchId = canFilterAcrossBranches(user.role, user.hasOversight) ? params.branchId?.trim() : user.branchId;
  const query = new URLSearchParams({ days: String(days) });

  if (branchId) {
    query.set("branchId", branchId);
  }

  const [summary, branches, t, tStatus, format] = await Promise.all([
    serverGet<ReportsSummary>(`/reports/summary?${query.toString()}`),
    serverGet<BranchSummary[]>("/branches").catch(() => []),
    getTranslations("services.reports"),
    getTranslations("statuses"),
    getFormatter(),
  ]);
  const statusLabel = (value: string) =>
    tStatus.has(value.toLowerCase() as StatusKey) ? tStatus(value.toLowerCase() as StatusKey) : formatStatus(value);
  const formatDate = (value: string) => format.dateTime(new Date(value), { dateStyle: "medium" });

  const metrics = [
    {
      label: t("metrics.guestTotal"),
      value: summary.totals.guestTotal,
      delta: t("metrics.guestTotalHint"),
      tone: "warm" as const,
    },
    {
      label: t("metrics.memberTotal"),
      value: summary.totals.memberTotal,
      delta: t("metrics.memberTotalHint"),
      tone: "cool" as const,
    },
    {
      label: t("metrics.attendanceTotal"),
      value: summary.totals.attendanceTotal,
      delta: t("metrics.attendanceTotalHint"),
      tone: "cool" as const,
    },
    {
      label: t("metrics.firstTimers"),
      value: summary.totals.firstTimersTotal,
      delta: t("metrics.firstTimersHint"),
      tone: "warm" as const,
    },
    {
      label: t("metrics.newConverts"),
      value: summary.totals.newConvertsTotal,
      delta: t("metrics.newConvertsHint"),
      tone: "cool" as const,
    },
    {
      label: t("metrics.conversionRate"),
      value: `${summary.totals.conversionRate}%`,
      delta: t("metrics.returnRate", { rate: summary.totals.returnRate }),
      tone: "warm" as const,
    },
  ];

  const recentTrends = summary.trends.slice(-10);
  const maxFollowUp = Math.max(1, ...summary.followUpBreakdown.map((item) => item.total));
  const maxServicePeople = Math.max(1, ...summary.serviceMix.map((service) => service.totalPeople));

  return (
    <Shell>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description", { days })}
        action={
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL ?? "https://api.chuflow.com/api"}/reports/export.csv?${query.toString()}`}
            className={buttonClass("primary")}
          >
            {t("exportCsv")}
          </a>
        }
      />

      <FilterPanel><form
        className="app-rise flex flex-col gap-2 rounded-2xl border border-black/[0.06] bg-white p-3 sm:flex-row sm:items-center"
        style={{ animationDelay: "60ms" }}
      >
        <select name="days" aria-label={t("dateRangeAria")} defaultValue={String(days)} className="ui-input sm:w-auto sm:min-w-[160px]">
          {[7, 14, 30, 60, 90].map((value) => (
            <option key={value} value={value}>
              {t("lastDays", { count: value })}
            </option>
          ))}
        </select>
        {canFilterAcrossBranches(user.role, user.hasOversight) ? (
          <select name="branchId" aria-label={t("branch")} defaultValue={branchId || ""} className="ui-input sm:max-w-xs sm:flex-1">
            <option value="">{t("allBranches")}</option>
            {branches.map((branch) => (
              <option key={branch._id} value={branch._id}>
                {branch.name}
              </option>
            ))}
          </select>
        ) : null}
        <Button type="submit" variant="secondary" icon="search">
          {t("apply")}
        </Button>
      </form></FilterPanel>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <Card className="app-rise p-6 sm:p-7">
        <CardHeader label={t("range.label")} title={t("range.title")} />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Stat
            label={t("range.dates")}
            value={
              <span className="text-[17px] leading-tight">
                {t("range.datesValue", {
                  from: formatDate(summary.range.startDate),
                  to: formatDate(summary.range.endDate),
                })}
              </span>
            }
            hint={t("lastDays", { count: days })}
          />
          <Stat
            label={t("range.summarySubmissions")}
            value={summary.totals.summarySubmissionTotal}
            hint={t("range.summarySubmissionsHint")}
          />
          <Stat
            label={t("range.adultsChildren")}
            value={
              <>
                {summary.totals.adultsTotal}
                <span className="text-[#8a8780]"> / </span>
                {summary.totals.childrenTotal}
              </>
            }
            hint={t("range.adultsChildrenHint")}
          />
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card className="app-rise min-w-0 p-6 sm:p-7">
          <CardHeader label={t("daily.label")} title={t("daily.title")} />
          <div className="mt-6">
            {recentTrends.length === 0 ? (
              <EmptyState icon="reports" title={t("daily.emptyTitle")}>
                {t("daily.emptyBody")}
              </EmptyState>
            ) : (
              <TableWrap>
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>{t("daily.date")}</th>
                      <th className="text-right">{t("daily.guests")}</th>
                      <th className="text-right">{t("daily.attendance")}</th>
                      <th className="text-right">{t("daily.firstTimers")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTrends.map((trend) => (
                      <tr key={trend.date}>
                        <td className="whitespace-nowrap font-medium tabular-nums">{trend.date}</td>
                        <td className="text-right tabular-nums">{trend.guests}</td>
                        <td className="text-right tabular-nums">{trend.attendance}</td>
                        <td className="text-right tabular-nums">{trend.firstTimers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </div>
        </Card>

        <Card className="app-rise min-w-0 p-6 sm:p-7" style={{ animationDelay: "60ms" }}>
          <CardHeader label={t("followUp.label")} title={t("followUp.title")} />
          <div className="mt-6">
            {summary.followUpBreakdown.length === 0 ? (
              <EmptyState icon="care" title={t("followUp.emptyTitle")}>
                {t("followUp.emptyBody")}
              </EmptyState>
            ) : (
              <ul className="space-y-4">
                {summary.followUpBreakdown.map((item, index) => (
                  <li key={item._id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[14px] font-medium text-[#111111]">{statusLabel(item._id)}</span>
                      <span className="text-[15px] font-semibold tabular-nums text-[#111111]">{item.total}</span>
                    </div>
                    <span className="mt-2 block h-2 overflow-hidden rounded-full bg-[#f1f0ec]">
                      <span
                        className="app-bar block h-full rounded-full bg-[#ea580c]"
                        style={{ width: `${Math.max(3, (item.total / maxFollowUp) * 100)}%`, animationDelay: `${index * 60}ms` }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </section>

      <Card className="app-rise min-w-0 p-6 sm:p-7">
        <CardHeader label={t("serviceMix.label")} title={t("serviceMix.title")} />
        <div className="mt-6">
          {summary.serviceMix.length === 0 ? (
            <EmptyState icon="attendance" title={t("serviceMix.emptyTitle")}>
              {t("serviceMix.emptyBody")}
            </EmptyState>
          ) : (
            <TableWrap>
              <table className="ui-table min-w-[640px]">
                <thead>
                  <tr>
                    <th>{t("serviceMix.service")}</th>
                    <th className="text-right">{t("serviceMix.people")}</th>
                    <th className="text-right">{t("serviceMix.firstTimers")}</th>
                    <th className="text-right">{t("serviceMix.newConverts")}</th>
                    <th className="text-right">{t("serviceMix.summaries")}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.serviceMix.map((service) => (
                    <tr key={service._id}>
                      <td>
                        <span className="block font-medium">{statusLabel(service._id)}</span>
                        <span className="mt-1.5 block h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-[#f1f0ec]">
                          <span
                            className="app-bar block h-full rounded-full bg-[#ea580c]"
                            style={{ width: `${Math.max(3, (service.totalPeople / maxServicePeople) * 100)}%` }}
                          />
                        </span>
                      </td>
                      <td className="text-right font-medium tabular-nums">{service.totalPeople}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{service.firstTimers}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{service.newConverts}</td>
                      <td className="text-right tabular-nums text-[#55534e]">{service.summarySubmissions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </div>
      </Card>
    </Shell>
  );
}
