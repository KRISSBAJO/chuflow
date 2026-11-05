import { FilterPanel } from "@/components/filter-panel";
import Link from "next/link";
import { AttendanceSubmissionQueue } from "@/components/attendance-submission-queue";
import { AuditLogFeed } from "@/components/audit-log-feed";
import { ExpenseEntriesTable } from "@/components/expense-entries-table";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { Badge, Button, Card, CardHeader, EmptyState, Pagination, TabLinks } from "@/components/ui/ui";
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

  const pagerHrefs = (tab: string, key: string, page: number, totalPages: number) => ({
    prevHref: buildApprovalsHref(params, { tab, [key]: String(Math.max(page - 1, 1)) }),
    nextHref: buildApprovalsHref(params, { tab, [key]: String(Math.min(page + 1, totalPages)) }),
  });

  return (
    <Shell>
      <PageHeader
        eyebrow="Approvals"
        title="Approvals and governance"
        description="Review attendance, finance, onboarding, and operational oversight in one place."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Pending approvals"
          value={alertsSummary.quickStats.pendingApprovals}
          delta="Attendance, finance and onboarding combined"
          tone="warm"
        />
        <MetricCard
          label="Expense approvals"
          value={alertsSummary.counts.pendingExpenseApprovals}
          delta="Finance requests awaiting approval"
          tone="warm"
        />
        <MetricCard
          label="Overdue follow-up"
          value={alertsSummary.counts.overdueFollowUp}
          delta="Past their next-action date"
          tone="cool"
        />
        <MetricCard
          label="Leadership gaps"
          value={alertsSummary.counts.branchesMissingLeadership}
          delta="Branches missing pastoral coverage"
          tone="warm"
        />
      </section>

      <TabLinks
        className="self-start"
        items={tabs.map((tab) => ({
          href: buildApprovalsHref(params, { tab: tab.key, page: undefined }),
          label: tab.label,
          count: tab.count,
          active: activeTab === tab.key,
        }))}
      />

      {activeTab === "attendance" ? (
        <Card className="app-rise p-6 sm:p-7">
          <CardHeader
            label="Attendance review"
            title="Pending attendance submissions"
            description="Service reports waiting for a leader to approve."
            action={
              <Badge tone={attendanceSubmissions.summary.pending ? "warning" : "neutral"}>
                {attendanceSubmissions.summary.pending} pending
              </Badge>
            }
          />
          <div className="mt-6">
            <AttendanceSubmissionQueue items={attendanceSubmissions.items} canApprove={canApproveAttendance(user.role)} />
          </div>
        </Card>
      ) : null}

      {activeTab === "finance" && canApproveExpenses ? (
        <Card className="app-rise p-6 sm:p-7">
          <CardHeader
            label="Finance approvals"
            title="Submitted expense requests"
            description="Expenses waiting for approval before they post to the ledger."
            action={
              <Badge tone={pendingExpenses.summary.pendingCount ? "warning" : "neutral"}>
                {pendingExpenses.summary.pendingCount} pending
              </Badge>
            }
          />
          <div className="mt-6">
            <ExpenseEntriesTable
              entries={pendingExpenses.items}
              accounts={accounts}
              expenseCategories={expenseCategories}
              serviceSchedules={serviceSchedules}
              canApprove
            />
          </div>
          <div className="mt-5">
            <Pagination
              page={pendingExpenses.pagination.page}
              totalPages={pendingExpenses.pagination.totalPages}
              {...pagerHrefs("finance", "expensePage", pendingExpenses.pagination.page, pendingExpenses.pagination.totalPages)}
            />
          </div>
        </Card>
      ) : null}

      {activeTab === "workspace" && isSuperAdmin && workspaceRequests ? (
        <Card className="app-rise p-6 sm:p-7">
          <CardHeader
            label="Workspace onboarding"
            title="Workspace requests"
            description="Review new churches asking for a workspace and record your decision before provisioning."
          />

          <FilterPanel><form method="get" className="mt-6 grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
            <input type="hidden" name="tab" value="workspace" />
            <input type="hidden" name="auditSearch" defaultValue={auditSearch} />
            <input type="hidden" name="auditEntityType" defaultValue={auditEntityType} />
            <input
              type="text"
              name="workspaceSearch"
              defaultValue={workspaceSearch}
              placeholder="Search organization, contact or city"
              aria-label="Search workspace requests"
              className="ui-input"
            />
            <select name="workspaceStatus" defaultValue={workspaceStatus || ""} aria-label="Status" className="ui-input">
              <option value="">All statuses</option>
              <option value="new">New</option>
              <option value="in_review">In review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="provisioned">Provisioned</option>
            </select>
            <Button type="submit" variant="secondary" icon="search">
              Filter
            </Button>
          </form></FilterPanel>

          <div className="mt-6">
            <WorkspaceRequestReviewList items={workspaceRequests.items} />
          </div>
          <div className="mt-5">
            <Pagination
              page={workspaceRequests.pagination.page}
              totalPages={workspaceRequests.pagination.totalPages}
              {...pagerHrefs("workspace", "workspacePage", workspaceRequests.pagination.page, workspaceRequests.pagination.totalPages)}
            />
          </div>
        </Card>
      ) : null}

      {activeTab === "governance" ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <Card className="app-rise p-6 sm:p-7">
            <CardHeader label="Live alerts" title="Operational watchlist" description="Active issues that need leadership attention." />
            <div className="mt-6">
              {alertsSummary.items.length > 0 ? (
                <ul className="divide-y divide-black/[0.05]">
                  {alertsSummary.items.map((item) => (
                    <li key={item.key}>
                      <Link href={item.href} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-[#f6f5f1]">
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-medium text-[#111111]">{item.label}</span>
                          <span className="block text-[13px] text-[#6b6b6b]">{item.description}</span>
                        </span>
                        <Badge tone={item.tone === "critical" ? "danger" : item.tone === "warm" ? "warning" : "info"}>
                          {item.count}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon="approvals" title="All clear">
                  No live operational alerts in the current scope.
                </EmptyState>
              )}
            </div>
          </Card>

          <Card className="app-rise p-6 sm:p-7" style={{ animationDelay: "60ms" }}>
            <CardHeader label="Audit trail" title="Recent governance activity" description="Search recent changes by person, summary or record type." />

            <FilterPanel><form method="get" className="mt-6 grid gap-2 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_auto]">
              <input type="hidden" name="tab" value="governance" />
              <input type="hidden" name="workspaceSearch" defaultValue={workspaceSearch} />
              <input type="hidden" name="workspaceStatus" defaultValue={workspaceStatus} />
              <input
                type="text"
                name="auditSearch"
                defaultValue={auditSearch}
                placeholder="Search person or summary"
                aria-label="Search audit trail"
                className="ui-input"
              />
              <select name="auditEntityType" defaultValue={auditEntityType || ""} aria-label="Record type" className="ui-input">
                <option value="">All records</option>
                <option value="attendance">Attendance</option>
                <option value="attendance_submission">Attendance submission</option>
                <option value="expense_entry">Expense entry</option>
                <option value="workspace_request">Workspace request</option>
                <option value="follow_up">Follow-up</option>
                <option value="user">User</option>
                <option value="settings">Settings</option>
                <option value="service_schedule">Service schedule</option>
              </select>
              <Button type="submit" variant="secondary" icon="search">
                Filter
              </Button>
            </form></FilterPanel>

            <div className="mt-6">
              <AuditLogFeed items={auditLogs.items} />
            </div>
            <div className="mt-5">
              <Pagination
                page={auditLogs.pagination.page}
                totalPages={auditLogs.pagination.totalPages}
                {...pagerHrefs("governance", "auditPage", auditLogs.pagination.page, auditLogs.pagination.totalPages)}
              />
            </div>
          </Card>
        </section>
      ) : null}
    </Shell>
  );
}
