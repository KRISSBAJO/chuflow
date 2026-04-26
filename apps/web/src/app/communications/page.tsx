import Link from "next/link";
import { CommunicationTemplateManagementCard } from "@/components/communication-template-management-card";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
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

  return (
    <Shell>
      <PageHeader
        eyebrow="Communications"
        title="Template control and message history"
        description="Keep shared message templates tidy and review outreach across the scope you can supervise."
      />

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="surface rounded-[32px] p-8">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">History</p>
                <h2 className="mt-2 text-3xl font-semibold text-slate-950">
                  Outreach timeline
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Search, filter, and review messages without jumping across guest and member records.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Total
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {history.summary.total}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Email / SMS
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {history.summary.email} / {history.summary.sms}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Sent / Preview / Failed
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {history.summary.sent} / {history.summary.preview} / {history.summary.failed}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    System / Manual
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {history.summary.systemEmail} / {history.summary.manualSms + history.summary.manualCall}
                  </p>
                </div>
              </div>
            </div>

            <form
              className="grid gap-3 rounded-[28px] border border-slate-200 bg-white p-5 md:grid-cols-2 xl:grid-cols-6"
              method="GET"
            >
              <input
                name="search"
                defaultValue={search || ""}
                placeholder="Search recipient, subject, or message"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none xl:col-span-2"
              />

              {canFilterAcrossBranches(user.role) ? (
                <select
                  name="branchId"
                  defaultValue={branchId || ""}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                >
                  <option value="">All branches</option>
                  {branches.map((branch) => (
                    <option key={branch._id} value={branch._id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              ) : null}

              <select
                name="channel"
                defaultValue={channel || ""}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
              >
                <option value="">All channels</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="phone_call">Phone call</option>
              </select>

              <select
                name="status"
                defaultValue={status || ""}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
              >
                <option value="">All statuses</option>
                <option value="sent">Sent</option>
                <option value="preview">Preview</option>
                <option value="queued">Queued</option>
                <option value="failed">Failed</option>
              </select>

              <select
                name="deliveryMode"
                defaultValue={deliveryMode || ""}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
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
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
              >
                <option value="">All templates</option>
                {templates.map((template) => (
                  <option key={template._id} value={template.key}>
                    {template.name}
                  </option>
                ))}
              </select>

              <div className="flex items-center justify-end gap-3 xl:col-span-6">
                <Link
                  href="/communications"
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600"
                >
                  Reset
                </Link>
                <button
                  type="submit"
                  className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
                >
                  Apply filters
                </button>
              </div>
            </form>

            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
              <div className="grid grid-cols-[1.1fr_1fr_1fr_0.9fr_0.9fr] gap-4 border-b border-slate-200 px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                <span>Recipient</span>
                <span>Template + sender</span>
                <span>Branch</span>
                <span>Tracking</span>
                <span>When</span>
              </div>

              {history.items.length === 0 ? (
                <div className="px-5 py-10 text-sm text-slate-500">
                  No communications match the current filters.
                </div>
              ) : (
                history.items.map((item) => (
                  <div
                    key={item._id}
                    className="grid grid-cols-[1.1fr_1fr_1fr_0.9fr_0.9fr] gap-4 border-b border-slate-100 px-5 py-4 text-sm text-slate-700 last:border-b-0"
                  >
                    <div>
                      <p className="font-semibold text-slate-950">{item.recipient}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.subject || item.message.slice(0, 80)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{item.templateName}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.channel} · {getCommunicationSender(item)}
                      </p>
                    </div>
                    <div className="text-slate-600">{getCommunicationBranch(item)}</div>
                    <div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {item.status}
                      </span>
                      <p className="mt-2 text-xs text-slate-500">
                        {formatDeliveryMode(item.deliveryMode)}
                      </p>
                      {item.errorMessage ? (
                        <p className="mt-1 text-xs text-rose-600">{item.errorMessage}</p>
                      ) : item.previewUrl ? (
                        <p className="mt-1 text-xs text-amber-600">Preview mode</p>
                      ) : null}
                    </div>
                    <div className="text-xs text-slate-500">
                      {item.deliveredAt
                        ? new Date(item.deliveredAt).toLocaleString()
                        : item.createdAt
                          ? new Date(item.createdAt).toLocaleString()
                          : "No timestamp"}
                      {item.externalMessageId ? (
                        <p className="mt-1 text-[11px] text-slate-400">
                          Ref: {item.externalMessageId}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between gap-4 text-sm text-slate-500">
              <p>
                Showing{" "}
                {history.pagination.total === 0
                  ? 0
                  : (history.pagination.page - 1) * history.pagination.pageSize + 1}
                -
                {Math.min(
                  history.pagination.page * history.pagination.pageSize,
                  history.pagination.total,
                )}{" "}
                of {history.pagination.total}
              </p>
              <div className="flex items-center gap-3">
                <Link
                  href={`/communications${buildQueryString(resolvedSearchParams, {
                    page: Math.max(history.pagination.page - 1, 1),
                  })}`}
                  className={`rounded-2xl border px-4 py-2 text-sm font-semibold ${
                    history.pagination.page <= 1
                      ? "pointer-events-none border-slate-100 text-slate-300"
                      : "border-slate-200 text-slate-700"
                  }`}
                >
                  Previous
                </Link>
                <span>
                  Page {history.pagination.page} of {history.pagination.totalPages}
                </span>
                <Link
                  href={`/communications${buildQueryString(resolvedSearchParams, {
                    page: Math.min(
                      history.pagination.page + 1,
                      history.pagination.totalPages,
                    ),
                  })}`}
                  className={`rounded-2xl border px-4 py-2 text-sm font-semibold ${
                    history.pagination.page >= history.pagination.totalPages
                      ? "pointer-events-none border-slate-100 text-slate-300"
                      : "border-slate-200 text-slate-700"
                  }`}
                >
                  Next
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className="surface rounded-[32px] p-2">
          <CommunicationTemplateManagementCard
            templates={templates}
            canManage={canManageCommunicationTemplates(user.role)}
          />
        </div>
      </section>
    </Shell>
  );
}
