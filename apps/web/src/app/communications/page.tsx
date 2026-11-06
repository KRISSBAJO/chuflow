import { FilterPanel } from "@/components/filter-panel";
import { getFormatter, getTranslations } from "next-intl/server";
import { CommunicationTemplateManagementCard } from "@/components/communication-template-management-card";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import {
  Badge,
  type BadgeTone,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  Pagination,
  Stat,
  statusTone,
  TableWrap,
} from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import {
  canFilterAcrossBranches,
  canManageCommunicationTemplates,
} from "@/lib/permissions";
import { serverGet } from "@/lib/server-api";
import type {
  BranchSummary,
  CommunicationHistoryResponse,
  CommunicationItem,
  CommunicationTemplateItem,
} from "@/lib/types";

function buildQueryString(
  searchParams: Record<string, string | string[] | undefined>,
  overrides: Record<string, string | number | undefined>,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string" && value) {
      params.set(key, value);
    }
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === "") {
      params.delete(key);
      continue;
    }

    params.set(key, String(value));
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

function getCommunicationBranch(item: CommunicationItem, fallback: string) {
  const directBranch = item.branchId;
  if (directBranch?.name) {
    return directBranch.name;
  }

  const guestBranch =
    item.guestId?.branchId && typeof item.guestId.branchId === "object"
      ? item.guestId.branchId
      : undefined;
  const memberBranch =
    item.memberId?.branchId && typeof item.memberId.branchId === "object"
      ? item.memberId.branchId
      : undefined;

  return guestBranch?.name || memberBranch?.name || fallback;
}

function getCommunicationSender(item: CommunicationItem, fallback: string) {
  if (item.sentBy?.firstName || item.sentBy?.lastName) {
    return `${item.sentBy?.firstName ?? ""} ${item.sentBy?.lastName ?? ""}`.trim();
  }

  return item.sentBy?.email || fallback;
}

function communicationTone(status?: string): BadgeTone {
  if (status === "sent") return "success";
  if (status === "preview") return "warning";
  if (status === "queued") return "info";
  return statusTone(status);
}

export default async function CommunicationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireServerRole("/communications");
  const t = await getTranslations("admin.communications");
  const tc = await getTranslations("common");
  const ts = await getTranslations("statuses");
  const format = await getFormatter();
  type StatusKey = Parameters<typeof ts>[0];
  const statusLabel = (value?: string | null) => {
    if (!value) return "";
    const key = value.toLowerCase() as StatusKey;
    if (ts.has(key)) return ts(key);
    const text = value.replace(/_/g, " ").toLowerCase();
    return text.charAt(0).toUpperCase() + text.slice(1);
  };
  const formatDeliveryMode = (mode?: string) => {
    switch (mode) {
      case "system_email":
      case "preview_email":
      case "manual_sms":
      case "manual_call":
        return t(`deliveryModes.${mode}`);
      default:
        return t("deliveryModes.tracked");
    }
  };
  const formatChannel = (channel?: string) => {
    switch (channel) {
      case "email":
      case "sms":
      case "phone_call":
        return t(`channels.${channel}`);
      default:
        return statusLabel(channel);
    }
  };
  const resolvedSearchParams = (await searchParams) ?? {};
  const page = Number(
    typeof resolvedSearchParams.page === "string" ? resolvedSearchParams.page : "1",
  );
  const branchId =
    typeof resolvedSearchParams.branchId === "string"
      ? resolvedSearchParams.branchId
      : undefined;
  const channel =
    typeof resolvedSearchParams.channel === "string"
      ? resolvedSearchParams.channel
      : undefined;
  const status =
    typeof resolvedSearchParams.status === "string"
      ? resolvedSearchParams.status
      : undefined;
  const templateName =
    typeof resolvedSearchParams.templateName === "string"
      ? resolvedSearchParams.templateName
      : undefined;
  const deliveryMode =
    typeof resolvedSearchParams.deliveryMode === "string"
      ? resolvedSearchParams.deliveryMode
      : undefined;
  const search =
    typeof resolvedSearchParams.search === "string"
      ? resolvedSearchParams.search
      : undefined;

  const [templates, branches, history] = await Promise.all([
    serverGet<CommunicationTemplateItem[]>("/communications/templates").catch(() => []),
    canFilterAcrossBranches(user.role, user.hasOversight)
      ? serverGet<BranchSummary[]>("/branches").catch(() => [])
      : Promise.resolve([]),
    serverGet<CommunicationHistoryResponse>(
      `/communications/history${buildQueryString(resolvedSearchParams, {
        page: Number.isNaN(page) ? 1 : page,
        limit: 12,
      })}`,
    ).catch(() => ({
      items: [],
      pagination: { page: 1, pageSize: 12, total: 0, totalPages: 1 },
      summary: {
        total: 0,
        email: 0,
        sms: 0,
        phoneCall: 0,
        sent: 0,
        preview: 0,
        queued: 0,
        failed: 0,
        systemEmail: 0,
        previewEmail: 0,
        manualSms: 0,
        manualCall: 0,
      },
    })),
  ]);


  const canFilterBranches = canFilterAcrossBranches(user.role, user.hasOversight);
  const startItem =
    history.pagination.total === 0
      ? 0
      : (history.pagination.page - 1) * history.pagination.pageSize + 1;
  const endItem = Math.min(
    history.pagination.page * history.pagination.pageSize,
    history.pagination.total,
  );

  return (
    <Shell>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
        <Card className="app-rise min-w-0 p-6 sm:p-7">
          <CardHeader
            label={t("historyLabel")}
            title={t("historyTitle")}
            description={t("historyDescription")}
          />

          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={t("stats.total")} value={history.summary.total} />
            <Stat
              label={t("stats.emailSms")}
              value={`${history.summary.email} / ${history.summary.sms}`}
            />
            <Stat
              label={t("stats.sentPreviewFailed")}
              value={`${history.summary.sent} / ${history.summary.preview} / ${history.summary.failed}`}
            />
            <Stat
              label={t("stats.systemManual")}
              value={`${history.summary.systemEmail} / ${history.summary.manualSms + history.summary.manualCall}`}
            />
          </div>

          <FilterPanel><form
            className="mt-6 grid gap-2 rounded-2xl bg-[#f6f5f1] p-3 sm:grid-cols-2 xl:grid-cols-3"
            method="GET"
          >
            <input
              name="search"
              defaultValue={search || ""}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchAria")}
              className="ui-input sm:col-span-2 xl:col-span-3"
            />

            {canFilterBranches ? (
              <select
                name="branchId"
                defaultValue={branchId || ""}
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

            <select name="channel" defaultValue={channel || ""} aria-label={t("channel")} className="ui-input">
              <option value="">{t("allChannels")}</option>
              <option value="email">{t("channels.email")}</option>
              <option value="sms">{t("channels.sms")}</option>
              <option value="phone_call">{t("channels.phone_call")}</option>
            </select>

            <select name="status" defaultValue={status || ""} aria-label={tc("status")} className="ui-input">
              <option value="">{t("allStatuses")}</option>
              <option value="sent">{t("statuses.sent")}</option>
              <option value="preview">{t("statuses.preview")}</option>
              <option value="queued">{t("statuses.queued")}</option>
              <option value="failed">{t("statuses.failed")}</option>
            </select>

            <select
              name="deliveryMode"
              defaultValue={deliveryMode || ""}
              aria-label={t("deliveryMode")}
              className="ui-input"
            >
              <option value="">{t("allDeliveryModes")}</option>
              <option value="system_email">{t("deliveryModes.system_email")}</option>
              <option value="preview_email">{t("deliveryModes.preview_email")}</option>
              <option value="manual_sms">{t("deliveryModes.manual_sms")}</option>
              <option value="manual_call">{t("deliveryModes.manual_call")}</option>
            </select>

            <select
              name="templateName"
              defaultValue={templateName || ""}
              aria-label={t("template")}
              className="ui-input"
            >
              <option value="">{t("allTemplates")}</option>
              {templates.map((template) => (
                <option key={template._id} value={template.key}>
                  {template.name}
                </option>
              ))}
            </select>

            <div className="flex items-center justify-end gap-2 sm:col-span-2 xl:col-span-3">
              <ButtonLink href="/communications" variant="ghost">
                {tc("reset")}
              </ButtonLink>
              <Button type="submit" icon="search">
                {t("applyFilters")}
              </Button>
            </div>
          </form></FilterPanel>

          <div className="mt-6">
            {history.items.length === 0 ? (
              <EmptyState icon="message" title={t("emptyTitle")}>
                {t("emptyBody")}
              </EmptyState>
            ) : (
              <TableWrap>
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>{t("headers.recipient")}</th>
                      <th>{t("headers.templateSender")}</th>
                      <th>{t("headers.branch")}</th>
                      <th>{t("headers.tracking")}</th>
                      <th>{t("headers.when")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.items.map((item) => (
                      <tr key={item._id} className="align-top">
                        <td className="min-w-[180px]">
                          <p className="font-medium text-[#111111]">{item.recipient}</p>
                          <p className="mt-0.5 text-[12px] leading-[1.5] text-[#8a8780]">
                            {item.subject || item.message.slice(0, 80)}
                          </p>
                        </td>
                        <td className="min-w-[160px]">
                          <p className="text-[#111111]">{item.templateName}</p>
                          <p className="mt-0.5 text-[12px] text-[#8a8780]">
                            {formatChannel(item.channel)} · {getCommunicationSender(item, t("systemRecord"))}
                          </p>
                        </td>
                        <td className="!text-[#55534e]">{getCommunicationBranch(item, t("scopedRecord"))}</td>
                        <td>
                          <Badge tone={communicationTone(item.status)} dot>
                            {statusLabel(item.status)}
                          </Badge>
                          <p className="mt-1.5 text-[12px] text-[#8a8780]">
                            {formatDeliveryMode(item.deliveryMode)}
                          </p>
                          {item.errorMessage ? (
                            <p className="mt-1 text-[12px] text-red-700">{item.errorMessage}</p>
                          ) : item.previewUrl ? (
                            <p className="mt-1 text-[12px] text-amber-700">{t("previewMode")}</p>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap text-[13px] !text-[#55534e]">
                          {item.deliveredAt
                            ? format.dateTime(new Date(item.deliveredAt), { dateStyle: "medium", timeStyle: "short" })
                            : item.createdAt
                              ? format.dateTime(new Date(item.createdAt), { dateStyle: "medium", timeStyle: "short" })
                              : t("noTimestamp")}
                          {item.externalMessageId ? (
                            <p className="mt-0.5 text-[11px] text-[#8a8780]">
                              {t("ref", { id: item.externalMessageId })}
                            </p>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-2 border-t border-black/[0.06] pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-[#8a8780]">
              {t.rich("showing", {
                start: startItem,
                end: endItem,
                total: history.pagination.total,
                range: (chunks) => <span className="tabular-nums text-[#111111]">{chunks}</span>,
                sum: (chunks) => <span className="tabular-nums">{chunks}</span>,
              })}
            </p>
            <Pagination
              page={history.pagination.page}
              totalPages={history.pagination.totalPages}
              prevHref={`/communications${buildQueryString(resolvedSearchParams, {
                page: Math.max(history.pagination.page - 1, 1),
              })}`}
              nextHref={`/communications${buildQueryString(resolvedSearchParams, {
                page: Math.min(history.pagination.page + 1, history.pagination.totalPages),
              })}`}
            />
          </div>
        </Card>

        <Card className="app-rise min-w-0 self-start p-6 sm:p-7" style={{ animationDelay: "60ms" }}>
          <CommunicationTemplateManagementCard
            templates={templates}
            canManage={canManageCommunicationTemplates(user.role)}
          />
        </Card>
      </section>
    </Shell>
  );
}
