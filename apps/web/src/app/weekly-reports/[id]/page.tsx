import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { WorkspaceTabs } from "@/components/workspace-tabs";
import { AttendanceSubmissionQueue } from "@/components/attendance-submission-queue";
import { Badge, Card, CardHeader } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { safeReturnTo } from "@/lib/workspace-navigation";
import type { WeeklyReportItem, AttendanceSubmissionItem } from "@/lib/types";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  await requireServerRole("/weekly-reports");
  const { id } = await params;
  const query = await searchParams;
  const [data, t, tw, format] = await Promise.all([
    serverGet<{ item: WeeklyReportItem; submission: AttendanceSubmissionItem }>(
      `/intake-templates/weekly-reports/details/${id}`,
    ),
    getTranslations("services.weeklyReports"),
    getTranslations("workspace"),
    getFormatter(),
  ]);
  const { item, submission } = data;
  const fields = [
    ["current", item.currentAttendance],
    ["previous", item.previousAttendance],
    ["growth", item.growth],
    ["growthPercent", item.growthPercent],
    ["avgLastYear", item.averageLastYear],
    ["avgRecent", item.averageLastPeriod],
    ["ft", item.firstTimersCount],
    ["nc", item.newConvertsCount],
    ["bfc", item.believersFoundationClassCount],
    ["hgb", item.holySpiritBaptismCount],
    ["wb", item.waterBaptismCount],
    ["chop", item.covenantHourOfPrayerAttendance],
    ["wsf", item.winnersSatelliteFellowshipAverage],
    ["cells", item.cellCount],
    ["newCells", item.newCellCount],
    ["wofbi", item.wofbiAttendance],
  ] as const;
  return (
    <Shell>
      <Link
        href={safeReturnTo(query.returnTo, "/weekly-reports")}
        className="text-sm text-[#6b6b6b]"
      >
        ← {tw("backReports")}
      </Link>
      <PageHeader
        eyebrow={tw("weeklyReport")}
        title={item.branch.name}
        description={item.reportWeek?.slice(0, 10) || ""}
        action={<Badge>{item.status}</Badge>}
      />
      <WorkspaceTabs
        defaultTab="details"
        tabs={[
          {
            id: "details",
            label: tw("details"),
            content: (
              <Card className="p-6">
                <CardHeader title={item.templateName} />
                <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {fields.map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-white p-4">
                      <dt className="text-xs text-[#8a8780]">
                        {t(`columns.${label}`)}
                      </dt>
                      <dd className="mt-2 text-xl font-semibold tabular-nums">
                        {format.number(value)}
                        {label === "growthPercent" ? "%" : ""}
                      </dd>
                    </div>
                  ))}
                </dl>
                <h3 className="mt-6 text-sm font-medium">
                  {t("submissions.remarks")}
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[#6b6b6b]">
                  {item.remarks || "—"}
                </p>
              </Card>
            ),
          },
          {
            id: "review",
            label: tw("review"),
            content: (
              <Card className="p-6">
                <AttendanceSubmissionQueue items={[submission]} canApprove />
              </Card>
            ),
          },
        ]}
      />
    </Shell>
  );
}
