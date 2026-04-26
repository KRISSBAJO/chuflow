import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { UserCreateModalButton } from "@/components/user-create-modal-button";
import { UserManagementList } from "@/components/user-management-list";
import { requireServerRole } from "@/lib/auth";
import {
  canFilterAcrossBranches,
  getVisibleUserRoleOptions,
  isNationalRole,
} from "@/lib/permissions";
import { serverGet } from "@/lib/server-api";
import type {
  BranchSummary,
  DistrictOption,
  OversightRegionOption,
  UserDirectoryResponse,
} from "@/lib/types";

type UsersPageSearchParams = Promise<{
  branchId?: string;
  role?: string;
  search?: string;
  oversightRegion?: string;
  district?: string;
  status?: string;
  page?: string;
  limit?: string;
}>;

function buildUsersQuery(params: {
  selectedBranchId?: string;
  role?: string;
  search?: string;
  oversightRegion?: string;
  district?: string;
  status?: string;
  page?: number;
  limit?: number;
  isSuperAdmin: boolean;
  canChooseDistrict: boolean;
}) {
  const query = new URLSearchParams();

  if (params.selectedBranchId) {
    query.set("branchId", params.selectedBranchId);
  }

  if (params.role) {
    query.set("role", params.role);
  }

  if (params.search) {
    query.set("search", params.search);
  }

  if (params.status) {
    query.set("status", params.status);
  }

  if (params.isSuperAdmin && params.oversightRegion) {
    query.set("oversightRegion", params.oversightRegion);
  }

  if (params.canChooseDistrict && params.district) {
    query.set("district", params.district);
  }

  if (params.page && params.page > 1) {
    query.set("page", String(params.page));
  }

  if (params.limit) {
    query.set("limit", String(params.limit));
  }

  return query;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: UsersPageSearchParams;
}) {
  const currentUser = await requireServerRole("/users");
  const params = await searchParams;

  const isSuperAdmin = currentUser.role === "super_admin";
  const canFilterBranches = canFilterAcrossBranches(currentUser.role);
  const canChooseDistrict = isSuperAdmin || isNationalRole(currentUser.role);

  const search = params.search?.trim() || "";
  const role = params.role?.trim() || "";
  const status = params.status?.trim() || "";
  const requestedPage = Math.max(Number(params.page) || 1, 1);
  const pageSize = [10, 20, 50].includes(Number(params.limit))
    ? Number(params.limit)
    : 10;

  const oversightRegion = isSuperAdmin
    ? params.oversightRegion?.trim() || ""
    : currentUser.oversightRegion || "";

  const district = canChooseDistrict
    ? params.district?.trim() || ""
    : currentUser.district || "";

  const selectedBranchId = canFilterBranches
    ? params.branchId?.trim() || ""
    : currentUser.branchId || "";

  const visibleRoleOptions = getVisibleUserRoleOptions(currentUser.role);

  const usersQuery = buildUsersQuery({
    selectedBranchId,
    role,
    search,
    oversightRegion,
    district,
    status,
    page: requestedPage,
    limit: pageSize,
    isSuperAdmin,
    canChooseDistrict,
  });

  const usersEndpoint = usersQuery.toString()
    ? `/users/directory?${usersQuery.toString()}`
    : `/users/directory?limit=${pageSize}`;

  const [userDirectory, branches, oversightRegions, districts] = await Promise.all([
    serverGet<UserDirectoryResponse>(usersEndpoint),
    serverGet<BranchSummary[]>("/branches").catch(() => []),
    serverGet<OversightRegionOption[]>("/oversight-regions").catch(() => []),
    serverGet<DistrictOption[]>(
      oversightRegion
        ? `/districts?oversightRegion=${encodeURIComponent(oversightRegion)}`
        : "/districts",
    ).catch(() => []),
  ]);

  const oversightRegionNames = oversightRegions.map((region) => region.name);
  const districtNames = districts.map((item) => item.name);
  const users = userDirectory.items;

  const totalUsers = userDirectory.summary.total;
  const activeUsers = userDirectory.summary.active;
  const inactiveUsers = userDirectory.summary.inactive;
  const followUpUsers = userDirectory.summary.followUp;
  const usherUsers = userDirectory.summary.ushers;
  const startItem =
    totalUsers === 0
      ? 0
      : (userDirectory.pagination.page - 1) * userDirectory.pagination.pageSize + 1;
  const endItem = Math.min(
    userDirectory.pagination.page * userDirectory.pagination.pageSize,
    totalUsers,
  );

  function buildPageHref(page: number) {
    const query = buildUsersQuery({
      selectedBranchId,
      role,
      search,
      oversightRegion,
      district,
      status,
      page,
      limit: pageSize,
      isSuperAdmin,
      canChooseDistrict,
    });

    return query.toString() ? `/users?${query.toString()}` : "/users";
  }

  return (
    <Shell>
      <PageHeader
        eyebrow="Users"
        title="User directory"
        description="Manage staff access across oversight, district, and branch scope."
        action={
          <UserCreateModalButton
            branches={branches}
            currentUserRole={currentUser.role}
            defaultBranchId={currentUser.branchId}
            defaultOversightRegion={currentUser.oversightRegion}
            defaultDistrict={currentUser.district}
            oversightRegions={oversightRegions}
            districts={districts}
          />
        }
      />

      <section className="surface rounded-[24px] p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">Directory Filters</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              Refine the staff directory
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Review people by scope, role, and status.
            </p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {selectedBranchId
              ? "Branch scope"
              : district
                ? "District scope"
                : oversightRegion
                  ? "National scope"
                  : "Network scope"}
          </div>
        </div>

        <form className="mt-4 grid gap-3 rounded-[22px] border border-slate-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input
              name="search"
              defaultValue={search}
              placeholder="Search by name or email"
              className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 xl:col-span-2"
            />

            <select
              name="role"
              defaultValue={role}
              className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
            >
              <option value="">All roles</option>
              {visibleRoleOptions.map((roleOption) => (
                <option key={roleOption} value={roleOption}>
                  {roleOption.replace(/_/g, " ")}
                </option>
              ))}
            </select>

            <select
              name="status"
              defaultValue={status}
              className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
            >
              <option value="">All statuses</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>

            {isSuperAdmin ? (
              <select
                name="oversightRegion"
                defaultValue={oversightRegion}
                className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
              >
                <option value="">All oversight regions</option>
                {oversightRegionNames.map((regionName) => (
                  <option key={regionName} value={regionName}>
                    {regionName}
                  </option>
                ))}
              </select>
            ) : null}

            {canChooseDistrict ? (
              <select
                name="district"
                defaultValue={district}
                className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
              >
                <option value="">All districts</option>
                {districtNames.map((districtName) => (
                  <option key={districtName} value={districtName}>
                    {districtName}
                  </option>
                ))}
              </select>
            ) : null}

            {canFilterBranches ? (
              <select
                name="branchId"
                defaultValue={selectedBranchId}
                className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
              >
                <option value="">All branches</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            ) : null}

            <select
              name="limit"
              defaultValue={String(pageSize)}
              className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
            >
              <option value="10">10 per page</option>
              <option value="20">20 per page</option>
              <option value="50">50 per page</option>
            </select>
          </div>

          <input type="hidden" name="page" value="1" />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
              {totalUsers > 0
                ? `Showing ${startItem}-${endItem} of ${totalUsers} users`
                : "No users found in this scope"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/users"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Reset
              </a>
              <button className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800">
                Apply filters
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total users"
          value={String(totalUsers)}
          delta="People with accounts in the current scope"
          tone="cool"
        />
        <MetricCard
          label="Active users"
          value={String(activeUsers)}
          delta={`${inactiveUsers} inactive`}
          tone="warm"
        />
        <MetricCard
          label="Follow-up team"
          value={String(followUpUsers)}
          delta="Care workflow staff"
          tone="cool"
        />
        <MetricCard
          label="Ushers"
          value={String(usherUsers)}
          delta="Front desk and service-day operators"
          tone="warm"
        />
      </section>

      <section className="surface rounded-[28px] border border-slate-200/70 p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                User directory
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Staff accounts in the current scope.
              </p>
            </div>

            <div className="inline-flex w-fit rounded-xl bg-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {selectedBranchId ? "Filtered scope" : "Current scope"}
            </div>
          </div>

          <div className="mt-5">
            <UserManagementList
              users={users}
              branches={branches}
              currentUserRole={currentUser.role}
              currentUserId={currentUser.id || currentUser._id}
              defaultBranchId={currentUser.branchId}
              defaultOversightRegion={currentUser.oversightRegion}
              defaultDistrict={currentUser.district}
              oversightRegions={oversightRegions}
              districts={districts}
            />
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
              {totalUsers > 0
                ? `Showing ${startItem}-${endItem} of ${totalUsers}`
                : "No users found"}
            </p>
            <div className="flex items-center gap-2">
              <a
                href={buildPageHref(Math.max(1, userDirectory.pagination.page - 1))}
                aria-disabled={userDirectory.pagination.page === 1}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                  userDirectory.pagination.page === 1
                    ? "pointer-events-none border-slate-200 text-slate-300"
                    : "border-slate-200 text-slate-700"
                }`}
              >
                Previous
              </a>
              <span className="text-sm text-slate-500">
                Page {userDirectory.pagination.page} of {userDirectory.pagination.totalPages}
              </span>
              <a
                href={buildPageHref(
                  Math.min(
                    userDirectory.pagination.totalPages,
                    userDirectory.pagination.page + 1,
                  ),
                )}
                aria-disabled={
                  userDirectory.pagination.page === userDirectory.pagination.totalPages
                }
                className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                  userDirectory.pagination.page === userDirectory.pagination.totalPages
                    ? "pointer-events-none border-slate-200 text-slate-300"
                    : "border-slate-200 text-slate-700"
                }`}
              >
                Next
              </a>
            </div>
          </div>
      </section>
    </Shell>
  );
}
