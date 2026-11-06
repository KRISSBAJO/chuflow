import { FilterPanel } from "@/components/filter-panel";
import { hasPermission } from "@/lib/capabilities";
import Link from "next/link";
import { ChurchRecordingLinks } from "@/components/church-recording-links";
import { WorkspaceTabs } from "@/components/workspace-tabs";
import { AttendanceReviewList } from "@/components/attendance-review-list";
import { getTranslations } from "next-intl/server";
import { AttendanceManagementTable } from "@/components/attendance-management-table";
import { AttendanceSummaryTable } from "@/components/attendance-summary-table";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { ShareLinkCard } from "@/components/share-link-card";
import { ServiceScheduleManagementModalButton } from "@/components/service-schedule-management-modal-button";
import { ServiceTypeManagementModalButton } from "@/components/service-type-management-modal-button";
import { Shell } from "@/components/shell";
import { Badge, Card, CardHeader, Stat, buttonClass } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { canManageServiceSchedules, canCreateAttendanceEntries } from "@/lib/permissions";
import type {
  AttendanceSubmissionListResponse,
  AttendanceItem,
  BranchSummary,
  GuestListResponse,
  IntakeTemplate,
  MemberListItem,
  ServiceScheduleSummary,
  ServiceTypeSummary,
} from "@/lib/types";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireServerRole("/attendance");
  const params = await searchParams;
  const tw = await getTranslations("workspace");
  const periodQuery = new URLSearchParams();
  if (params.dateFrom) periodQuery.set("dateFrom", params.dateFrom);
  if (params.dateTo)
    periodQuery.set("dateTo", params.dateTo + "T23:59:59.999Z");
  const t = await getTranslations("services.attendance.page");
  const canDirectEditAttendance = hasPermission(user,"attendance.edit");
  const canCreateAttendance = canCreateAttendanceEntries(user.role, user.additionalPermissions);
  const canApproveAttendance = [
    "super_admin",
    "national_admin",
    "national_pastor",
    "district_admin",
    "district_pastor",
    "branch_admin",
    "resident_pastor",
    "associate_pastor",
    "follow_up",
  ].includes(user.role);
  const canManageSchedules = canManageServiceSchedules(user.role);

  const isCleanup = canManageSchedules && params.tab === "cleanup";
  if (!isCleanup) periodQuery.set("entryMode", "summary");
  const [
    records,
    branches,
    guestList,
    members,
    serviceTypes,
    serviceSchedules,
    templates,
    attendanceSubmissions,
  ] = await Promise.all([
    serverGet<AttendanceItem[]>(`/attendance?${periodQuery}`),
    serverGet<BranchSummary[]>("/branches/options").catch(() => []),
    (isCleanup
      ? serverGet<GuestListResponse>("/guests?limit=500")
      : Promise.resolve({
          items: [],
          pagination: { page: 1, pageSize: 1, total: 0, totalPages: 1 },
          summary: {
            todayCount: 0,
            completionRate: 0,
            assignedFollowUpCount: 0,
          },
        })
    ).catch(() => ({
      items: [],
      pagination: { page: 1, pageSize: 500, total: 0, totalPages: 1 },
      summary: { todayCount: 0, completionRate: 0, assignedFollowUpCount: 0 },
    })),
    (isCleanup
      ? serverGet<MemberListItem[]>("/members")
      : Promise.resolve([] as MemberListItem[])
    ).catch(() => []),
    serverGet<ServiceTypeSummary[]>("/service-types").catch(() => []),
    serverGet<ServiceScheduleSummary[]>("/service-schedules").catch(() => []),
    serverGet<IntakeTemplate[]>("/intake-templates").catch(() => []),
    serverGet<AttendanceSubmissionListResponse>(
      "/intake-templates/attendance-submissions",
    ).catch(() => ({
      items: [],
      summary: { pending: 0, approved: 0, rejected: 0 },
    })),
  ]);
  const guests = guestList.items;
  const attendanceItems = attendanceSubmissions.items.filter(
    (item) => item.templateKind === "attendance",
  );
  const attendanceCounts = {
    pending: attendanceItems.filter((i) => i.status === "pending").length,
    approved: attendanceItems.filter((i) => i.status === "approved").length,
    rejected: attendanceItems.filter((i) => i.status === "rejected").length,
  };
  const activeAttendanceTemplates = templates.filter(
    (template) => template.kind === "attendance" && template.isActive,
  );
  const branchAttendanceTemplate = user.branchId
    ? activeAttendanceTemplates.find(
        (template) => template.branchId === user.branchId,
      ) || activeAttendanceTemplates[0]
    : undefined;
  const attendanceShareUrl =
    branchAttendanceTemplate && user.branchId
      ? `${branchAttendanceTemplate.shareUrl || `/intake/${branchAttendanceTemplate.slug}`}${
          (
            branchAttendanceTemplate.shareUrl ||
            `/intake/${branchAttendanceTemplate.slug}`
          ).includes("?")
            ? "&"
            : "?"
        }branchId=${encodeURIComponent(user.branchId)}`
      : null;

  const individualRecords = records.filter(
    (record) => record.entryMode !== "summary",
  );
  const summaryRecords = records.filter(
    (record) => record.entryMode === "summary",
  );
  const totalAdults = summaryRecords.reduce(
    (total, record) => total + (record.adultsCount ?? 0),
    0,
  );
  const totalChildren = summaryRecords.reduce(
    (total, record) => total + (record.childrenCount ?? 0),
    0,
  );
  const totalFirstTimers = summaryRecords.reduce(
    (total, record) => total + (record.firstTimersCount ?? 0),
    0,
  );
  const totalNewConverts = summaryRecords.reduce(
    (total, record) => total + (record.newConvertsCount ?? 0),
    0,
  );
  const busiestSummary = [...summaryRecords].sort((left, right) => {
    const leftTotal = (left.adultsCount ?? 0) + (left.childrenCount ?? 0);
    const rightTotal = (right.adultsCount ?? 0) + (right.childrenCount ?? 0);
    return rightTotal - leftTotal;
  })[0];

  return (
    <Shell>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        action={
          <div className="flex flex-wrap gap-2">
            {canCreateAttendance ? (
              <Link href="/attendance/new" className={buttonClass("primary")}>
                {tw("recordAttendance")}
              </Link>
            ) : null}
          </div>
        }
      />

      <ChurchRecordingLinks branches={branches} defaultBranchId={user.branchId} kind="attendance" />
      <FilterPanel><form className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="tab" value={params.tab || "summaries"} />
        <label className="text-xs text-[#6b6b6b]">
          {tw("period")}
          <input
            className="ui-input mt-1"
            aria-label="From"
            type="date"
            name="dateFrom"
            defaultValue={params.dateFrom}
          />
        </label>
        <label className="text-xs text-[#6b6b6b]">
          —
          <input
            className="ui-input mt-1"
            aria-label="To"
            type="date"
            name="dateTo"
            defaultValue={params.dateTo}
            min={params.dateFrom}
          />
        </label>
        <button className={buttonClass("secondary")} type="submit">
          {tw("apply")}
        </button>
      </form></FilterPanel>
      <WorkspaceTabs
        defaultTab="summaries"
        tabs={[
          {
            id: "summaries",
            label: tw("summaries"),
            content: (
              <>
                <Card className="app-rise min-w-0 p-6 sm:p-7">
                  <CardHeader
                    label={t("summaries.label")}
                    title={t("summaries.title")}
                    description={t("summaries.description")}
                    action={
                      <Badge>
                        {t("summaries.count", { count: summaryRecords.length })}
                      </Badge>
                    }
                  />
                  <div className="mt-6">
                    <AttendanceSummaryTable
                      records={summaryRecords}
                      branches={branches}
                      serviceTypes={serviceTypes}
                      serviceSchedules={serviceSchedules}
                      defaultBranchId={user.branchId}
                      canEdit={canDirectEditAttendance}
                    />
                  </div>
                </Card>
              </>
            ),
          },
          {
            id: "approvals",
            label: tw("approvals"),
            count: attendanceCounts.pending,
            content: (
              <>
                <Card className="app-rise min-w-0 p-6 sm:p-7">
                  <CardHeader
                    label={t("approvals.label")}
                    title={t("approvals.title")}
                    description={t("approvals.description")}
                    action={
                      <>
                        <Badge tone="warning">
                          {t("approvals.pending", {
                            count: attendanceCounts.pending,
                          })}
                        </Badge>
                        <Badge tone="success">
                          {t("approvals.approved", {
                            count: attendanceCounts.approved,
                          })}
                        </Badge>
                        <Badge tone="danger">
                          {t("approvals.rejected", {
                            count: attendanceCounts.rejected,
                          })}
                        </Badge>
                      </>
                    }
                  />
                  <div className="mt-6">
                    <AttendanceReviewList
                      items={attendanceItems}
                      canApprove={canApproveAttendance}
                    />
                  </div>
                </Card>
              </>
            ),
          },
          {
            id: "insights",
            label: tw("insights"),
            content: (
              <>
                {" "}
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    label={t("metrics.adults")}
                    value={totalAdults}
                    delta={t("metrics.adultsHint")}
                    tone="warm"
                  />
                  <MetricCard
                    label={t("metrics.children")}
                    value={totalChildren}
                    delta={t("metrics.childrenHint")}
                    tone="cool"
                  />
                  <MetricCard
                    label={t("metrics.firstTimers")}
                    value={totalFirstTimers}
                    delta={t("metrics.firstTimersHint")}
                    tone="warm"
                  />
                  <MetricCard
                    label={t("metrics.newConverts")}
                    value={totalNewConverts}
                    delta={t("metrics.newConvertsHint")}
                    tone="cool"
                  />
                </section>
                <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
                  <Card className="app-rise min-w-0 p-6 sm:p-7">
                    <CardHeader
                      label={t("overview.label")}
                      title={t("overview.title")}
                    />
                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      <Stat
                        label={t("overview.summarySubmissions")}
                        value={summaryRecords.length}
                        hint={t("overview.summarySubmissionsHint")}
                      />
                      <Stat
                        label={t("overview.busiest")}
                        value={
                          <span className="block truncate text-[18px] leading-tight">
                            {busiestSummary?.serviceName ||
                              busiestSummary?.serviceTypeLabel ||
                              busiestSummary?.serviceType ||
                              t("overview.noData")}
                          </span>
                        }
                        hint={
                          busiestSummary
                            ? t("overview.peopleRecorded", {
                                count:
                                  (busiestSummary.adultsCount ?? 0) +
                                  (busiestSummary.childrenCount ?? 0),
                              })
                            : t("overview.dataWillAppear")
                        }
                      />
                      <Stat
                        label={t("overview.individual")}
                        value={individualRecords.length}
                        hint={t("overview.individualHint")}
                      />
                      <Stat
                        label={t("overview.pendingApprovals")}
                        value={attendanceCounts.pending}
                        hint={t("overview.pendingApprovalsHint")}
                      />
                    </div>
                  </Card>

                  <div className="flex min-w-0 flex-col gap-4">
                    {attendanceShareUrl ? (
                      <ShareLinkCard
                        title={t("share.title")}
                        url={attendanceShareUrl}
                        description={t("share.description")}
                      />
                    ) : null}
                  </div>
                </section>
              </>
            ),
          },
          ...(canDirectEditAttendance
            ? [
                {
                  id: "settings",
                  label: tw("settings"),
                  content: (
                    <>
                      <Card className="p-6">
                        <CardHeader title={tw("serviceSettings")} />
                        <div className="mt-5 flex flex-wrap gap-3">
                          {canManageSchedules && (
                            <ServiceScheduleManagementModalButton
                              branches={branches}
                              serviceTypes={serviceTypes}
                              serviceSchedules={serviceSchedules}
                              defaultBranchId={user.branchId}
                              currentUserRole={user.role}
                            />
                          )}
                          <ServiceTypeManagementModalButton
                            branches={branches}
                            serviceTypes={serviceTypes}
                            defaultBranchId={user.branchId}
                            currentUserRole={user.role}
                          />
                        </div>
                      </Card>
                    </>
                  ),
                },
              ]
            : []),
          ...(canManageSchedules
            ? [
                {
                  id: "cleanup",
                  label: tw("cleanup"),
                  hidden: true,
                  content: (
                    <>
                      <Card className="app-rise min-w-0 p-6 sm:p-7">
                        <CardHeader
                          label={t("cleanup.label")}
                          title={t("cleanup.title")}
                          description={t("cleanup.description")}
                          action={
                            <Badge>
                              {t("cleanup.count", {
                                count: individualRecords.length,
                              })}
                            </Badge>
                          }
                        />
                        <div className="mt-6">
                          <AttendanceManagementTable
                            records={individualRecords}
                            guests={guests}
                            members={members}
                            serviceTypes={serviceTypes}
                            canEdit={canDirectEditAttendance}
                          />
                        </div>
                      </Card>
                    </>
                  ),
                },
              ]
            : []),
        ]}
      />
      {canManageSchedules && (
        <Link
          href={{
            pathname: "/attendance",
            query: { ...params, tab: "cleanup" },
          }}
          className="text-sm text-[#8a8780] hover:text-orange-700"
        >
          {tw("cleanup")} ↗
        </Link>
      )}
    </Shell>
  );
}
