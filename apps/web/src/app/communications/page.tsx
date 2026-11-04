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
  formatStatus,
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

function getCommunicationBranch(item: CommunicationItem) {
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

  return guestBranch?.name || memberBranch?.name || "Scoped record";
}

function getCommunicationSender(item: CommunicationItem) {
  if (item.sentBy?.firstName || item.sentBy?.lastName) {
    return `${item.sentBy?.firstName ?? ""} ${item.sentBy?.lastName ?? ""}`.trim();
  }

  return item.sentBy?.email || "System record";
}

function formatDeliveryMode(mode?: string) {
  switch (mode) {
    case "system_email":
      return "System email";
    case "preview_email":
      return "Preview email";
    case "manual_sms":
      return "Manual SMS";
    case "manual_call":
      return "Manual call";
    default:
      return "Tracked send";
  }
}

function formatChannel(channel?: string) {
  switch (channel) {
    case "email":
      return "Email";
    case "sms":
      return "SMS";
    case "phone_call":
      return "Phone call";
    default:
      return formatStatus(channel);
  }
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
    canFilterAcrossBranches(user.role)
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


  const canFilterBranches = canFilterAcrossBranches(user.role);
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
        eyebrow="Communications"
        title="Templates and message history"
        description="Keep shared message templates tidy and review outreach across the scope you supervise."
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
        <Card className="app-rise min-w-0 p-6 sm:p-7">
          <CardHeader
            label="History"
            title="Outreach timeline"
            description="Search, filter and review messages without jumping between guest and member records."
          />

          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Total" value={history.summary.total} />
            <Stat
              label="Email / SMS"
              value={`${history.summary.email} / ${history.summary.sms}`}
            />
            <Stat
              label="Sent / preview / failed"
              value={`${history.summary.sent} / ${history.summary.preview} / ${history.summary.failed}`}
            />
            <Stat
              label="System / manual"
              value={`${history.summary.systemEmail} / ${history.summary.manualSms + history.summary.manualCall}`}
            />
          </div>

          <form
            className="mt-6 grid gap-2 rounded-2xl bg-[#f6f5f1] p-3 sm:grid-cols-2 xl:grid-cols-3"
            method="GET"
          >
            <input
              name="search"
              defaultValue={search || ""}
              placeholder="Search recipient, subject or message"
              aria-label="Search communications"
              className="ui-input sm:col-span-2 xl:col-span-3"
            />

            {canFilterBranches ? (
              <select
                name="branchId"
                defaultValue={branchId || ""}
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

            <select name="channel" defaultValue={channel || ""} aria-label="Channel" className="ui-input">
              <option value="">All channels</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="phone_call">Phone call</option>
            </select>

            <select name="status" defaultValue={status || ""} aria-label="Status" className="ui-input">
              <option value="">All statuses</option>
              <option value="sent">Sent</option>
              <option value="preview">Preview</option>
              <option value="queued">Queued</option>
              <option value="failed">Failed</option>
            </select>

            <select
              name="deliveryMode"
              defaultValue={deliveryMode || ""}
              aria-label="Delivery mode"
              className="ui-input"
            >
              <option value="">All delivery modes</option>
              <option value="system_email">System email</option>
              <option value="preview_email">Preview email</option>
              <option value="manual_sms">Manual SMS</option>
              <option value="manual_call">Manual call</option>
            </select>

            <select
              name="templateName"
              defaultValue={templateName || ""}
              aria-label="Template"
              className="ui-input"
            >
              <option value="">All templates</option>
              {templates.map((template) => (
                <option key={template._id} value={template.key}>
                  {template.name}
                </option>
              ))}
            </select>

            <div className="flex items-center justify-end gap-2 sm:col-span-2 xl:col-span-3">
              <ButtonLink href="/communications" variant="ghost">
                Reset
              </ButtonLink>
              <Button type="submit" icon="search">
                Apply filters
              </Button>
            </div>
          </form>

          <div className="mt-6">
            {history.items.length === 0 ? (
              <EmptyState icon="message" title="No messages found">
                No communications match the current filters.
              </EmptyState>
            ) : (
              <TableWrap>
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>Recipient</th>
                      <th>Template and sender</th>
                      <th>Branch</th>
                      <th>Tracking</th>
                      <th>When</th>
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
                            {formatChannel(item.channel)} · {getCommunicationSender(item)}
                          </p>
                        </td>
                        <td className="!text-[#55534e]">{getCommunicationBranch(item)}</td>
                        <td>
                          <Badge tone={communicationTone(item.status)} dot>
                            {formatStatus(item.status)}
                          </Badge>
                          <p className="mt-1.5 text-[12px] text-[#8a8780]">
                            {formatDeliveryMode(item.deliveryMode)}
                          </p>
                          {item.errorMessage ? (
                            <p className="mt-1 text-[12px] text-red-700">{item.errorMessage}</p>
                          ) : item.previewUrl ? (
                            <p className="mt-1 text-[12px] text-amber-700">Preview mode</p>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap text-[13px] !text-[#55534e]">
                          {item.deliveredAt
                            ? new Date(item.deliveredAt).toLocaleString()
                            : item.createdAt
                              ? new Date(item.createdAt).toLocaleString()
                              : "No timestamp"}
                          {item.externalMessageId ? (
                            <p className="mt-0.5 text-[11px] text-[#8a8780]">
                              Ref: {item.externalMessageId}
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
              Showing <span className="tabular-nums text-[#111111]">{startItem}–{endItem}</span> of{" "}
              <span className="tabular-nums">{history.pagination.total}</span>
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
