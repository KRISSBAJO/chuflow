import { AttendanceManagementTable } from "@/components/attendance-management-table";
import { AttendanceSubmissionQueue } from "@/components/attendance-submission-queue";
import { AttendanceSummaryModalButton } from "@/components/attendance-summary-modal-button";
import { AttendanceSummaryTable } from "@/components/attendance-summary-table";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { ShareLinkCard } from "@/components/share-link-card";
import { ServiceScheduleManagementModalButton } from "@/components/service-schedule-management-modal-button";
import { ServiceTypeManagementModalButton } from "@/components/service-type-management-modal-button";
import { Shell } from "@/components/shell";
import { Badge, Card, CardHeader, Stat } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { canManageServiceSchedules } from "@/lib/permissions";
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
  await searchParams;
  const canDirectEditAttendance = user.role !== "follow_up";
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

  const [records, branches, guestList, members, serviceTypes, serviceSchedules, templates, attendanceSubmissions] = await Promise.all([
    serverGet<AttendanceItem[]>("/attendance"),
    serverGet<BranchSummary[]>("/branches/options").catch(() => []),
    serverGet<GuestListResponse>("/guests?limit=500").catch(() => ({
      items: [],
      pagination: { page: 1, pageSize: 500, total: 0, totalPages: 1 },
      summary: { todayCount: 0, completionRate: 0, assignedFollowUpCount: 0 },
    })),
    serverGet<MemberListItem[]>("/members").catch(() => []),
    serverGet<ServiceTypeSummary[]>("/service-types").catch(() => []),
    serverGet<ServiceScheduleSummary[]>("/service-schedules").catch(() => []),
    serverGet<IntakeTemplate[]>("/intake-templates").catch(() => []),
    serverGet<AttendanceSubmissionListResponse>("/intake-templates/attendance-submissions").catch(
      () => ({
        items: [],
        summary: { pending: 0, approved: 0, rejected: 0 },
      }),
    ),
  ]);
  const guests = guestList.items;
  const activeAttendanceTemplates = templates.filter(
    (template) => template.kind === "attendance" && template.isActive,
  );
  const branchAttendanceTemplate = user.branchId
    ? activeAttendanceTemplates.find((template) => template.branchId === user.branchId) ||
      activeAttendanceTemplates[0]
    : undefined;
  const attendanceShareUrl =
    branchAttendanceTemplate && user.branchId
      ? `${branchAttendanceTemplate.shareUrl || `/intake/${branchAttendanceTemplate.slug}`}${
          (branchAttendanceTemplate.shareUrl || `/intake/${branchAttendanceTemplate.slug}`).includes("?")
            ? "&"
            : "?"
        }branchId=${encodeURIComponent(user.branchId)}`
      : null;

  const guestTotal = records.filter((record) => record.personType === "guest").length;
  const memberTotal = records.filter((record) => record.personType === "member").length;
  const individualRecords = records.filter((record) => record.entryMode !== "summary");
  const summaryRecords = records.filter((record) => record.entryMode === "summary");
  const totalAdults = summaryRecords.reduce((total, record) => total + (record.adultsCount ?? 0), 0);
  const totalChildren = summaryRecords.reduce((total, record) => total + (record.childrenCount ?? 0), 0);
  const totalFirstTimers = summaryRecords.reduce((total, record) => total + (record.firstTimersCount ?? 0), 0);
  const totalNewConverts = summaryRecords.reduce((total, record) => total + (record.newConvertsCount ?? 0), 0);
  const busiestSummary = [...summaryRecords]
    .sort((left, right) => {
      const leftTotal = (left.adultsCount ?? 0) + (left.childrenCount ?? 0);
      const rightTotal = (right.adultsCount ?? 0) + (right.childrenCount ?? 0);
      return rightTotal - leftTotal;
    })[0];

  return (
    <Shell>
      <PageHeader
        eyebrow="Attendance"
        title="Attendance and services"
        description="Track men, women, children, adults, first timers and new converts against managed service types and schedules."
        action={
          <div className="flex flex-wrap gap-2">
            {canDirectEditAttendance ? (
              <>
                <AttendanceSummaryModalButton
                  branches={branches}
                  serviceTypes={serviceTypes}
                  serviceSchedules={serviceSchedules}
                  defaultBranchId={user.branchId}
                />
                {canManageSchedules ? (
                  <ServiceScheduleManagementModalButton
                    branches={branches}
                    serviceTypes={serviceTypes}
                    serviceSchedules={serviceSchedules}
                    defaultBranchId={user.branchId}
                    currentUserRole={user.role}
                  />
                ) : null}
                <ServiceTypeManagementModalButton
                  branches={branches}
                  serviceTypes={serviceTypes}
                  defaultBranchId={user.branchId}
                  currentUserRole={user.role}
                />
              </>
            ) : null}
          </div>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Adults" value={totalAdults} delta="Recorded in service summaries" tone="warm" />
        <MetricCard label="Children" value={totalChildren} delta="Recorded across services" tone="cool" />
        <MetricCard label="First timers" value={totalFirstTimers} delta="Captured in service summaries" tone="warm" />
        <MetricCard label="New converts" value={totalNewConverts} delta="Across recorded services" tone="cool" />
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <Card className="app-rise min-w-0 p-6 sm:p-7">
          <CardHeader label="Overview" title="Submissions at a glance" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Stat
              label="Summary submissions"
              value={summaryRecords.length}
              hint="Service totals from admin or public attendance forms"
            />
            <Stat
              label="Busiest service"
              value={
                <span className="block truncate text-[18px] leading-tight">
                  {busiestSummary?.serviceName ||
                    busiestSummary?.serviceTypeLabel ||
                    busiestSummary?.serviceType ||
                    "No data"}
                </span>
              }
              hint={
                busiestSummary
                  ? `${(busiestSummary.adultsCount ?? 0) + (busiestSummary.childrenCount ?? 0)} people recorded`
                  : "Attendance data will appear here"
              }
            />
            <Stat
              label="Individual check-ins"
              value={individualRecords.length}
              hint="Older guest and member records available for cleanup"
            />
            <Stat
              label="Pending approvals"
              value={attendanceSubmissions.summary.pending}
              hint="Public attendance entries waiting for branch approval"
            />
          </div>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          {attendanceShareUrl ? (
            <ShareLinkCard
              title="Share attendance entry"
              url={attendanceShareUrl}
              description="Send this branch form to ushers or service staff so they can submit totals for approval."
            />
          ) : null}
          <Card className="app-rise p-6" style={{ animationDelay: "60ms" }}>
            <CardHeader
              label="Older records"
              title="Individual attendance"
              description="Older guest and member check-ins are kept so they can still be corrected."
            />
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge tone="flame">{guestTotal} guest check-ins</Badge>
              <Badge tone="info">{memberTotal} member check-ins</Badge>
            </div>
          </Card>
        </div>
      </section>

      <Card className="app-rise min-w-0 p-6 sm:p-7">
        <CardHeader
          label="Approvals"
          title="Attendance approval queue"
          description="Review public attendance entries before they become approved service summaries."
          action={
            <>
              <Badge tone="warning">{attendanceSubmissions.summary.pending} pending</Badge>
              <Badge tone="success">{attendanceSubmissions.summary.approved} approved</Badge>
              <Badge tone="danger">{attendanceSubmissions.summary.rejected} rejected</Badge>
            </>
          }
        />
        <div className="mt-6">
          <AttendanceSubmissionQueue
            items={attendanceSubmissions.items}
            canApprove={canApproveAttendance}
          />
        </div>
      </Card>

      <Card className="app-rise min-w-0 p-6 sm:p-7">
        <CardHeader
          label="Service summaries"
          title="Service summary submissions"
          description="Filter, page through and edit summary attendance as volume grows."
          action={<Badge>{summaryRecords.length} summaries</Badge>}
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

      <Card className="app-rise min-w-0 p-6 sm:p-7">
        <CardHeader
          label="Cleanup"
          title="Individual attendance cleanup"
          description="Only for older guest and member attendance records that still need correction."
          action={<Badge>{individualRecords.length} records</Badge>}
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
    </Shell>
  );
}
