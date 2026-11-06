import { FilterPanel } from "@/components/filter-panel";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
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
  FOLLOW_UP_CONTACT_METHOD_VALUES,
  FOLLOW_UP_STATUS_OPTIONS,
  formatFollowUpValue,
} from "@/lib/follow-up-options";
import { formatStatus } from "@/components/ui/ui";
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
  const [t, tc, ts, tsh, tOptions, format] = await Promise.all([
    getTranslations("people.followUp.list"),
    getTranslations("common"),
    getTranslations("statuses"),
    getTranslations("people.shared"),
    getTranslations("people.followUpOptions"),
    getFormatter(),
  ]);
  type StatusKey = Parameters<typeof ts>[0];
  const statusLabel = (value?: string | null) => {
    if (!value) return tOptions("notSet");
    const key = value.toLowerCase();
    return ts.has(key as StatusKey) ? ts(key as StatusKey) : formatStatus(value);
  };
  type MethodKey = (typeof FOLLOW_UP_CONTACT_METHOD_VALUES)[number];
  const methodLabel = (value?: string | null) =>
    value && (FOLLOW_UP_CONTACT_METHOD_VALUES as readonly string[]).includes(value)
      ? tOptions(`methods.${value as MethodKey}`)
      : formatFollowUpValue(value);
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
    ? t("scopeBranch", { name: selectedBranch.name })
    : canChooseBranch
      ? requestedDistrict
        ? t("scopeDistrict", { name: requestedDistrict })
        : requestedOversightRegion
          ? t("scopeNational", { name: requestedOversightRegion })
          : t("allVisibleBranches")
      : t("currentBranch");
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
    { label: ts("prayed_with"), value: followUpList.summary.prayedWith },
    { label: ts("invited_back"), value: followUpList.summary.invitedBack },
    { label: ts("converted"), value: followUpList.summary.converted },
  ];

  return (
    <Shell>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        action={<div className="flex flex-wrap gap-2"><Link href="/care" className={buttonClass("secondary")}>{t("careHub")}</Link>
          <a href={buildCreateHref()} className={buttonClass("primary")}>
            <Icon name="plus" className="h-4 w-4" />
            {t("addFollowUp")}
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
          label={ts("new")}
          value={followUpList.summary.new}
          delta={t("newCaption")}
          tone="warm"
        />
        <MetricCard
          label={ts("assigned")}
          value={followUpList.summary.assigned}
          delta={t("assignedCaption")}
          tone="cool"
        />
        <MetricCard
          label={ts("contacted")}
          value={followUpList.summary.contacted}
          delta={t("contactedCaption")}
          tone="cool"
        />
        <MetricCard
          label={ts("returned")}
          value={followUpList.summary.returned}
          delta={t("returnedCaption")}
          tone="warm"
        />
      </section>

      <Card className="app-rise p-6 sm:p-7">
        <CardHeader
          label={t("queueLabel")}
          title={t("queueTitle")}
          description={t("queueDescription", { scope: scopeLabel })}
          action={secondaryStages.map((stage) => (
            <Badge key={stage.label}>
              {stage.label} <span className="tabular-nums">{stage.value}</span>
            </Badge>
          ))}
        />

        <FilterPanel><form className="mt-6 grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
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
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchAria")}
            className="ui-input"
          />
          <select name="status" defaultValue={selectedStatus || ""} aria-label={tsh("stage")} className="ui-input">
            <option value="">{tsh("allStages")}</option>
            {FOLLOW_UP_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {ts(option.value)}
              </option>
            ))}
          </select>
          <input type="hidden" name="page" value="1" />
          <Button type="submit" variant="secondary" icon="search">
            {tc("apply")}
          </Button>
        </form></FilterPanel>

        <div className="mt-6">
          {followUpList.items.length > 0 ? (
            <TableWrap>
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>{tsh("stage")}</th>
                    <th>{t("guest")}</th>
                    <th>{t("owner")}</th>
                    <th>{t("nextAction")}</th>
                    <th>{t("method")}</th>
                    <th>{t("note")}</th>
                    <th className="text-right">
                      <span className="sr-only">{tc("open")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {followUpList.items.map((item) => {
                    const guestName = item.guestId
                      ? `${item.guestId.firstName} ${item.guestId.lastName}`
                      : t("guestUnavailable");
                    const branchName = item.guestId?.branchId?.name;
                    const assignedName = item.assignedTo
                      ? `${item.assignedTo.firstName} ${item.assignedTo.lastName}`
                      : tsh("unassigned");

                    return (
                      <tr key={item._id} className="align-top">
                        <td>
                          <Badge tone={statusTone(item.status)} dot>
                            {statusLabel(item.status)}
                          </Badge>
                        </td>
                        <td>
                          <p className="font-medium text-[#111111]">{guestName}</p>
                          <p className="mt-0.5 text-[12px] text-[#8a8780]">{branchName || tc("branch")}</p>
                        </td>
                        <td className="whitespace-nowrap !text-[#55534e]">{assignedName}</td>
                        <td className="!text-[#55534e]">
                          {item.nextActionDate
                            ? format.dateTime(new Date(item.nextActionDate), { dateStyle: "short", timeStyle: "short" })
                            : t("noNextAction")}
                          <span className="mt-0.5 block text-[12px] text-[#8a8780]">
                            {t("updated", { when: item.updatedAt ? format.dateTime(new Date(item.updatedAt), { dateStyle: "short" }) : t("recently") })}
                          </span>
                        </td>
                        <td className="whitespace-nowrap !text-[#55534e]">{methodLabel(item.contactMethod)}</td>
                        <td className="max-w-md text-[13px] leading-[1.6] !text-[#6b6b6b]">{item.note}</td>
                        <td className="text-right">
                          {item.guestId?._id ? (
                            <Link
                              href={`/guests/${item.guestId._id}`}
                              aria-label={t("openGuest", { name: guestName })}
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
            <EmptyState icon="care" title={t("noneTitle")}>
              {t("noneBody")}
            </EmptyState>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-2 border-t border-black/[0.06] pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-[#8a8780]">
            {tsh.rich("showing", {
              from: startItem,
              to: endItem,
              total: followUpList.pagination.total,
              range: (chunks) => <span className="tabular-nums text-[#111111]">{chunks}</span>,
              count: (chunks) => <span className="tabular-nums">{chunks}</span>,
            })}
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
