import {
  DirectoryControls,
  DirectoryPagination,
} from "@/components/directory-controls";
import { browseDirectory, type DirectoryParams } from "@/lib/directory";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BranchManagementList } from "@/components/branch-management-list";
import { MetricCard } from "@/components/metric-card";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { Icon } from "@/components/app/icons";
import {
  Badge,
  buttonClass,
  Card,
  CardHeader,
  EmptyState,
} from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import {
  canManageBranchStructure,
  getManageableUserRoleOptions,
  isDistrictRole,
  isNationalRole,
} from "@/lib/permissions";
import { serverGet } from "@/lib/server-api";
import type { BranchOverview, BranchSummary } from "@/lib/types";

export default async function BranchesPage({
  searchParams,
}: {
  searchParams: Promise<DirectoryParams>;
}) {
  const params = await searchParams;
  const user = await requireServerRole("/branches");
  const t = await getTranslations("org.branches");
  const tCommon = await getTranslations("common");
  const tStatuses = await getTranslations("statuses");
  const canManageBranches = canManageBranchStructure(user.role);
  const branchScopedCreateRoles = [
    "branch_admin",
    "resident_pastor",
    "associate_pastor",
    "follow_up",
    "usher",
  ];
  const canCreateBranchLeadership = getManageableUserRoleOptions(
    user.role,
  ).some((role) => branchScopedCreateRoles.includes(role));

  const [branches] = await Promise.all([
    serverGet<BranchOverview[]>("/branches/overview").catch(async () => {
      const fallbackBranches = await serverGet<BranchSummary[]>(
        "/branches",
      ).catch(() => []);
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
  const activeBranches = branches.filter(
    (branch) => branch.status === "active",
  ).length;
  const branchAdmins = branches.reduce(
    (total, branch) => total + branch.metrics.branchAdminCount,
    0,
  );
  const activeOperators = branches.reduce(
    (total, branch) =>
      total + branch.metrics.followUpCount + branch.metrics.usherCount,
    0,
  );

  const scopeLabel =
    user.role === "super_admin"
      ? t("globalOversight")
      : isNationalRole(user.role)
        ? user.oversightRegion || t("nationalScope")
        : isDistrictRole(user.role)
          ? user.district || t("districtScope")
          : t("currentBranch");

  const directory = browseDirectory(
    branches,
    params,
    (branch) =>
      [
        branch.name,
        branch.city,
        branch.state,
        branch.country,
        branch.district,
        branch.oversightRegion,
      ].join(" "),
    (branch) => branch.name,
    {
      status: (branch) => branch.status,
      district: (branch) => branch.district,
    },
  );
  const directoryFilters = [
    {
      key: "status",
      label: tCommon("status"),
      options: [
        { value: "active", label: tStatuses("active") },
        { value: "inactive", label: tStatuses("inactive") },
      ],
    },
    {
      key: "district",
      label: tCommon("district"),
      options: Array.from(new Set(branches.map((branch) => branch.district)))
        .filter(Boolean)
        .map((value) => ({ value, label: value })),
    },
  ];
  return (
    <Shell>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        action={
          canManageBranches ? (
            <Link href="/branches/new" className={buttonClass("primary", "md")}>
              <Icon name="plus" className="h-4 w-4" />
              {t("createBranch")}
            </Link>
          ) : (
            <Link href="/users" className={buttonClass("secondary", "md")}>
              <Icon name="users" className="h-4 w-4" />
              {t("openTeamRoster")}
            </Link>
          )
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t("branches")}
          value={String(totalBranches)}
          delta={t("branchesCaption")}
          tone="cool"
        />
        <MetricCard
          label={t("activeBranches")}
          value={String(activeBranches)}
          delta={t("notActive", { count: Math.max(totalBranches - activeBranches, 0) })}
          tone="warm"
        />
        <MetricCard
          label={t("branchAdmins")}
          value={String(branchAdmins)}
          delta={t("branchAdminsCaption")}
          tone="cool"
        />
        <MetricCard
          label={t("followUpAndUshers")}
          value={String(activeOperators)}
          delta={t("operators")}
          tone="warm"
        />
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
        <Card className="app-rise self-start p-6 sm:p-7">
          <CardHeader
            label={t("directoryLabel")}
            title={t("directoryTitle")}
            description={t("directoryDescription")}
            action={<Badge tone="neutral">{scopeLabel}</Badge>}
          />
          <DirectoryControls
            path="/branches"
            params={params}
            filters={directoryFilters}
          />
          <div className="mt-6">
            {directory.total > 0 ? (
              <>
                <BranchManagementList branches={directory.items} />
                <DirectoryPagination
                  path="/branches"
                  params={params}
                  {...directory}
                />
              </>
            ) : (
              <EmptyState icon="branches" title={t("emptyTitle")}>
                {t("emptyBody")}
              </EmptyState>
            )}
          </div>
        </Card>
        <div className="space-y-4">
          {canCreateBranchLeadership ? (
            <Link
              href="/branches/staff/new"
              className={buttonClass("secondary")}
            >
              {t("addLeadership")}
            </Link>
          ) : null}

          <Card
            className="app-rise p-6 sm:p-7"
            style={{ animationDelay: "180ms" }}
          >
            <CardHeader label={t("operationsLabel")} title={t("goodHabits")} />
            <ul className="mt-5 space-y-2.5">
              {[t("tip1"), t("tip2"), t("tip3")].map((tip) => (
                <li
                  key={tip}
                  className="flex gap-3 rounded-xl bg-[#f6f5f1] px-4 py-3 text-[14px] leading-[1.6] text-[#55534e]"
                >
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
