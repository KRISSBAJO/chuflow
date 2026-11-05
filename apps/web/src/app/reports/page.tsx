import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { Button, buttonClass, Card, CardHeader, EmptyState, formatStatus, Stat, TableWrap } from "@/components/ui/ui";
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
  const branchId = canFilterAcrossBranches(user.role, user.hasOversight) ? params.branchId?.trim() : user.branchId;
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

  const recentTrends = summary.trends.slice(-10);
  const maxFollowUp = Math.max(1, ...summary.followUpBreakdown.map((item) => item.total));
  const maxServicePeople = Math.max(1, ...summary.serviceMix.map((service) => service.totalPeople));

  return (
    <Shell>
      <PageHeader
        eyebrow="Reports"
        title="Leadership reports"
        description={`Live ministry reporting across capture, follow-up, conversion and attendance for the last ${days} days.`}
        action={
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL ?? "https://api.chuflow.com/api"}/reports/export.csv?${query.toString()}`}
            className={buttonClass("primary")}
          >
            Export CSV
          </a>
        }
      />

      <form
        className="app-rise flex flex-col gap-2 rounded-2xl border border-black/[0.06] bg-white p-3 sm:flex-row sm:items-center"
        style={{ animationDelay: "60ms" }}
      >
        <select name="days" aria-label="Date range" defaultValue={String(days)} className="ui-input sm:w-auto sm:min-w-[160px]">
          {[7, 14, 30, 60, 90].map((value) => (
            <option key={value} value={value}>
              Last {value} days
            </option>
          ))}
        </select>
        {canFilterAcrossBranches(user.role, user.hasOversight) ? (
          <select name="branchId" aria-label="Branch" defaultValue={branchId || ""} className="ui-input sm:max-w-xs sm:flex-1">
            <option value="">All branches</option>
            {branches.map((branch) => (
              <option key={branch._id} value={branch._id}>
                {branch.name}
              </option>
            ))}
          </select>
        ) : null}
        <Button type="submit" variant="secondary" icon="search">
          Apply
        </Button>
      </form>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <Card className="app-rise p-6 sm:p-7">
        <CardHeader label="Range" title="Reporting window" />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Stat
            label="Dates"
            value={
              <span className="text-[17px] leading-tight">
                {new Date(summary.range.startDate).toLocaleDateString()} to{" "}
                {new Date(summary.range.endDate).toLocaleDateString()}
              </span>
            }
            hint={`Last ${days} days`}
          />
          <Stat
            label="Summary submissions"
            value={summary.totals.summarySubmissionTotal}
            hint="Service totals recorded in the current range"
          />
          <Stat
            label="Adults / children"
            value={
              <>
                {summary.totals.adultsTotal}
                <span className="text-[#8a8780]"> / </span>
                {summary.totals.childrenTotal}
              </>
            }
            hint="Adults and children in service summaries"
          />
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card className="app-rise min-w-0 p-6 sm:p-7">
          <CardHeader label="Daily trend" title="Last 10 days" />
          <div className="mt-6">
            {recentTrends.length === 0 ? (
              <EmptyState icon="reports" title="No activity yet">
                No daily activity has been recorded in this range.
              </EmptyState>
            ) : (
              <TableWrap>
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th className="text-right">Guests</th>
                      <th className="text-right">Attendance</th>
                      <th className="text-right">First timers</th>
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
          <CardHeader label="Follow-up" title="Follow-up breakdown" />
          <div className="mt-6">
            {summary.followUpBreakdown.length === 0 ? (
              <EmptyState icon="care" title="No follow-up yet">
                Nobody is in follow-up in this range.
              </EmptyState>
            ) : (
              <ul className="space-y-4">
                {summary.followUpBreakdown.map((item, index) => (
                  <li key={item._id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[14px] font-medium text-[#111111]">{formatStatus(item._id)}</span>
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
        <CardHeader label="Service mix" title="Attendance by service" />
        <div className="mt-6">
          {summary.serviceMix.length === 0 ? (
            <EmptyState icon="attendance" title="No services yet">
              No service attendance has been recorded in this range.
            </EmptyState>
          ) : (
            <TableWrap>
              <table className="ui-table min-w-[640px]">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th className="text-right">People</th>
                    <th className="text-right">First timers</th>
                    <th className="text-right">New converts</th>
                    <th className="text-right">Summaries</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.serviceMix.map((service) => (
                    <tr key={service._id}>
                      <td>
                        <span className="block font-medium">{formatStatus(service._id)}</span>
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
