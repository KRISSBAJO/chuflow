import Link from "next/link";
import { Shell } from "@/components/shell";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { FollowUpScopeFilterBar } from "@/components/follow-up-scope-filter-bar";
import { Icon } from "@/components/app/icons";
import {
  Badge,
  Button,
  buttonClass,
  Card,
  CardHeader,
  EmptyState,
  Pagination,
  statusTone,
  TableWrap,
} from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import {
  FOLLOW_UP_STATUS_OPTIONS,
  formatFollowUpValue,
} from "@/lib/follow-up-options";
import {
  canFilterAcrossBranches,
  isGlobalRole,
  isNationalRole,
} from "@/lib/permissions";
import { serverGet } from "@/lib/server-api";
import type {
  BranchSummary,
  DistrictOption,
  FollowUpListResponse,
  OversightRegionOption,
} from "@/lib/types";

export default async function FollowUpPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    oversightRegion?: string;
    district?: string;
    branchId?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const user = await requireServerRole("/follow-up");
  const params = await searchParams;
  const search = params.search?.trim();
  const canChooseBranch = canFilterAcrossBranches(user.role, user.hasOversight);
  const requestedOversightRegion = isGlobalRole(user.role)
    ? params.oversightRegion?.trim() || undefined
    : user.oversightRegion;
  const requestedDistrict =
    isGlobalRole(user.role) || isNationalRole(user.role)
      ? params.district?.trim() || undefined
      : user.district;
  const selectedBranchId = canChooseBranch ? params.branchId?.trim() : user.branchId;
  const selectedStatus = params.status?.trim();
  const requestedPage = Math.max(Number(params.page) || 1, 1);

  const followUpQuery = new URLSearchParams();

  if (search) {
    followUpQuery.set("search", search);
  }

  if (selectedStatus) {
    followUpQuery.set("status", selectedStatus);
  }

  followUpQuery.set("page", String(requestedPage));
  followUpQuery.set("limit", "12");

  const [branches, oversightRegions, districts] = await Promise.all([
    serverGet<BranchSummary[]>("/branches/options").catch(() => []),
    serverGet<OversightRegionOption[]>("/oversight-regions").catch(() => []),
    serverGet<DistrictOption[]>("/districts").catch(() => []),
  ]);

  const filteredBranches = branches.filter((branch) => {
    if (requestedOversightRegion && branch.oversightRegion !== requestedOversightRegion) {
      return false;
    }

    if (requestedDistrict && branch.district !== requestedDistrict) {
      return false;
    }

    return true;
  });

  const effectiveBranchId =
    selectedBranchId &&
    filteredBranches.some((branch) => branch._id === selectedBranchId)
      ? selectedBranchId
      : undefined;

  if (effectiveBranchId) {
    followUpQuery.set("branchId", effectiveBranchId);
  }
  const followUpList = await serverGet<FollowUpListResponse>(`/follow-ups?${followUpQuery.toString()}`);

  const selectedBranch = branches.find((branch) => branch._id === effectiveBranchId);
  const scopeLabel = selectedBranch
    ? `${selectedBranch.name} care queue`
    : canChooseBranch
      ? requestedDistrict
        ? `${requestedDistrict} district queue`
        : requestedOversightRegion
          ? `${requestedOversightRegion} national queue`
          : "All visible branches"
      : "Current branch";
  const paginationQueryBase = new URLSearchParams();

  if (search) {
    paginationQueryBase.set("search", search);
  }

  if (requestedOversightRegion) {
    paginationQueryBase.set("oversightRegion", requestedOversightRegion);
  }

  if (requestedDistrict) {
    paginationQueryBase.set("district", requestedDistrict);
  }

  if (effectiveBranchId) {
    paginationQueryBase.set("branchId", effectiveBranchId);
  }

  if (selectedStatus) {
    paginationQueryBase.set("status", selectedStatus);
  }

  function buildPageHref(page: number) {
    const query = new URLSearchParams(paginationQueryBase);
    query.set("page", String(page));
    return `/follow-up?${query.toString()}`;
  }

  function buildCreateHref() {
    const query = new URLSearchParams(paginationQueryBase);
    query.delete("status");
    query.delete("page");
    return query.toString() ? `/follow-up/new?${query.toString()}` : "/follow-up/new";
  }

  const startItem =
    followUpList.pagination.total === 0
      ? 0
      : (followUpList.pagination.page - 1) * followUpList.pagination.pageSize + 1;
  const endItem = Math.min(
    followUpList.pagination.page * followUpList.pagination.pageSize,
    followUpList.pagination.total,
  );

  const secondaryStages = [
    { label: "Prayed with", value: followUpList.summary.prayedWith },
    { label: "Invited back", value: followUpList.summary.invitedBack },
    { label: "Converted", value: followUpList.summary.converted },
  ];

  return (
    <Shell>
      <PageHeader
        eyebrow="Follow-up"
        title="Care workflow"
        description="Help every guest move from first contact to return, prayer and next steps, with clear ownership in each branch."
        action={<div className="flex flex-wrap gap-2"><Link href="/care" className={buttonClass("secondary")}>Care & connection hub</Link>
          <a href={buildCreateHref()} className={buttonClass("primary")}>
            <Icon name="plus" className="h-4 w-4" />
            Add follow-up
          </a></div>
        }
      />

      <FollowUpScopeFilterBar
        canChooseRegion={isGlobalRole(user.role)}
        canChooseDistrict={isGlobalRole(user.role) || isNationalRole(user.role)}
        canChooseBranch={canChooseBranch}
        oversightRegion={requestedOversightRegion}
        district={requestedDistrict}
        branchId={effectiveBranchId}
        status={selectedStatus}
        search={search}
        oversightRegions={oversightRegions}
        districts={districts}
        branches={branches}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="New"
          value={followUpList.summary.new}
          delta="Fresh care tasks awaiting first touch"
          tone="warm"
        />
        <MetricCard
          label="Assigned"
          value={followUpList.summary.assigned}
          delta="Guests already owned by a care worker"
          tone="cool"
        />
        <MetricCard
          label="Contacted"
          value={followUpList.summary.contacted}
          delta="Reached and actively progressing"
          tone="cool"
        />
        <MetricCard
          label="Returned"
          value={followUpList.summary.returned}
          delta="Guests who came back again"
          tone="warm"
        />
      </section>

      <Card className="app-rise p-6 sm:p-7">
        <CardHeader
          label="Care queue"
          title="Follow-up tasks"
          description={`${scopeLabel}. Search notes or guest details, narrow to a stage, and page through the queue.`}
          action={secondaryStages.map((stage) => (
            <Badge key={stage.label}>
              {stage.label} <span className="tabular-nums">{stage.value}</span>
            </Badge>
          ))}
        />

        <form className="mt-6 grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
          {requestedOversightRegion ? (
            <input type="hidden" name="oversightRegion" value={requestedOversightRegion} />
          ) : null}
          {requestedDistrict ? (
            <input type="hidden" name="district" value={requestedDistrict} />
          ) : null}
          {effectiveBranchId ? (
            <input type="hidden" name="branchId" value={effectiveBranchId} />
          ) : null}
          <input
            name="search"
            defaultValue={search}
            placeholder="Search guest name, phone, email or note"
            aria-label="Search follow-up tasks"
            className="ui-input"
          />
          <select name="status" defaultValue={selectedStatus || ""} aria-label="Stage" className="ui-input">
            <option value="">All stages</option>
            {FOLLOW_UP_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input type="hidden" name="page" value="1" />
          <Button type="submit" variant="secondary" icon="search">
            Apply
          </Button>
        </form>

        <div className="mt-6">
          {followUpList.items.length > 0 ? (
            <TableWrap>
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Stage</th>
                    <th>Guest</th>
                    <th>Owner</th>
                    <th>Next action</th>
                    <th>Method</th>
                    <th>Note</th>
                    <th className="text-right">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {followUpList.items.map((item) => {
                    const guestName = item.guestId
                      ? `${item.guestId.firstName} ${item.guestId.lastName}`
                      : "Guest record unavailable";
                    const branchName = item.guestId?.branchId?.name;
                    const assignedName = item.assignedTo
                      ? `${item.assignedTo.firstName} ${item.assignedTo.lastName}`
                      : "Unassigned";

                    return (
                      <tr key={item._id} className="align-top">
                        <td>
                          <Badge tone={statusTone(item.status)} dot>
                            {formatFollowUpValue(item.status)}
                          </Badge>
                        </td>
                        <td>
                          <p className="font-medium text-[#111111]">{guestName}</p>
                          <p className="mt-0.5 text-[12px] text-[#8a8780]">{branchName || "Branch"}</p>
                        </td>
                        <td className="whitespace-nowrap !text-[#55534e]">{assignedName}</td>
                        <td className="!text-[#55534e]">
                          {item.nextActionDate
                            ? new Date(item.nextActionDate).toLocaleString()
                            : "No next action date"}
                          <span className="mt-0.5 block text-[12px] text-[#8a8780]">
                            Updated {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "recently"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap !text-[#55534e]">{formatFollowUpValue(item.contactMethod)}</td>
                        <td className="max-w-md text-[13px] leading-[1.6] !text-[#6b6b6b]">{item.note}</td>
                        <td className="text-right">
                          {item.guestId?._id ? (
                            <Link
                              href={`/guests/${item.guestId._id}`}
                              aria-label={`Open ${guestName}`}
                              className={buttonClass("ghost", "sm", "w-8 px-0")}
                            >
                              <Icon name="arrowUpRight" className="h-4 w-4" />
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          ) : (
            <EmptyState icon="care" title="No follow-up tasks">
              No follow-up tasks match the current filters.
            </EmptyState>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-2 border-t border-black/[0.06] pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-[#8a8780]">
            Showing <span className="tabular-nums text-[#111111]">{startItem}–{endItem}</span> of{" "}
            <span className="tabular-nums">{followUpList.pagination.total}</span>
          </p>
          <Pagination
            page={followUpList.pagination.page}
            totalPages={followUpList.pagination.totalPages}
            prevHref={buildPageHref(Math.max(followUpList.pagination.page - 1, 1))}
            nextHref={buildPageHref(
              Math.min(followUpList.pagination.page + 1, followUpList.pagination.totalPages),
            )}
          />
        </div>
      </Card>
    </Shell>
  );
}
