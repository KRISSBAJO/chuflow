import Link from "next/link";
import { Shell } from "@/components/shell";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { FollowUpCreateForm } from "@/components/follow-up-create-form";
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
  GuestListResponse,
  OversightRegionOption,
  UserSummary,
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
  const guestQuery = new URLSearchParams();

  if (search) {
    followUpQuery.set("search", search);
  }

  if (selectedStatus) {
    followUpQuery.set("status", selectedStatus);
  }

  followUpQuery.set("page", String(requestedPage));
  followUpQuery.set("limit", "12");
  guestQuery.set("page", "1");
  guestQuery.set("limit", "100");

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
    guestQuery.set("branchId", effectiveBranchId);
  }

  const userBranchScopeForCreate =
    effectiveBranchId || (!canChooseBranch ? user.branchId : undefined);

  const [followUpList, guestOptions, users] = await Promise.all([
    serverGet<FollowUpListResponse>(`/follow-ups?${followUpQuery.toString()}`),
    userBranchScopeForCreate
      ? serverGet<GuestListResponse>(`/guests?${guestQuery.toString()}`).catch(() => ({
          items: [],
          pagination: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
          summary: { todayCount: 0, completionRate: 0, assignedFollowUpCount: 0 },
        }))
      : Promise.resolve({
          items: [],
          pagination: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
          summary: { todayCount: 0, completionRate: 0, assignedFollowUpCount: 0 },
        }),
    userBranchScopeForCreate
      ? serverGet<UserSummary[]>(`/users?branchId=${encodeURIComponent(userBranchScopeForCreate)}`).catch(
          () => [],
        )
      : Promise.resolve([]),
  ]);

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
  const assignmentDisabled = canChooseBranch && !effectiveBranchId;
  const assignmentHint = assignmentDisabled
    ? "Choose a branch above before creating or assigning a care task so the guest and worker lists stay local to that branch."
    : "Assigning a care worker automatically moves this record from New to Assigned.";

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
            href="#follow-up-create"
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
          >
            Add follow-up
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

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-4">
          <section className="surface rounded-[24px] p-5">
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

            <div className="mt-5 space-y-3">
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
                    <article
                      key={item._id}
                      className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-slate-950">{guestName}</h3>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${buildStatusTone(
                                item.status,
                              )}`}
                            >
                              {formatFollowUpValue(item.status)}
                            </span>
                            {branchName ? (
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                {branchName}
                              </span>
                            ) : null}
                          </div>
                          <p className="max-w-3xl text-sm leading-6 text-slate-600">{item.note}</p>
                          <div className="flex flex-wrap gap-2 text-xs font-semibold">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                              {formatFollowUpValue(item.contactMethod)}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                              {assignedName}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                              {item.nextActionDate
                                ? `Next ${new Date(item.nextActionDate).toLocaleString()}`
                                : "No next action date"}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                              Updated{" "}
                              {item.updatedAt
                                ? new Date(item.updatedAt).toLocaleDateString()
                                : "recently"}
                            </span>
                          </div>
                        </div>
                        {item.guestId?._id ? (
                          <Link
                            href={`/guests/${item.guestId._id}`}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-orange-200 hover:text-orange-700"
                          >
                            Open guest
                          </Link>
                        ) : null}
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-500">
                  No follow-up tasks match the current filters.
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
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
        </div>

        <section id="follow-up-create" className="space-y-4">
          <div className="surface rounded-[24px] p-5">
            <p className="eyebrow">Workflow guide</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">How assignment works</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              New starts unowned, Assigned has a care worker, Contacted means outreach happened,
              and Returned confirms the guest came back. Prayer, invitation, and conversion stages
              still stay visible in the queue.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              {["New", "Assigned", "Contacted", "Returned"].map((stage) => (
                <span key={stage} className="rounded-full bg-slate-100 px-3 py-2 text-slate-600">
                  {stage}
                </span>
              ))}
            </div>
          </div>

          <section className="surface rounded-[32px] p-2">
            <FollowUpCreateForm
              guests={guestOptions.items}
              users={users}
              currentUserRole={user.role}
              currentUserId={user.id || user._id}
              guestSelectionDisabled={assignmentDisabled}
              guestSelectionHint={
                assignmentDisabled
                  ? "Choose a branch in the scope bar first. Guest creation and assignment are intentionally localized to one branch."
                  : guestOptions.items.length === 0
                    ? "No guests are available in the selected branch yet."
                    : undefined
              }
              assignmentDisabled={assignmentDisabled}
              assignmentHint={assignmentHint}
            />
          </section>
        </section>
      </section>
    </Shell>
  );
}
