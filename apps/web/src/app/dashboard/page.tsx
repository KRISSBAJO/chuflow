import { DashboardScopeFilterBar } from "@/components/dashboard-scope-filter-bar";
import { redirect } from "next/navigation";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { Shell } from "@/components/shell";
import { requireServerRole } from "@/lib/auth";
import { canFilterAcrossBranches, isGlobalRole, isNationalRole, roleHomeHref } from "@/lib/permissions";
import { serverGet } from "@/lib/server-api";
import type {
  BranchSummary,
  DashboardOverview,
  DistrictOption,
  OversightRegionOption,
} from "@/lib/types";

type DashboardSearchParams = {
  days?: string;
  oversightRegion?: string;
  district?: string;
  branchId?: string;
};

function normalizeParam(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const user = await requireServerRole("/dashboard");
  // Support roles have operational workspaces; reports/dashboard is leadership-only.
  const homeHref = roleHomeHref(user.role);
  if (homeHref !== "/dashboard") redirect(homeHref);
  const params = await searchParams;

  const requestedDays = Number(params.days);
  const days =
    (Number.isFinite(requestedDays) && requestedDays > 0 ? requestedDays : undefined) ||
    user.preferences?.defaultReportDays ||
    30;

  const requestedOversightRegion = isGlobalRole(user.role)
    ? normalizeParam(params.oversightRegion)
    : user.oversightRegion;
  const requestedDistrict =
    isGlobalRole(user.role) || isNationalRole(user.role)
      ? normalizeParam(params.district)
      : user.district;
  const requestedBranchId = canFilterAcrossBranches(user.role)
    ? normalizeParam(params.branchId)
    : user.branchId;

  const dashboardQuery = new URLSearchParams({ days: String(days) });

  if (requestedOversightRegion) {
    dashboardQuery.set("oversightRegion", requestedOversightRegion);
  }

  if (requestedDistrict) {
    dashboardQuery.set("district", requestedDistrict);
  }

  if (requestedBranchId) {
    dashboardQuery.set("branchId", requestedBranchId);
  }

  const [dashboard, branches, oversightRegions, districts] = await Promise.all([
    serverGet<DashboardOverview>(`/reports/dashboard?${dashboardQuery.toString()}`),
    serverGet<BranchSummary[]>("/branches").catch(() => []),
    serverGet<OversightRegionOption[]>("/oversight-regions").catch(() => []),
    serverGet<DistrictOption[]>("/districts").catch(() => []),
  ]);

  return (
    <Shell>
      <DashboardView
        dashboard={dashboard}
        user={user}
        showAllNetworkLink={isGlobalRole(user.role)}
        filterBar={
          <DashboardScopeFilterBar
            canChooseRegion={isGlobalRole(user.role)}
            canChooseDistrict={isGlobalRole(user.role) || isNationalRole(user.role)}
            canChooseBranch={canFilterAcrossBranches(user.role)}
            days={dashboard.scope.days}
            oversightRegion={dashboard.scope.oversightRegion}
            district={dashboard.scope.district}
            branchId={dashboard.scope.branchId}
            oversightRegions={oversightRegions}
            districts={districts}
            branches={branches}
          />
        }
      />
    </Shell>
  );
}
