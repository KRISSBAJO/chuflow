import { workspaceApiContext } from "@/lib/workspace-routing";
import { FilterPanel } from "@/components/filter-panel";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
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
import { canAccessPrayerCare, canFilterAcrossBranches } from "@/lib/permissions";
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
  const [t, tc, ts, tsh, format] = await Promise.all([
    getTranslations("people.guests.list"),
    getTranslations("common"),
    getTranslations("statuses"),
    getTranslations("people.shared"),
    getFormatter(),
  ]);
  type StatusKey = Parameters<typeof ts>[0];
  const statusLabel = (value?: string | null) => {
    if (!value) return "";
    const key = value.toLowerCase();
    return ts.has(key as StatusKey) ? ts(key as StatusKey) : formatStatus(value);
  };

  const params = await searchParams;
  const search = params.search?.trim();
  const canChooseBranch = canFilterAcrossBranches(user.role, user.hasOversight);
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
      workspaceApiContext(user.workspace?.id === "winners-chapel-international" ? null : user.workspace?.id).base,
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
  const guestWorkspace = user.workspace?.id;
  const workspaceQuery = guestWorkspace && guestWorkspace !== "winners-chapel-international"
    ? `?workspace=${encodeURIComponent(guestWorkspace)}`
    : "";
  const fallbackPublicGuestUrl = `${process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3001"}/connect${workspaceQuery}`;
  const publicGuestUrl =
    guestTemplateCards[0]?.shareUrl || fallbackPublicGuestUrl;
  const scopeLabel = selectedBranch
    ? t("scopeBranch", { name: selectedBranch.name })
    : canChooseBranch
      ? t("allVisibleBranches")
      : t("currentBranch");
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
      {canAccessPrayerCare(user.role) ? (
        <div><Link href="/guests/prayer-care" className="inline-flex min-h-11 items-center rounded-full border border-black/10 px-4 text-sm font-medium">{(await getTranslations("people.prayerCare"))("title")}</Link></div>
      ) : null}
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label={t("registeredToday")}
          value={String(guestList.summary.todayCount)}
          delta={t("registeredTodayCaption")}
          tone="warm"
        />
        <MetricCard
          label={t("possibleDuplicates")}
          value={String(duplicateCount)}
          delta={t("possibleDuplicatesCaption")}
          tone="cool"
        />
        <MetricCard
          label={t("assignedFollowUp")}
          value={String(guestList.summary.assignedFollowUpCount)}
          delta={t("stillUnassigned", { count: Math.max(guestList.pagination.total - guestList.summary.assignedFollowUpCount, 0) })}
          tone="warm"
        />
      </section>
      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.55fr)]">
        <Card className="app-rise min-w-0 p-6 sm:p-7">
          <CardHeader
            label={scopeLabel}
            title={t("latestGuests")}
            action={<Badge>{t("total", { count: guestList.pagination.total })}</Badge>}
          />
          <FilterPanel><form className="mt-6 grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
            <input
              name="search"
              defaultValue={search}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchAria")}
              className={
                canChooseBranch ? "ui-input" : "ui-input sm:col-span-2"
              }
            />
            {canChooseBranch ? (
              <select
                name="branchId"
                defaultValue={selectedBranchId || ""}
                aria-label={tc("branch")}
                className="ui-input"
              >
                <option value="">{tc("allBranches")}</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            ) : null}
            <label className="text-xs text-[#6b6b6b]">
              {tc("sort")}
              <select
                name="sort"
                className="ui-input mt-1"
                defaultValue={params.sort || "newest"}
              >
                <option value="newest">{tc("newestFirst")}</option>
                <option value="oldest">{tc("oldestFirst")}</option>
                <option value="name_asc">{tc("nameAsc")}</option>
                <option value="name_desc">{tc("nameDesc")}</option>
              </select>
            </label>
            <label className="text-xs text-[#6b6b6b]">
              {tc("perPage")}
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
              {tc("reset")}
            </Link>
            <input type="hidden" name="page" value="1" />
            <Button type="submit" variant="secondary" icon="search">
              {tc("apply")}
            </Button>
          </form></FilterPanel>
          <div className="mt-6">
            {guests.length > 0 ? (
              <TableWrap>
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>{t("guest")}</th>
                      <th>{tc("branch")}</th>
                      <th>{t("serviceDate")}</th>
                      <th>{tc("status")}</th>
                      <th>{t("nextStep")}</th>
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
                          {guest.branchId?.name ?? tsh("unassigned")}
                        </td>
                        <td className="whitespace-nowrap tabular-nums text-[#55534e]">
                          {guest.createdAt
                            ? format.dateTime(new Date(guest.createdAt), { dateStyle: "short" })
                            : t("noDate")}
                        </td>
                        <td>
                          <Badge tone={statusTone(guest.visitStatus)} dot>
                            {statusLabel(guest.visitStatus)}
                          </Badge>
                        </td>
                        <td className="text-[#55534e]">
                          {guest.nextFollowUpStatus
                            ? statusLabel(guest.nextFollowUpStatus)
                            : t("awaitingFollowUp")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            ) : (
              <EmptyState icon="guests" title={t("noGuestsTitle")}>
                {t("noGuestsBody")}
              </EmptyState>
            )}
          </div>
          <div className="mt-5 flex flex-col gap-3 border-t border-black/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-[#8a8780]">
              {tsh.rich("showing", {
                from: startItem,
                to: endItem,
                total: guestList.pagination.total,
                range: (chunks) => <span className="font-medium tabular-nums text-[#111111]">{chunks}</span>,
                count: (chunks) => <span className="tabular-nums">{chunks}</span>,
              })}
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
                {tc("previous")}
              </Link>
              <span className="px-1 text-[13px] tabular-nums text-[#6b6b6b]">
                {tc("pageOf", { page: guestList.pagination.page, total: guestList.pagination.totalPages })}
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
                {tc("next")}
              </Link>
            </div>
          </div>
        </Card>
        <div className="flex min-w-0 flex-col gap-4">
          <Card id="guest-capture" className="p-6 sm:p-7">
            <CardHeader
              label={t("captureDeskLabel")}
              title={t("captureDeskTitle")}
              description={
                selectedBranch
                  ? t("captureDeskBranch", { name: selectedBranch.name })
                  : canChooseBranch
                    ? t("captureDeskPick")
                    : t("captureDeskCurrent")
              }
            />
            <div className="mt-5">
              <GuestCreateModalButton
                branches={branches}
                users={users}
                serviceTypes={serviceTypes}
                defaultBranchId={selectedBranchId || user.branchId}
                label={t("openDeskForm")}
                className={buttonClass("primary", "md", "w-full")}
              />
            </div>
          </Card>
          <Card className="p-6 sm:p-7">
            <CardHeader label={t("publicIntakeLabel")} title={t("shareLinks")} />
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
                          ? t("guestShareLink", { name: template.branch?.name ?? template.name })
                          : t("shareLink", { name: template.name })
                      }
                    />
                  ))}
                </div>
              ) : (
                <EmptyState icon="templates" title={t("noPublicLinkTitle")}>
                  {canChooseBranch && !selectedBranchId
                    ? t("noPublicLinkChoose")
                    : t("noPublicLinkActivate")}
                </EmptyState>
              )}
            </div>
          </Card>
          <Card className="p-6 sm:p-7">
            <CardHeader label={t("channelsLabel")} title={t("channelsTitle")} />
            <div className="mt-5 space-y-2">
              <a
                href={
                  guestTemplateCards.length > 0 ? publicGuestUrl : "/templates"
                }
                target={guestTemplateCards.length > 0 ? "_blank" : undefined}
                rel={guestTemplateCards.length > 0 ? "noreferrer" : undefined}
                className={channelRowClass}
              >
                <span>{t("publicSelfRegistration")}</span>
                <ChannelHint>{tc("open")}</ChannelHint>
              </a>
              <a
                href={
                  guestTemplateCards.length > 0 ? publicGuestUrl : "/templates"
                }
                target={guestTemplateCards.length > 0 ? "_blank" : undefined}
                rel={guestTemplateCards.length > 0 ? "noreferrer" : undefined}
                className={channelRowClass}
              >
                <span>{t("qrConnectCard")}</span>
                <ChannelHint>{t("share")}</ChannelHint>
              </a>
              <GuestCreateModalButton
                branches={branches}
                users={users}
                serviceTypes={serviceTypes}
                defaultBranchId={selectedBranchId || user.branchId}
                label={t("usherDesk")}
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
                <span>{t("tabletKiosk")}</span>
                <ChannelHint>{t("launch")}</ChannelHint>
              </a>
            </div>
          </Card>
          <Card className="p-6 sm:p-7">
            <CardHeader label={t("dataQuality")} title={t("completeGuestCards")} />
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
                {t("completionCaption")}
              </p>
            </div>
          </Card>
          <GuestDuplicatePanel groups={duplicateGroups} />
        </div>
      </section>
    </Shell>
  );
}
