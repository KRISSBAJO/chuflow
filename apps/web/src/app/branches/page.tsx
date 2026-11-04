import Link from "next/link";
import { BranchManagementList } from "@/components/branch-management-list";
import { MetricCard } from "@/components/metric-card";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { Icon } from "@/components/app/icons";
import { Badge, buttonClass, Card, CardHeader, EmptyState } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import {
  canManageBranchStructure,
  getManageableUserRoleOptions,
  isDistrictRole,
  isNationalRole,
} from "@/lib/permissions";
import { serverGet } from "@/lib/server-api";
import type {
  BranchOverview,
  BranchSummary,
} from "@/lib/types";

export default async function BranchesPage() {
  const user = await requireServerRole("/branches");
  const canManageBranches = canManageBranchStructure(user.role);
  const branchScopedCreateRoles = [
    "branch_admin",
    "resident_pastor",
    "associate_pastor",
    "follow_up",
    "usher",
  ];
  const canCreateBranchLeadership = getManageableUserRoleOptions(user.role).some((role) =>
    branchScopedCreateRoles.includes(role),
  );

  const [branches] = await Promise.all([
    serverGet<BranchOverview[]>("/branches/overview").catch(async () => {
      const fallbackBranches = await serverGet<BranchSummary[]>("/branches").catch(() => []);
      return fallbackBranches.map((branch) => ({
        ...branch,
        metrics: {
          guestCount: 0,
          memberCount: 0,
          teamCount: 0,
          activeUserCount: 0,
          branchAdminCount: 0,
          residentPastorCount: 0,
          associatePastorCount: 0,
          followUpCount: 0,
          usherCount: 0,
        },
        admins: [],
        residentPastors: [],
        associatePastors: [],
        followUpTeam: [],
        ushers: [],
      }));
    }),
  ]);
  const totalBranches = branches.length;
  const activeBranches = branches.filter((branch) => branch.status === "active").length;
  const branchAdmins = branches.reduce((total, branch) => total + branch.metrics.branchAdminCount, 0);
  const activeOperators = branches.reduce(
    (total, branch) => total + branch.metrics.followUpCount + branch.metrics.usherCount,
    0,
  );

  const scopeLabel =
    user.role === "super_admin"
      ? "Global oversight"
      : isNationalRole(user.role)
        ? user.oversightRegion || "National scope"
        : isDistrictRole(user.role)
          ? user.district || "District scope"
          : "Current branch";

  return (
    <Shell>
      <PageHeader
        eyebrow="Branches"
        title="Branch oversight and operating health"
        description="Keep branch structure, staffing and operating load visible in one place so leadership can grow ministry without losing clarity."
        action={
          canManageBranches ? (
            <Link href="/branches/new" className={buttonClass("primary", "md")}>
              <Icon name="plus" className="h-4 w-4" />
              Create branch
            </Link>
          ) : (
            <a href="/users" className={buttonClass("secondary", "md")}>
              <Icon name="users" className="h-4 w-4" />
              Open team roster
            </a>
          )
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Branches" value={String(totalBranches)} delta="Visible in the current scope" tone="cool" />
        <MetricCard label="Active branches" value={String(activeBranches)} delta={`${Math.max(totalBranches - activeBranches, 0)} not active`} tone="warm" />
        <MetricCard label="Branch admins" value={String(branchAdmins)} delta="Leadership across branches" tone="cool" />
        <MetricCard label="Follow-up and ushers" value={String(activeOperators)} delta="Operational team members" tone="warm" />
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
        <Card className="app-rise self-start p-6 sm:p-7">
          <CardHeader
            label="Branch directory"
            title="All branches in scope"
            description="Live staffing, guest load and member load for every branch you oversee."
            action={<Badge tone="neutral">{scopeLabel}</Badge>}
          />
          <div className="mt-6">
            {branches.length > 0 ? (
              <BranchManagementList
                branches={branches}
              />
            ) : (
              <EmptyState icon="branches" title="No branches yet">
                No branches are visible in your current scope.
              </EmptyState>
            )}
          </div>
        </Card>
        <div className="space-y-4">
          {canCreateBranchLeadership ? <Link href="/branches/staff/new" className={buttonClass("secondary")}>Add branch leadership and support</Link> : null}

          <Card className="app-rise p-6 sm:p-7" style={{ animationDelay: "180ms" }}>
            <CardHeader label="Branch operations" title="Good habits" />
            <ul className="mt-5 space-y-2.5">
              {[
                "Keep branch admin and follow-up staffing current so assignment options stay trustworthy.",
                "Open a branch to jump straight into its staff and scoped user management.",
                "Review guest and member load together so care coverage grows with attendance, not after it.",
              ].map((tip) => (
                <li key={tip} className="flex gap-3 rounded-xl bg-[#f6f5f1] px-4 py-3 text-[14px] leading-[1.6] text-[#55534e]">
                  <span className="lp-flame-bg mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full" />
                  {tip}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>
    </Shell>
  );
}
