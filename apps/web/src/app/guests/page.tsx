import Link from "next/link";
import { Shell } from "@/components/shell";
import { MetricCard } from "@/components/metric-card";
import { GuestPageHeader } from "@/components/guest-page-header";
import { GuestDuplicatePanel } from "@/components/guest-duplicate-panel";
import { GuestCreateModalButton } from "@/components/guest-create-modal-button";
import { TemplateQrCard } from "@/components/template-qr-card";
import { Icon } from "@/components/app/icons";
import {
  Avatar,
  Badge,
  Button,
  buttonClass,
  Card,
  CardHeader,
  EmptyState,
  formatStatus,
  statusTone,
  TableWrap,
} from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { canFilterAcrossBranches } from "@/lib/permissions";
import { publicServerGet, serverGet } from "@/lib/server-api";
import type {
  BranchSummary,
  GuestDuplicateGroup,
  GuestListResponse,
  PublicConnectOption,
  ServiceTypeSummary,
  UserSummary,
} from "@/lib/types";

const channelRowClass =
  "group flex items-center justify-between rounded-xl border border-black/[0.06] bg-white px-3.5 py-3 text-[14px] font-medium text-[#111111] transition-colors hover:bg-[#f6f5f1]";

function ChannelHint({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[12px] font-normal text-[#8a8780] transition-colors group-hover:text-[#111111]">
      {children}
      <Icon name="arrowUpRight" className="h-3.5 w-3.5" />
    </span>
  );
}

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    branchId?: string;
    page?: string;
    sort?: string;
    pageSize?: string;
  }>;
}) {
  const user = await requireServerRole("/guests");

  const params = await searchParams;
  const search = params.search?.trim();
  const canChooseBranch = canFilterAcrossBranches(user.role);
  const selectedBranchId = canChooseBranch
    ? params.branchId?.trim()
    : user.branchId;
  const requestedPage = Math.max(Number(params.page) || 1, 1);
  const queryParams = new URLSearchParams();

  if (search) {
    queryParams.set("search", search);
  }

  if (selectedBranchId) {
    queryParams.set("branchId", selectedBranchId);
  }

  queryParams.set("page", String(requestedPage));
  const pageSize = [25, 50, 100].includes(Number(params.pageSize))
    ? Number(params.pageSize)
    : 25;
  queryParams.set("limit", String(pageSize));
  queryParams.set("sort", params.sort || "newest");

  const query = queryParams.toString() ? `?${queryParams.toString()}` : "";

  const [
    guestList,
    branches,
    users,
    duplicateGroups,
    serviceTypes,
    publicGuestTemplates,
  ] = await Promise.all([
    serverGet<GuestListResponse>(`/guests${query}`),
    serverGet<BranchSummary[]>("/branches/options").catch(() => []),
    serverGet<UserSummary[]>(
      selectedBranchId
        ? `/users/assignment-options?branchId=${encodeURIComponent(selectedBranchId)}`
        : "/users/assignment-options",
    ).catch(() => []),
    serverGet<GuestDuplicateGroup[]>(
      selectedBranchId
        ? `/guests/duplicates?branchId=${encodeURIComponent(selectedBranchId)}`
        : "/guests/duplicates",
    ).catch(() => []),
    serverGet<ServiceTypeSummary[]>("/service-types").catch(() => []),
    publicServerGet<PublicConnectOption[]>(
      "/intake-templates/public/templates?kind=guest",
    ).catch(() => []),
  ]);

  const guests = guestList.items;
  const duplicateCount = duplicateGroups.length;
  const selectedBranch = branches.find(
    (branch) => branch._id === selectedBranchId,
  );
  const scopedGuestTemplates = selectedBranchId
    ? publicGuestTemplates.filter(
        (template) => template.branch?._id === selectedBranchId,
      )
    : publicGuestTemplates;
  const guestTemplateCards =
    selectedBranchId || !canChooseBranch
      ? scopedGuestTemplates.slice(0, 1)
      : scopedGuestTemplates;
  const fallbackPublicGuestUrl = `${process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3001"}/connect`;
  const publicGuestUrl =
    guestTemplateCards[0]?.shareUrl || fallbackPublicGuestUrl;
  const scopeLabel = selectedBranch
    ? `${selectedBranch.name} guest records`
    : canChooseBranch
      ? "All visible branches"
      : "Current branch";
  const paginationQueryBase = new URLSearchParams();
  paginationQueryBase.set("sort", params.sort || "newest");
  paginationQueryBase.set("pageSize", String(pageSize));

  if (search) {
    paginationQueryBase.set("search", search);
  }

  if (selectedBranchId) {
    paginationQueryBase.set("branchId", selectedBranchId);
  }

  function buildPageHref(page: number) {
    const query = new URLSearchParams(paginationQueryBase);
    query.set("page", String(page));
    return `/guests?${query.toString()}`;
  }

  const startItem =
    guestList.pagination.total === 0
      ? 0
      : (guestList.pagination.page - 1) * guestList.pagination.pageSize + 1;
  const endItem = Math.min(
    guestList.pagination.page * guestList.pagination.pageSize,
    guestList.pagination.total,
  );
  const atFirstPage = guestList.pagination.page <= 1;
  const atLastPage =
    guestList.pagination.page >= guestList.pagination.totalPages;

  return (
    <Shell>
      <GuestPageHeader
        branches={branches}
        users={users}
        serviceTypes={serviceTypes}
        defaultBranchId={selectedBranchId || user.branchId}
      />
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Registered today"
          value={String(guestList.summary.todayCount)}
          delta="New guest records created today"
          tone="warm"
        />
        <MetricCard
          label="Possible duplicates"
          value={String(duplicateCount)}
          delta="Duplicate groups in the current scope"
          tone="cool"
        />
        <MetricCard
          label="Assigned follow-up"
          value={String(guestList.summary.assignedFollowUpCount)}
          delta={`${Math.max(guestList.pagination.total - guestList.summary.assignedFollowUpCount, 0)} still unassigned`}
          tone="warm"
        />
      </section>
      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.55fr)]">
        <Card className="app-rise min-w-0 p-6 sm:p-7">
          <CardHeader
            label={scopeLabel}
            title="Latest guests"
            action={<Badge>{guestList.pagination.total} total</Badge>}
          />
          <form className="mt-6 grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
            <input
              name="search"
              defaultValue={search}
              placeholder="Search name, phone or email"
              aria-label="Search guests"
              className={
                canChooseBranch ? "ui-input" : "ui-input sm:col-span-2"
              }
            />
            {canChooseBranch ? (
              <select
                name="branchId"
                defaultValue={selectedBranchId || ""}
                aria-label="Branch"
                className="ui-input"
              >
                <option value="">All branches</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            ) : null}
            <label className="text-xs text-[#6b6b6b]">
              Sort
              <select
                name="sort"
                className="ui-input mt-1"
                defaultValue={params.sort || "newest"}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="name_asc">Name A–Z</option>
                <option value="name_desc">Name Z–A</option>
              </select>
            </label>
            <label className="text-xs text-[#6b6b6b]">
              Per page
              <select
                name="pageSize"
                className="ui-input mt-1"
                defaultValue={pageSize}
              >
                {[25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <Link href="/guests" className={buttonClass("secondary")}>
              Reset
            </Link>
            <input type="hidden" name="page" value="1" />
            <Button type="submit" variant="secondary" icon="search">
              Apply
            </Button>
          </form>
          <div className="mt-6">
            {guests.length > 0 ? (
              <TableWrap>
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>Guest</th>
                      <th>Branch</th>
                      <th>Service date</th>
                      <th>Status</th>
                      <th>Next step</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guests.map((guest) => (
                      <tr key={guest._id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <Avatar
                              name={`${guest.firstName} ${guest.lastName}`}
                            />
                            <div className="min-w-0">
                              <Link
                                href={`/guests/${guest._id}`}
                                className="font-medium text-[#111111] underline-offset-4 hover:text-[#ea580c] hover:underline"
                              >
                                {guest.firstName} {guest.lastName}
                              </Link>
                              <p className="mt-0.5 text-[13px] text-[#8a8780]">
                                {guest.email || guest.phone}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="text-[#55534e]">
                          {guest.branchId?.name ?? "Unassigned"}
                        </td>
                        <td className="whitespace-nowrap tabular-nums text-[#55534e]">
                          {guest.createdAt
                            ? new Date(guest.createdAt).toLocaleDateString()
                            : "No date"}
                        </td>
                        <td>
                          <Badge tone={statusTone(guest.visitStatus)} dot>
                            {formatStatus(guest.visitStatus)}
                          </Badge>
                        </td>
                        <td className="text-[#55534e]">
                          {guest.nextFollowUpStatus
                            ? formatStatus(guest.nextFollowUpStatus)
                            : "Awaiting follow-up"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            ) : (
              <EmptyState icon="guests" title="No guests found">
                No guests match the current filters.
              </EmptyState>
            )}
          </div>
          <div className="mt-5 flex flex-col gap-3 border-t border-black/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-[#8a8780]">
              Showing{" "}
              <span className="font-medium tabular-nums text-[#111111]">
                {startItem}–{endItem}
              </span>{" "}
              of{" "}
              <span className="tabular-nums">{guestList.pagination.total}</span>
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={buildPageHref(Math.max(guestList.pagination.page - 1, 1))}
                aria-disabled={atFirstPage}
                tabIndex={atFirstPage ? -1 : undefined}
                className={buttonClass(
                  "secondary",
                  "sm",
                  atFirstPage ? "pointer-events-none opacity-40" : undefined,
                )}
              >
                Previous
              </Link>
              <span className="px-1 text-[13px] tabular-nums text-[#6b6b6b]">
                Page {guestList.pagination.page} of{" "}
                {guestList.pagination.totalPages}
              </span>
              <Link
                href={buildPageHref(
                  Math.min(
                    guestList.pagination.page + 1,
                    guestList.pagination.totalPages,
                  ),
                )}
                aria-disabled={atLastPage}
                tabIndex={atLastPage ? -1 : undefined}
                className={buttonClass(
                  "secondary",
                  "sm",
                  atLastPage ? "pointer-events-none opacity-40" : undefined,
                )}
              >
                Next
              </Link>
            </div>
          </div>
        </Card>
        <div className="flex min-w-0 flex-col gap-4">
          <Card id="guest-capture" className="p-6 sm:p-7">
            <CardHeader
              label="Guest capture desk"
              title="Desk form or public intake"
              description={
                selectedBranch
                  ? `Desk staff can use the full assisted-registration form here. QR codes and self-registration use the live public guest form for ${selectedBranch.name}.`
                  : canChooseBranch
                    ? "Pick a branch when you need a branch-specific desk form or public guest link. Without a branch filter you see your full visible network."
                    : "Desk staff can use the full assisted-registration form here. QR codes and self-registration use the live public guest form for this branch."
              }
            />
            <div className="mt-5">
              <GuestCreateModalButton
                branches={branches}
                users={users}
                serviceTypes={serviceTypes}
                defaultBranchId={selectedBranchId || user.branchId}
                label="Open desk registration form"
                className={buttonClass("primary", "md", "w-full")}
              />
            </div>
          </Card>
          <Card className="p-6 sm:p-7">
            <CardHeader label="Public guest intake" title="Share links" />
            <div className="mt-5">
              {guestTemplateCards.length > 0 ? (
                <div className="space-y-4">
                  {guestTemplateCards.map((template) => (
                    <TemplateQrCard
                      allowSpanish
                      key={template._id}
                      url={
                        template.shareUrl ||
                        `${process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3001"}/intake/${template.slug}`
                      }
                      title={
                        canChooseBranch && !selectedBranchId
                          ? `${template.branch?.name ?? template.name} guest share link`
                          : `${template.name} share link`
                      }
                    />
                  ))}
                </div>
              ) : (
                <EmptyState icon="templates" title="No public link yet">
                  {canChooseBranch && !selectedBranchId
                    ? "Choose a branch to load its public guest link, or activate a guest template in Templates if none are live yet."
                    : "No public guest template is active yet. Activate one in Templates to turn on self-registration."}
                </EmptyState>
              )}
            </div>
          </Card>
          <Card className="p-6 sm:p-7">
            <CardHeader label="Capture channels" title="Ways to register" />
            <div className="mt-5 space-y-2">
              <a
                href={
                  guestTemplateCards.length > 0 ? publicGuestUrl : "/templates"
                }
                target={guestTemplateCards.length > 0 ? "_blank" : undefined}
                rel={guestTemplateCards.length > 0 ? "noreferrer" : undefined}
                className={channelRowClass}
              >
                <span>Public self-registration</span>
                <ChannelHint>Open</ChannelHint>
              </a>
              <a
                href={
                  guestTemplateCards.length > 0 ? publicGuestUrl : "/templates"
                }
                target={guestTemplateCards.length > 0 ? "_blank" : undefined}
                rel={guestTemplateCards.length > 0 ? "noreferrer" : undefined}
                className={channelRowClass}
              >
                <span>QR code connect card</span>
                <ChannelHint>Share</ChannelHint>
              </a>
              <GuestCreateModalButton
                branches={branches}
                users={users}
                serviceTypes={serviceTypes}
                defaultBranchId={selectedBranchId || user.branchId}
                label="Usher desk registration"
                className={`${channelRowClass} w-full text-left`}
              />
              <a
                href={
                  guestTemplateCards.length > 0 ? publicGuestUrl : "/connect"
                }
                target="_blank"
                rel="noreferrer"
                className={channelRowClass}
              >
                <span>Church tablet kiosk</span>
                <ChannelHint>Launch</ChannelHint>
              </a>
            </div>
          </Card>
          <Card className="p-6 sm:p-7">
            <CardHeader label="Data quality" title="Complete guest cards" />
            <div className="mt-5 rounded-2xl bg-[#f6f5f1] p-5">
              <p className="lp-heading text-[2.25rem] leading-none tabular-nums">
                {guestList.summary.completionRate}%
              </p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
                <div
                  className="lp-flame-bg app-bar h-full rounded-full"
                  style={{
                    width: `${Math.min(Math.max(guestList.summary.completionRate, 0), 100)}%`,
                  }}
                />
              </div>
              <p className="mt-3 text-[13px] text-[#6b6b6b]">
                Guest cards with both a phone number and an email
              </p>
            </div>
          </Card>
          <GuestDuplicatePanel groups={duplicateGroups} />
        </div>
      </section>
    </Shell>
  );
}
