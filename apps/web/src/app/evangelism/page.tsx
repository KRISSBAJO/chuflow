import { FilterPanel } from "@/components/filter-panel";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import {
  Badge,
  buttonClass,
  Card,
  EmptyState,
  Pagination,
  TableWrap,
} from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import {
  isOutreachLabelValue,
  OUTREACH_STAGES,
  outreachName,
  type OutreachList,
} from "@/lib/evangelism";
import type { BranchSummary } from "@/lib/types";

export default async function EvangelismPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireServerRole("/evangelism");
  const [t, tLabels, tc, tsh, format] = await Promise.all([
    getTranslations("people.evangelism.list"),
    getTranslations("people.evangelism.labels"),
    getTranslations("common"),
    getTranslations("people.shared"),
    getFormatter(),
  ]);
  const label = (value: string) => (isOutreachLabelValue(value) ? tLabels(value) : value);
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["branchId", "search", "queue", "stage", "page"])
    if (params[key]) query.set(key, params[key]);
  const [data, branches] = await Promise.all([
    serverGet<OutreachList>(`/evangelism/contacts?${query}`),
    serverGet<BranchSummary[]>("/evangelism/branches"),
  ]);
  function pageHref(page: number) {
    const next = new URLSearchParams(query);
    next.set("page", String(page));
    return `/evangelism?${next}`;
  }
  return (
    <Shell>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/evangelism/links" className={buttonClass("secondary")}>
              {t("shareableLinks")}
            </Link>
            <Link href="/evangelism/new" className={buttonClass("primary")}>
              {t("addContact")}
            </Link>
          </div>
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t("peopleReached")}
          value={String(data.summary.all)}
          delta={t("peopleReachedCaption")}
        />
        <MetricCard
          label={t("newContacts")}
          value={String(data.summary.fresh)}
          delta={t("newContactsCaption")}
          tone="warm"
        />
        <MetricCard
          label={tsh("unassigned")}
          value={String(data.summary.unassigned)}
          delta={t("unassignedCaption")}
          tone="warm"
        />
        <MetricCard
          label={t("overdue")}
          value={String(data.summary.overdue)}
          delta={t("overdueCaption")}
          tone="warm"
        />
      </section>
      <Card className="p-5 sm:p-7">
        <h2 className="text-lg font-semibold">
          {t("journeyTitle")}
        </h2>
        <p className="mt-1 text-sm text-[#6b6b6b]">
          {t("journeyDescription")}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {OUTREACH_STAGES.map(([key]) => (
            <div key={key} className="rounded-xl bg-white p-4">
              <p className="text-xs text-[#8a8780]">{tLabels(key)}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {data.stages[key] || 0}
              </p>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-5 sm:p-7">
        <FilterPanel><form
          action="/evangelism"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]"
        >
          <label className="text-xs text-[#6b6b6b]">
            {tc("search")}
            <input
              name="search"
              defaultValue={params.search}
              placeholder={t("searchPlaceholder")}
              className="ui-input mt-1"
              maxLength={100}
            />
          </label>
          <label className="text-xs text-[#6b6b6b]">
            {tc("branch")}
            <select
              name="branchId"
              defaultValue={params.branchId || ""}
              className="ui-input mt-1"
            >
              <option value="">{t("allAccessibleBranches")}</option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-[#6b6b6b]">
            {t("progress")}
            <select
              name="stage"
              defaultValue={params.stage || ""}
              className="ui-input mt-1"
            >
              <option value="">{tsh("allStages")}</option>
              {OUTREACH_STAGES.map(([key]) => (
                <option key={key} value={key}>
                  {tLabels(key)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-[#6b6b6b]">
            {t("queue")}
            <select
              name="queue"
              defaultValue={params.queue || ""}
              className="ui-input mt-1"
            >
              <option value="">{t("allContacts")}</option>
              <option value="mine">{t("assignedToMe")}</option>
              <option value="unassigned">{tsh("unassigned")}</option>
              <option value="overdue">{t("queueOverdue")}</option>
            </select>
          </label>
          <button
            type="submit"
            className={buttonClass("primary", "md", "self-end")}
          >
            {tc("apply")}
          </button>
        </form></FilterPanel>
        <div className="mt-6">
          {data.items.length ? (
            <TableWrap>
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>{t("person")}</th>
                    <th>{tc("branch")}</th>
                    <th>{t("progress")}</th>
                    <th>{t("followUpOwner")}</th>
                    <th>{t("nextAction")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((contact) => {
                    const overdue = contact.isOverdue;
                    return (
                      <tr key={contact._id}>
                        <td>
                          <Link
                            href={`/evangelism/${contact._id}`}
                            className="font-medium underline-offset-4 hover:underline"
                          >
                            {contact.firstName} {contact.lastName}
                          </Link>
                          <p className="mt-1 text-xs text-[#8a8780]">
                            {contact.phone}
                          </p>
                        </td>
                        <td>{contact.branchId?.name}</td>
                        <td>
                          <Badge
                            tone={
                              contact.stage === "do_not_contact"
                                ? "warning"
                                : "neutral"
                            }
                          >
                            {label(contact.stage)}
                          </Badge>
                        </td>
                        <td>{outreachName(contact.assignedTo, tsh("unassigned"))}</td>
                        <td>
                          <span className={overdue ? "text-red-700" : ""}>
                            {contact.nextActionDate
                              ? format.dateTime(new Date(contact.nextActionDate), {
                                  timeZone: "UTC",
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : t("notScheduled")}
                            {overdue ? ` · ${t("overdueTag")}` : ""}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          ) : (
            <EmptyState icon="care" title={t("emptyTitle")}>
              {t("emptyBody")}
            </EmptyState>
          )}
        </div>
        <p className="mt-5 text-xs text-[#8a8780]">
          {t("matching", { count: data.total })}
        </p>
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          prevHref={pageHref(Math.max(1, data.page - 1))}
          nextHref={pageHref(Math.min(data.totalPages, data.page + 1))}
        />
      </Card>
    </Shell>
  );
}
