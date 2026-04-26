import { AttendanceManagementTable } from "@/components/attendance-management-table";
import { AttendanceSubmissionQueue } from "@/components/attendance-submission-queue";
import { AttendanceSummaryModalButton } from "@/components/attendance-summary-modal-button";
import { AttendanceSummaryTable } from "@/components/attendance-summary-table";
import { PageHeader } from "@/components/page-header";
import { ShareLinkCard } from "@/components/share-link-card";
import { ServiceScheduleManagementModalButton } from "@/components/service-schedule-management-modal-button";
import { ServiceTypeManagementModalButton } from "@/components/service-type-management-modal-button";
import { Shell } from "@/components/shell";
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
    serverGet<BranchSummary[]>("/branches").catch(() => []),
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
        title="Attendance totals, service types, and clean service records"
        description="Track total men, women, children, adults, first timers, and new converts with managed service types instead of loose text values."
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
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="surface rounded-[28px] p-5">
          <p className="eyebrow">Adults</p>
          <p className="mt-5 text-3xl font-bold text-slate-950">{totalAdults}</p>
          <p className="mt-2 max-w-[18ch] text-sm leading-6 text-slate-500">
            Adults recorded in service summaries.
          </p>
        </div>
        <div className="surface rounded-[28px] p-5">
          <p className="eyebrow">Children</p>
          <p className="mt-5 text-3xl font-bold text-slate-950">{totalChildren}</p>
          <p className="mt-2 max-w-[18ch] text-sm leading-6 text-slate-500">
            Children recorded across services.
          </p>
        </div>
        <div className="surface rounded-[28px] p-5">
          <p className="eyebrow">First timers</p>
          <p className="mt-5 text-3xl font-bold text-slate-950">{totalFirstTimers}</p>
          <p className="mt-2 max-w-[18ch] text-sm leading-6 text-slate-500">
            First-timer count captured in summaries.
          </p>
        </div>
        <div className="surface rounded-[28px] p-5">
          <p className="eyebrow">New converts</p>
          <p className="mt-5 text-3xl font-bold text-slate-950">{totalNewConverts}</p>
          <p className="mt-2 max-w-[18ch] text-sm leading-6 text-slate-500">
            New-convert count across recorded services.
          </p>
        </div>
      </section>
      <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(280px,1fr)]">
        <div className="min-w-0 xl:col-span-3">
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <div className="surface flex min-h-[176px] flex-col justify-between rounded-[28px] p-5">
              <div>
              <p className="eyebrow">Summary submissions</p>
              <p className="mt-5 text-3xl font-bold text-slate-950">{summaryRecords.length}</p>
              </div>
              <p className="max-w-[20ch] text-sm leading-6 text-slate-500">
                Service totals entered from admin or public attendance flow.
              </p>
            </div>
            <div className="surface flex min-h-[176px] flex-col justify-between rounded-[28px] p-5">
              <div>
                <p className="eyebrow">Busiest summary</p>
                <p className="mt-5 text-2xl font-bold leading-tight text-slate-950">
                {busiestSummary?.serviceName ||
                  busiestSummary?.serviceTypeLabel ||
                  busiestSummary?.serviceType ||
                  "No data"}
                </p>
              </div>
              <p className="max-w-[20ch] text-sm leading-6 text-slate-500">
                {busiestSummary
                  ? `${(busiestSummary.adultsCount ?? 0) + (busiestSummary.childrenCount ?? 0)} people recorded`
                  : "Attendance data will appear here"}
              </p>
            </div>
            <div className="surface flex min-h-[176px] flex-col justify-between rounded-[28px] p-5">
              <div>
              <p className="eyebrow">Individual check-ins</p>
              <p className="mt-5 text-3xl font-bold text-slate-950">{individualRecords.length}</p>
              </div>
              <p className="max-w-[20ch] text-sm leading-6 text-slate-500">
                Older guest and member records still available for cleanup.
              </p>
            </div>
            <div className="surface flex min-h-[176px] flex-col justify-between rounded-[28px] p-5">
              <div>
                <p className="eyebrow">Pending approvals</p>
                <p className="mt-5 text-3xl font-bold text-slate-950">
                  {attendanceSubmissions.summary.pending}
                </p>
              </div>
              <p className="max-w-[20ch] text-sm leading-6 text-slate-500">
                Public attendance entries waiting for branch approval.
              </p>
            </div>
          </section>
        </div>
        <div className="min-w-0">
          <div className="space-y-4">
            {attendanceShareUrl ? (
              <ShareLinkCard
                title="Share attendance entry"
                url={attendanceShareUrl}
                description="Send this branch-specific form to ushers or service staff so they can submit totals for approval."
              />
            ) : null}
            <section className="surface rounded-[28px] p-5">
              <p className="eyebrow">Legacy Records</p>
              <h2 className="mt-3 text-lg font-semibold leading-8 text-slate-950">
                Old individual attendance still visible
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Older guest and member attendance records are still preserved for
                correction.
              </p>
              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <span className="rounded-full bg-orange-50 px-3 py-2 font-semibold text-orange-700">
                  {guestTotal} guest check-ins
                </span>
                <span className="rounded-full bg-sky-50 px-3 py-2 font-semibold text-sky-700">
                  {memberTotal} member check-ins
                </span>
              </div>
            </section>
          </div>
        </div>
      </section>
      <section className="surface min-w-0 overflow-hidden rounded-[24px] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Attendance approval queue</h2>
            <p className="mt-1 text-xs text-slate-500">
              Review public attendance entries before they become approved service summaries.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-amber-50 px-3 py-2 text-amber-700">
              {attendanceSubmissions.summary.pending} pending
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-700">
              {attendanceSubmissions.summary.approved} approved
            </span>
            <span className="rounded-full bg-rose-50 px-3 py-2 text-rose-700">
              {attendanceSubmissions.summary.rejected} rejected
            </span>
          </div>
        </div>
        <div className="mt-4">
          <AttendanceSubmissionQueue
            items={attendanceSubmissions.items}
            canApprove={canApproveAttendance}
          />
        </div>
      </section>
      <section className="surface min-w-0 overflow-hidden rounded-[24px] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Service summary submissions</h2>
            <p className="mt-1 text-xs text-slate-500">
              Use filters, pagination, and inline editing to keep summary attendance clean as volume grows.
            </p>
          </div>
          <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {summaryRecords.length} summaries
          </div>
        </div>
        <div className="mt-4">
          <AttendanceSummaryTable
            records={summaryRecords}
            branches={branches}
            serviceTypes={serviceTypes}
            serviceSchedules={serviceSchedules}
            defaultBranchId={user.branchId}
            canEdit={canDirectEditAttendance}
          />
        </div>
      </section>
      <section className="surface min-w-0 overflow-hidden rounded-[24px] p-5">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-950">Individual attendance cleanup</h2>
          <p className="mt-1 text-xs text-slate-500">
            Use this only for older guest/member attendance records that still need correction.
          </p>
        </div>
        <div className="mt-4">
          <AttendanceManagementTable
            records={individualRecords}
            guests={guests}
            members={members}
            serviceTypes={serviceTypes}
            canEdit={canDirectEditAttendance}
          />
        </div>
      </section>
    </Shell>
  );
}
