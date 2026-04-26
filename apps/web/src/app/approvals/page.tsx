import Link from "next/link";
import { AttendanceSubmissionQueue } from "@/components/attendance-submission-queue";
import { AuditLogFeed } from "@/components/audit-log-feed";
import { ExpenseEntriesTable } from "@/components/expense-entries-table";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { WorkspaceRequestReviewList } from "@/components/workspace-request-review-list";
import { requireServerRole } from "@/lib/auth";
import { canApproveExpenseEntries } from "@/lib/permissions";
import { serverGet } from "@/lib/server-api";
import type {
  AlertsSummary,
  AttendanceSubmissionListResponse,
  AuditLogListResponse,
  ExpenseCategorySummary,
  ExpenseListResponse,
  FinanceAccountSummary,
  ServiceScheduleSummary,
  WorkspaceRequestListResponse,
} from "@/lib/types";

function canApproveAttendance(role: string) {
  return [
    "super_admin",
    "national_admin",
    "national_pastor",
    "district_admin",
    "district_pastor",
    "branch_admin",
    "resident_pastor",
    "associate_pastor",
    "follow_up",
  ].includes(role);
}

function buildApprovalsHref(
  params: Record<string, string | undefined>,
  updates: Record<string, string | undefined>,
) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries({ ...params, ...updates })) {
    if (value) {
      query.set(key, value);
    }
  }

  return query.toString() ? `/approvals?${query.toString()}` : "/approvals";
}

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireServerRole("/approvals");
  const params = await searchParams;
  const isSuperAdmin = user.role === "super_admin";
  const canApproveExpenses = canApproveExpenseEntries(user.role);
  const days = user.preferences?.defaultReportDays ?? 30;
  const workspaceSearch = params.workspaceSearch?.trim() || undefined;
  const workspaceStatus = params.workspaceStatus?.trim() || undefined;
  const workspacePage = Math.max(Number(params.workspacePage) || 1, 1);
  const auditSearch = params.auditSearch?.trim() || undefined;
  const auditEntityType = params.auditEntityType?.trim() || undefined;
  const auditPage = Math.max(Number(params.auditPage) || 1, 1);
  const expensePage = Math.max(Number(params.expensePage) || 1, 1);
  const activeTab =
    params.tab && ["attendance", "finance", "workspace", "governance"].includes(params.tab)
      ? params.tab
      : "attendance";

  const [alertsSummary, attendanceSubmissions, pendingExpenses, workspaceRequests, auditLogs, accounts, expenseCategories, serviceSchedules] =
    await Promise.all([
      serverGet<AlertsSummary>(`/alerts/summary?days=${days}`).catch(() => ({
        scope: {
          role: user.role,
          oversightRegion: user.oversightRegion,
          district: user.district,
          branchId: user.branchId,
          branchCount: 0,
        },
        quickStats: {
          firstTimers: 0,
          pendingFollowUp: 0,
          pendingApprovals: 0,
          activeAlerts: 0,
        },
        counts: {
          overdueFollowUp: 0,
          pendingAttendanceApprovals: 0,
          pendingExpenseApprovals: 0,
          pendingWorkspaceRequests: 0,
          branchesWithoutRecentAttendance: 0,
          branchesMissingLeadership: 0,
        },
        items: [],
      })),
      serverGet<AttendanceSubmissionListResponse>(
        "/intake-templates/attendance-submissions?status=pending",
      ).catch(() => ({
        items: [],
        summary: {
          pending: 0,
          approved: 0,
          rejected: 0,
        },
      })),
      canApproveExpenses
        ? serverGet<ExpenseListResponse>(
            `/finance/expenses?status=submitted&page=${expensePage}&limit=6`,
          ).catch(() => ({
            items: [],
            pagination: { page: 1, pageSize: 6, total: 0, totalPages: 1 },
            summary: {
              totalAmount: 0,
              pendingAmount: 0,
              pendingCount: 0,
              visibleBranchCount: 0,
            },
          }))
        : Promise.resolve({
            items: [],
            pagination: { page: 1, pageSize: 6, total: 0, totalPages: 1 },
            summary: {
              totalAmount: 0,
              pendingAmount: 0,
              pendingCount: 0,
              visibleBranchCount: 0,
            },
          }),
      isSuperAdmin
        ? serverGet<WorkspaceRequestListResponse>(
            `/workspace-requests?status=${workspaceStatus || ""}&search=${workspaceSearch || ""}&page=${workspacePage}&limit=8`,
          ).catch(() => ({
            items: [],
            pagination: { page: 1, pageSize: 8, total: 0, totalPages: 1 },
            summary: {
              total: 0,
              newCount: 0,
              inReviewCount: 0,
              approvedCount: 0,
              rejectedCount: 0,
              provisionedCount: 0,
            },
          }))
        : Promise.resolve(null),
      serverGet<AuditLogListResponse>(
        `/audit-logs?entityType=${auditEntityType || ""}&search=${auditSearch || ""}&page=${auditPage}&limit=10`,
      ).catch(() => ({
        items: [],
        pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
      })),
      canApproveExpenses
        ? serverGet<FinanceAccountSummary[]>("/finance/accounts").catch(() => [])
        : Promise.resolve([]),
      canApproveExpenses
        ? serverGet<ExpenseCategorySummary[]>("/finance/expense-categories").catch(() => [])
        : Promise.resolve([]),
      canApproveExpenses
        ? serverGet<ServiceScheduleSummary[]>("/service-schedules").catch(() => [])
        : Promise.resolve([]),
    ]);

  const tabs = [
    {
      key: "attendance",
      label: "Attendance",
      count: attendanceSubmissions.summary.pending,
      visible: true,
    },
    {
      key: "finance",
      label: "Finance",
      count: pendingExpenses.summary.pendingCount,
      visible: canApproveExpenses,
    },
    {
      key: "workspace",
      label: "Workspace",
      count: workspaceRequests?.summary.total ?? 0,
      visible: Boolean(isSuperAdmin && workspaceRequests),
    },
    {
      key: "governance",
      label: "Governance",
      count: alertsSummary.items.length + auditLogs.pagination.total,
      visible: true,
    },
  ].filter((tab) => tab.visible);

  return (
    <Shell>
      <PageHeader
        eyebrow="Approvals"
        title="Approvals and governance"
        description="Review attendance, finance, onboarding, and operational oversight in one place."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Pending approvals"
          value={alertsSummary.quickStats.pendingApprovals}
          delta="Combined attendance, finance, and onboarding load"
          tone="warm"
        />
        <MetricCard
          label="Expense approvals"
          value={alertsSummary.counts.pendingExpenseApprovals}
          delta="Submitted finance requests awaiting approval"
          tone="warm"
        />
        <MetricCard
          label="Overdue follow-up"
          value={alertsSummary.counts.overdueFollowUp}
          delta="Tasks that have passed their next-action date"
          tone="cool"
        />
        <MetricCard
          label="Leadership gaps"
          value={alertsSummary.counts.branchesMissingLeadership}
          delta="Branches still missing pastoral coverage"
          tone="warm"
        />
      </section>

      <section className="surface rounded-[28px] border border-slate-200/70 p-5 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="eyebrow">Review streams</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              Review work by approval stream
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Attendance, finance, workspace onboarding, and governance are organized here for review.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <Link
                key={tab.key}
                href={buildApprovalsHref(params, { tab: tab.key, page: undefined })}
                className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  activeTab === tab.key
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs ${
                    activeTab === tab.key
                      ? "bg-white/15 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {tab.count}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-5">
          {activeTab === "attendance" ? (
            <section className="surface rounded-[28px] border border-slate-200/70 p-5 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="eyebrow">Attendance review</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">
                    Pending attendance submissions
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Attendance submissions waiting for review.
                  </p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {attendanceSubmissions.summary.pending} pending
                </div>
              </div>

              <div className="mt-5">
                <AttendanceSubmissionQueue
                  items={attendanceSubmissions.items}
                  canApprove={canApproveAttendance(user.role)}
                />
              </div>
            </section>
          ) : null}

          {activeTab === "finance" && canApproveExpenses ? (
            <section className="surface rounded-[28px] border border-slate-200/70 p-5 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="eyebrow">Finance approvals</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">
                    Submitted expense requests
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Expense requests awaiting approval before posting to the ledger.
                  </p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {pendingExpenses.summary.pendingCount} pending
                </div>
              </div>

              <div className="mt-5">
                <ExpenseEntriesTable
                  entries={pendingExpenses.items}
                  accounts={accounts}
                  expenseCategories={expenseCategories}
                  serviceSchedules={serviceSchedules}
                  canApprove
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 text-sm">
                <Link
                  href={buildApprovalsHref(params, {
                    tab: "finance",
                    expensePage: String(Math.max(pendingExpenses.pagination.page - 1, 1)),
                  })}
                  aria-disabled={pendingExpenses.pagination.page <= 1}
                  className={`rounded-xl border px-4 py-2 ${
                    pendingExpenses.pagination.page <= 1
                      ? "pointer-events-none border-slate-200 bg-slate-100 text-slate-400"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  Previous
                </Link>
                <span className="text-slate-500">
                  Page {pendingExpenses.pagination.page} of {pendingExpenses.pagination.totalPages}
                </span>
                <Link
                  href={buildApprovalsHref(params, {
                    tab: "finance",
                    expensePage: String(
                      Math.min(
                        pendingExpenses.pagination.page + 1,
                        pendingExpenses.pagination.totalPages,
                      ),
                    ),
                  })}
                  aria-disabled={
                    pendingExpenses.pagination.page >= pendingExpenses.pagination.totalPages
                  }
                  className={`rounded-xl border px-4 py-2 ${
                    pendingExpenses.pagination.page >= pendingExpenses.pagination.totalPages
                      ? "pointer-events-none border-slate-200 bg-slate-100 text-slate-400"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  Next
                </Link>
              </div>
            </section>
          ) : null}

          {activeTab === "workspace" && isSuperAdmin && workspaceRequests ? (
            <section className="surface rounded-[28px] border border-slate-200/70 p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="eyebrow">Workspace onboarding</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">
                    Workspace request review
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Review workspace requests and record decisions before provisioning.
                  </p>
                </div>

                <form method="get" className="grid gap-3 sm:grid-cols-[1.4fr_1fr_auto]">
                  <input type="hidden" name="tab" value="workspace" />
                  <input
                    type="hidden"
                    name="auditSearch"
                    defaultValue={auditSearch}
                  />
                  <input
                    type="hidden"
                    name="auditEntityType"
                    defaultValue={auditEntityType}
                  />
                  <input
                    type="text"
                    name="workspaceSearch"
                    defaultValue={workspaceSearch}
                    placeholder="Search organization, contact, or city"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                  />
                  <select
                    name="workspaceStatus"
                    defaultValue={workspaceStatus || ""}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                  >
                    <option value="">All statuses</option>
                    <option value="new">New</option>
                    <option value="in_review">In review</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="provisioned">Provisioned</option>
                  </select>
                  <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
                    Filter
                  </button>
                </form>
              </div>

              <div className="mt-5">
                <WorkspaceRequestReviewList items={workspaceRequests.items} />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 text-sm">
                <Link
                  href={buildApprovalsHref(params, {
                    tab: "workspace",
                    workspacePage: String(Math.max(workspaceRequests.pagination.page - 1, 1)),
                  })}
                  aria-disabled={workspaceRequests.pagination.page <= 1}
                  className={`rounded-xl border px-4 py-2 ${
                    workspaceRequests.pagination.page <= 1
                      ? "pointer-events-none border-slate-200 bg-slate-100 text-slate-400"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  Previous
                </Link>
                <span className="text-slate-500">
                  Page {workspaceRequests.pagination.page} of {workspaceRequests.pagination.totalPages}
                </span>
                <Link
                  href={buildApprovalsHref(params, {
                    tab: "workspace",
                    workspacePage: String(
                      Math.min(
                        workspaceRequests.pagination.page + 1,
                        workspaceRequests.pagination.totalPages,
                      ),
                    ),
                  })}
                  aria-disabled={
                    workspaceRequests.pagination.page >= workspaceRequests.pagination.totalPages
                  }
                  className={`rounded-xl border px-4 py-2 ${
                    workspaceRequests.pagination.page >= workspaceRequests.pagination.totalPages
                      ? "pointer-events-none border-slate-200 bg-slate-100 text-slate-400"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  Next
                </Link>
              </div>
            </section>
          ) : null}

          {activeTab === "governance" ? (
            <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <section className="surface rounded-[28px] border border-slate-200/70 p-5 shadow-sm">
                <div className="flex flex-col gap-2">
                  <p className="eyebrow">Live alerts</p>
                  <h2 className="text-xl font-semibold text-slate-950">Operational watchlist</h2>
                  <p className="text-sm text-slate-500">
                    Active issues that need leadership attention.
                  </p>
                </div>

                <div className="mt-5 space-y-3">
                  {alertsSummary.items.length > 0 ? (
                    alertsSummary.items.map((item) => (
                      <Link
                        key={item.key}
                        href={item.href}
                        className="block rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-slate-300"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                            <p className="mt-1 text-sm text-slate-500">{item.description}</p>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                              item.tone === "critical"
                                ? "bg-rose-100 text-rose-800"
                                : item.tone === "warm"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-sky-100 text-sky-800"
                            }`}
                          >
                            {item.count}
                          </span>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
                      No live operational alerts in the current scope.
                    </div>
                  )}
                </div>
              </section>

              <section className="surface rounded-[28px] border border-slate-200/70 p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="eyebrow">Audit trail</p>
                    <h2 className="mt-2 text-xl font-semibold text-slate-950">
                      Recent governance activity
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Search recent changes by actor, summary, or entity.
                    </p>
                  </div>

                  <form method="get" className="grid gap-3 sm:grid-cols-[1.25fr_1fr_auto]">
                    <input type="hidden" name="tab" value="governance" />
                    <input
                      type="hidden"
                      name="workspaceSearch"
                      defaultValue={workspaceSearch}
                    />
                    <input
                      type="hidden"
                      name="workspaceStatus"
                      defaultValue={workspaceStatus}
                    />
                    <input
                      type="text"
                      name="auditSearch"
                      defaultValue={auditSearch}
                      placeholder="Search actor or summary"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                    />
                    <select
                      name="auditEntityType"
                      defaultValue={auditEntityType || ""}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                    >
                      <option value="">All entities</option>
                      <option value="attendance">Attendance</option>
                      <option value="attendance_submission">Attendance submission</option>
                      <option value="expense_entry">Expense entry</option>
                      <option value="workspace_request">Workspace request</option>
                      <option value="follow_up">Follow-up</option>
                      <option value="user">User</option>
                      <option value="settings">Settings</option>
                      <option value="service_schedule">Service schedule</option>
                    </select>
                    <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
                      Filter
                    </button>
                  </form>
                </div>

                <div className="mt-5">
                  <AuditLogFeed items={auditLogs.items} />
                </div>

                <div className="mt-5 flex items-center justify-end gap-2 text-sm">
                  <Link
                    href={buildApprovalsHref(params, {
                      tab: "governance",
                      auditPage: String(Math.max(auditLogs.pagination.page - 1, 1)),
                    })}
                    aria-disabled={auditLogs.pagination.page <= 1}
                    className={`rounded-xl border px-4 py-2 ${
                      auditLogs.pagination.page <= 1
                        ? "pointer-events-none border-slate-200 bg-slate-100 text-slate-400"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    Previous
                  </Link>
                  <span className="text-slate-500">
                    Page {auditLogs.pagination.page} of {auditLogs.pagination.totalPages}
                  </span>
                  <Link
                    href={buildApprovalsHref(params, {
                      tab: "governance",
                      auditPage: String(
                        Math.min(auditLogs.pagination.page + 1, auditLogs.pagination.totalPages),
                      ),
                    })}
                    aria-disabled={auditLogs.pagination.page >= auditLogs.pagination.totalPages}
                    className={`rounded-xl border px-4 py-2 ${
                      auditLogs.pagination.page >= auditLogs.pagination.totalPages
                        ? "pointer-events-none border-slate-200 bg-slate-100 text-slate-400"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    Next
                  </Link>
                </div>
              </section>
            </section>
          ) : null}
        </div>
      </section>
    </Shell>
  );
}
