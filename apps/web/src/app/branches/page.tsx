import { BranchManagementList } from "@/components/branch-management-list";
import { MetricCard } from "@/components/metric-card";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { BranchCreateForm } from "@/components/branch-create-form";
import { UserCreateForm } from "@/components/user-create-form";
import { requireServerRole } from "@/lib/auth";
import {
  canManageBranchStructure,
  getManageableUserRoleOptions,
  isBranchScopedRole,
  isDistrictRole,
  isNationalRole,
} from "@/lib/permissions";
import { serverGet } from "@/lib/server-api";
import type {
  BranchOverview,
  BranchSummary,
  DistrictOption,
  IntakeTemplate,
  OversightRegionOption,
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

  const [branches, oversightRegions, districts, templates] = await Promise.all([
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
    serverGet<OversightRegionOption[]>("/oversight-regions").catch(() => []),
    serverGet<DistrictOption[]>("/districts").catch(() => []),
    serverGet<IntakeTemplate[]>("/intake-templates").catch(() => []),
  ]);
  const defaultStaffBranchId = isBranchScopedRole(user.role) ? branches[0]?._id : undefined;
  const totalBranches = branches.length;
  const activeBranches = branches.filter((branch) => branch.status === "active").length;
  const branchAdmins = branches.reduce((total, branch) => total + branch.metrics.branchAdminCount, 0);
  const activeOperators = branches.reduce(
    (total, branch) => total + branch.metrics.followUpCount + branch.metrics.usherCount,
    0,
  );

  return (
    <Shell>
      <PageHeader
        eyebrow="Branches"
        title="Branch oversight and operating health"
        description="Keep branch structure, staffing, and operating load visible in one place so leadership can scale ministry without losing clarity."
        action={
          canManageBranches ? (
            <a href="#branch-create" className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">
              Create branch
            </a>
          ) : (
            <a href="/users" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">
              Open team roster
            </a>
          )
        }
      />
      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Branches" value={String(totalBranches)} delta="Visible in the current scope" tone="cool" />
        <MetricCard label="Active branches" value={String(activeBranches)} delta={`${Math.max(totalBranches - activeBranches, 0)} not active`} tone="warm" />
        <MetricCard label="Branch admins" value={String(branchAdmins)} delta="Leadership operators across branches" tone="cool" />
        <MetricCard label="Follow-up + ushers" value={String(activeOperators)} delta="Operational team members" tone="warm" />
      </section>
      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="surface rounded-[24px] p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Branch directory</h2>
              <p className="mt-1 text-xs text-slate-500">Live staffing, guest load, and member load for every branch in scope.</p>
            </div>
            <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {user.role === "super_admin"
                ? "Global oversight"
                : isNationalRole(user.role)
                  ? user.oversightRegion || "National scope"
                  : isDistrictRole(user.role)
                    ? user.district || "District scope"
                    : "Current branch"}
            </div>
          </div>
          <div className="mt-4">
            <BranchManagementList
              branches={branches}
              currentUserRole={user.role}
              defaultOversightRegion={user.oversightRegion}
              defaultDistrict={user.district}
              oversightRegions={oversightRegions}
              districts={districts}
              templates={templates}
            />
          </div>
        </section>
        <section className="space-y-4">
          {canManageBranches ? (
            <section id="branch-create" className="surface rounded-[24px] p-1.5">
              <BranchCreateForm
                currentUserRole={user.role}
                defaultOversightRegion={user.oversightRegion}
                defaultDistrict={user.district}
                oversightRegions={oversightRegions}
                districts={districts}
              />
            </section>
          ) : null}
          {canCreateBranchLeadership ? (
            <section className="surface rounded-[24px] p-1.5">
              <UserCreateForm
                branches={branches}
                currentUserRole={user.role}
                defaultBranchId={defaultStaffBranchId}
                defaultOversightRegion={user.oversightRegion}
                defaultDistrict={user.district}
                oversightRegions={oversightRegions}
                districts={districts}
                allowedRoles={branchScopedCreateRoles}
                title="Add branch leadership and support"
                description="Create branch admins, resident pastors, associate pastors, follow-up staff, and ushers without leaving branch operations."
                submitLabel="Add branch staff"
              />
            </section>
          ) : null}
          <section className="surface rounded-[24px] p-5">
            <p className="eyebrow">Branch operations</p>
            <div className="mt-3 space-y-2.5 text-sm text-slate-600">
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                Keep branch-admin and follow-up staffing current so assignment options stay trustworthy.
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                Use the branch staff link inside each branch row to jump straight into scoped user management.
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                Review guest and member load together so care coverage grows with attendance, not after it.
              </div>
            </div>
          </section>
        </section>
      </section>
    </Shell>
  );
}
