import { ExportMenu } from "@/components/export-menu";
import { getTranslations } from "next-intl/server";
import { FilterPanel } from "@/components/filter-panel";
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
  const t = await getTranslations("org.users");
  const tCommon = await getTranslations("common");
  const tRoles = await getTranslations("roles");

  const isSuperAdmin = currentUser.role === "super_admin";
  const canFilterBranches = canFilterAcrossBranches(
    currentUser.role,
    currentUser.hasOversight,
  );
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
  const roleLabel = (value: string) =>
    tRoles.has(value as Parameters<typeof tRoles>[0])
      ? tRoles(value as Parameters<typeof tRoles>[0])
      : formatRoleLabel(value);

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
    ? t("branchScope")
    : district
      ? t("districtScope")
      : oversightRegion
        ? t("nationalScope")
        : t("networkScope");

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
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
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
          label={t("totalUsers")}
          value={String(totalUsers)}
          delta={t("totalUsersCaption")}
          tone="cool"
        />
        <MetricCard
          label={t("activeUsers")}
          value={String(activeUsers)}
          delta={t("inactiveCount", { count: inactiveUsers })}
          tone="warm"
        />
        <MetricCard
          label={t("followUpTeam")}
          value={String(followUpUsers)}
          delta={t("followUpTeamCaption")}
          tone="cool"
        />
        <MetricCard
          label={t("ushers")}
          value={String(usherUsers)}
          delta={t("ushersCaption")}
          tone="warm"
        />
      </section>

      <div className="flex justify-end">
        <ExportMenu resource="users" />
      </div>
      <FilterPanel className="app-rise p-6 sm:p-7">
        <CardHeader
          label={tCommon("filters")}
          title={t("filtersTitle")}
          description={t("filtersDescription")}
          action={<Badge tone="info">{scopeLabel}</Badge>}
        />

        <form className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label={tCommon("search")} className="xl:col-span-2">
              <input
                name="search"
                defaultValue={search}
                placeholder={t("searchPlaceholder")}
                className="ui-input"
              />
            </Field>

            <Field label={t("role")}>
              <select name="role" defaultValue={role} className="ui-input">
                <option value="">{t("allRoles")}</option>
                {visibleRoleOptions.map((roleOption) => (
                  <option key={roleOption} value={roleOption}>
                    {roleLabel(roleOption)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={tCommon("status")}>
              <select name="status" defaultValue={status} className="ui-input">
                <option value="">{t("allStatuses")}</option>
                <option value="active">{t("activeOnly")}</option>
                <option value="inactive">{t("inactiveOnly")}</option>
              </select>
            </Field>

            {isSuperAdmin ? (
              <Field label={t("oversightRegion")}>
                <select
                  name="oversightRegion"
                  defaultValue={oversightRegion}
                  className="ui-input"
                >
                  <option value="">{t("allOversightRegions")}</option>
                  {oversightRegionNames.map((regionName) => (
                    <option key={regionName} value={regionName}>
                      {regionName}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {canChooseDistrict ? (
              <Field label={tCommon("district")}>
                <select
                  name="district"
                  defaultValue={district}
                  className="ui-input"
                >
                  <option value="">{tCommon("allDistricts")}</option>
                  {districtNames.map((districtName) => (
                    <option key={districtName} value={districtName}>
                      {districtName}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {canFilterBranches ? (
              <Field label={tCommon("branch")}>
                <select
                  name="branchId"
                  defaultValue={selectedBranchId}
                  className="ui-input"
                >
                  <option value="">{tCommon("allBranches")}</option>
                  {branches.map((branch) => (
                    <option key={branch._id} value={branch._id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            <Field label={tCommon("sort")}>
              <select
                name="sort"
                className="ui-input"
                defaultValue={params.sort || "newest"}
              >
                <option value="newest">{tCommon("newestFirst")}</option>
                <option value="oldest">{tCommon("oldestFirst")}</option>
                <option value="name_asc">{tCommon("nameAsc")}</option>
                <option value="name_desc">{tCommon("nameDesc")}</option>
              </select>
            </Field>
            <Field label={t("pageSize")}>
              <select
                name="limit"
                defaultValue={String(pageSize)}
                className="ui-input"
              >
                {[10, 20, 25, 50, 100].map((size) => (
                  <option key={size} value={String(size)}>
                    {t("perPage", { count: size })}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <input type="hidden" name="page" value="1" />

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-5">
            <p className="text-[13px] text-[#6b6b6b]">
              {totalUsers > 0
                ? t.rich("showing", {
                    from: startItem,
                    to: endItem,
                    total: totalUsers,
                    b: (chunks) => (
                      <span className="font-medium tabular-nums text-[#111111]">
                        {chunks}
                      </span>
                    ),
                    n: (chunks) => (
                      <span className="tabular-nums">{chunks}</span>
                    ),
                  })
                : t("noUsersInScope")}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <ButtonLink href="/users" variant="ghost">
                {tCommon("reset")}
              </ButtonLink>
              <Button type="submit" icon="search">
                {t("applyFilters")}
              </Button>
            </div>
          </div>
        </form>
      </FilterPanel>

      <Card className="app-rise p-6 sm:p-7" style={{ animationDelay: "60ms" }}>
        <CardHeader
          label={t("directoryLabel")}
          title={t("directoryTitle")}
          description={t("directoryDescription")}
          action={
            <Badge>
              {selectedBranchId ? t("filteredScope") : t("currentScope")}
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
              ? t("showingShort", {
                  from: startItem,
                  to: endItem,
                  total: totalUsers,
                })
              : t("noUsers")}
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
