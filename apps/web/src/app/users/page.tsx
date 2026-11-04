import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  Field,
  Pagination,
} from "@/components/ui/ui";
import { UserCreateModalButton } from "@/components/user-create-modal-button";
import { UserManagementList } from "@/components/user-management-list";
import { requireServerRole } from "@/lib/auth";
import {
  canFilterAcrossBranches,
  formatRoleLabel,
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
  sort?: string;
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
  sort?: string;
  isSuperAdmin: boolean;
  canChooseDistrict: boolean;
}) {
  const query = new URLSearchParams();
  if (params.sort) query.set("sort", params.sort);

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
  const pageSize = [10, 20, 25, 50, 100].includes(Number(params.limit))
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
    sort: params.sort || "newest",
    isSuperAdmin,
    canChooseDistrict,
  });

  const usersEndpoint = usersQuery.toString()
    ? `/users/directory?${usersQuery.toString()}`
    : `/users/directory?limit=${pageSize}`;

  const [userDirectory, branches, oversightRegions, districts] =
    await Promise.all([
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
      : (userDirectory.pagination.page - 1) *
          userDirectory.pagination.pageSize +
        1;
  const endItem = Math.min(
    userDirectory.pagination.page * userDirectory.pagination.pageSize,
    totalUsers,
  );

  const scopeLabel = selectedBranchId
    ? "Branch scope"
    : district
      ? "District scope"
      : oversightRegion
        ? "National scope"
        : "Network scope";

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
      sort: params.sort || "newest",
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <Card className="app-rise p-6 sm:p-7">
        <CardHeader
          label="Filters"
          title="Refine the staff directory"
          description="Review people by scope, role, and status."
          action={<Badge tone="info">{scopeLabel}</Badge>}
        />

        <form className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Search" className="xl:col-span-2">
              <input
                name="search"
                defaultValue={search}
                placeholder="Search by name or email"
                className="ui-input"
              />
            </Field>

            <Field label="Role">
              <select name="role" defaultValue={role} className="ui-input">
                <option value="">All roles</option>
                {visibleRoleOptions.map((roleOption) => (
                  <option key={roleOption} value={roleOption}>
                    {formatRoleLabel(roleOption)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Status">
              <select name="status" defaultValue={status} className="ui-input">
                <option value="">All statuses</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </Field>

            {isSuperAdmin ? (
              <Field label="Oversight region">
                <select
                  name="oversightRegion"
                  defaultValue={oversightRegion}
                  className="ui-input"
                >
                  <option value="">All oversight regions</option>
                  {oversightRegionNames.map((regionName) => (
                    <option key={regionName} value={regionName}>
                      {regionName}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {canChooseDistrict ? (
              <Field label="District">
                <select
                  name="district"
                  defaultValue={district}
                  className="ui-input"
                >
                  <option value="">All districts</option>
                  {districtNames.map((districtName) => (
                    <option key={districtName} value={districtName}>
                      {districtName}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {canFilterBranches ? (
              <Field label="Branch">
                <select
                  name="branchId"
                  defaultValue={selectedBranchId}
                  className="ui-input"
                >
                  <option value="">All branches</option>
                  {branches.map((branch) => (
                    <option key={branch._id} value={branch._id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            <Field label="Sort">
              <select
                name="sort"
                className="ui-input"
                defaultValue={params.sort || "newest"}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="name_asc">Name A–Z</option>
                <option value="name_desc">Name Z–A</option>
              </select>
            </Field>
            <Field label="Page size">
              <select
                name="limit"
                defaultValue={String(pageSize)}
                className="ui-input"
              >
                <option value="10">10 per page</option>
                <option value="20">20 per page</option>
                <option value="25">25 per page</option>
                <option value="50">50 per page</option>
                <option value="100">100 per page</option>
              </select>
            </Field>
          </div>

          <input type="hidden" name="page" value="1" />

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-5">
            <p className="text-[13px] text-[#6b6b6b]">
              {totalUsers > 0 ? (
                <>
                  Showing{" "}
                  <span className="font-medium tabular-nums text-[#111111]">
                    {startItem}–{endItem}
                  </span>{" "}
                  of <span className="tabular-nums">{totalUsers}</span> users
                </>
              ) : (
                "No users found in this scope"
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <ButtonLink href="/users" variant="ghost">
                Reset
              </ButtonLink>
              <Button type="submit" icon="search">
                Apply filters
              </Button>
            </div>
          </div>
        </form>
      </Card>

      <Card className="app-rise p-6 sm:p-7" style={{ animationDelay: "60ms" }}>
        <CardHeader
          label="Directory"
          title="Staff accounts"
          description="Open an account to update its details, role, scope, or sign-in access."
          action={
            <Badge>
              {selectedBranchId ? "Filtered scope" : "Current scope"}
            </Badge>
          }
        />

        <div className="mt-6">
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

        <div className="mt-5 flex flex-col gap-2 border-t border-black/[0.06] pt-4">
          <p className="text-[13px] text-[#8a8780]">
            {totalUsers > 0
              ? `Showing ${startItem}–${endItem} of ${totalUsers}`
              : "No users found"}
          </p>
          <Pagination
            page={userDirectory.pagination.page}
            totalPages={userDirectory.pagination.totalPages}
            prevHref={buildPageHref(
              Math.max(1, userDirectory.pagination.page - 1),
            )}
            nextHref={buildPageHref(
              Math.min(
                userDirectory.pagination.totalPages,
                userDirectory.pagination.page + 1,
              ),
            )}
          />
        </div>
      </Card>
    </Shell>
  );
}
