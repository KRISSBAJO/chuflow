import Link from "next/link";
import { Shell } from "@/components/shell";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { FollowUpScopeFilterBar } from "@/components/follow-up-scope-filter-bar";
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

function buildStatusTone(status?: string) {
  switch (status) {
    case "assigned":
      return "bg-amber-50 text-amber-800";
    case "contacted":
      return "bg-sky-50 text-sky-800";
    case "returned":
      return "bg-emerald-50 text-emerald-800";
    case "prayed_with":
      return "bg-violet-50 text-violet-800";
    case "invited_back":
      return "bg-indigo-50 text-indigo-800";
    case "converted":
      return "bg-teal-50 text-teal-800";
    default:
      return "bg-orange-50 text-orange-800";
  }
}

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
  const canChooseBranch = canFilterAcrossBranches(user.role);
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
    serverGet<BranchSummary[]>("/branches").catch(() => []),
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
        eyebrow="Follow-Up"
        title="Care workflow"
        description="Branch-aware follow-up that helps every guest move from first contact to return, prayer, and next steps with accountability."
        action={
          <a
            href={buildCreateHref()}
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
          >
            + Add follow-up
          </a>
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

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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

      <section className="surface overflow-hidden rounded-[24px]">
        <div className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="eyebrow">Care queue</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Follow-up tasks by scope</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {scopeLabel}. Search notes or guest details, narrow to a branch when needed, and
                  page through the queue without overloading the board.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {secondaryStages.map((stage) => (
                  <span
                    key={stage.label}
                    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"
                  >
                    {stage.label} {stage.value}
                  </span>
                ))}
              </div>
            </div>

            <form className="mt-5 grid gap-3 lg:grid-cols-[1fr_0.8fr_auto]">
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
                placeholder="Search guest name, phone, email, or note"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
              />
              <select
                name="status"
                defaultValue={selectedStatus || ""}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
              >
                <option value="">All stages</option>
                {FOLLOW_UP_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input type="hidden" name="page" value="1" />
              <button className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">
                Apply
              </button>
            </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-5 py-3">Stage</th>
                <th className="px-5 py-3">Guest</th>
                <th className="px-5 py-3">Owner</th>
                <th className="px-5 py-3">Next action</th>
                <th className="px-5 py-3">Method</th>
                <th className="px-5 py-3">Note</th>
                <th className="px-5 py-3 text-right">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {followUpList.items.length > 0 ? (
                followUpList.items.map((item) => {
                  const guestName = item.guestId
                    ? `${item.guestId.firstName} ${item.guestId.lastName}`
                    : "Guest record unavailable";
                  const branchName = item.guestId?.branchId?.name;
                  const assignedName = item.assignedTo
                    ? `${item.assignedTo.firstName} ${item.assignedTo.lastName}`
                    : "Unassigned";

                  return (
                    <tr key={item._id} className="align-top">
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${buildStatusTone(
                            item.status,
                          )}`}
                        >
                          <span aria-hidden="true">●</span>
                          {formatFollowUpValue(item.status)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-950">{guestName}</p>
                        <p className="mt-1 text-xs text-slate-500">{branchName || "Branch"}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-700">{assignedName}</td>
                      <td className="px-5 py-4 text-slate-700">
                        {item.nextActionDate
                          ? new Date(item.nextActionDate).toLocaleString()
                          : "No next action date"}
                        <span className="block text-xs text-slate-400">
                          Updated {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "recently"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-700">{formatFollowUpValue(item.contactMethod)}</td>
                      <td className="max-w-md px-5 py-4 text-slate-600">{item.note}</td>
                      <td className="px-5 py-4 text-right">
                        {item.guestId?._id ? (
                          <Link
                            href={`/guests/${item.guestId._id}`}
                            aria-label={`Open ${guestName}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:border-teal-200 hover:text-teal-700"
                          >
                            ↗
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                    No follow-up tasks match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Showing {startItem}-{endItem} of {followUpList.pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={buildPageHref(Math.max(followUpList.pagination.page - 1, 1))}
              aria-disabled={followUpList.pagination.page <= 1}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                followUpList.pagination.page <= 1
                  ? "pointer-events-none border-slate-200 bg-slate-50 text-slate-400"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              Previous
            </Link>
            <span className="text-sm text-slate-500">
              Page {followUpList.pagination.page} of {followUpList.pagination.totalPages}
            </span>
            <Link
              href={buildPageHref(
                Math.min(
                  followUpList.pagination.page + 1,
                  followUpList.pagination.totalPages,
                ),
              )}
              aria-disabled={
                followUpList.pagination.page >= followUpList.pagination.totalPages
              }
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                followUpList.pagination.page >= followUpList.pagination.totalPages
                  ? "pointer-events-none border-slate-200 bg-slate-50 text-slate-400"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              Next
            </Link>
          </div>
        </div>
      </section>
    </Shell>
  );
}
