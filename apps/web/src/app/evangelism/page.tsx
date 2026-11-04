import Link from "next/link";
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
  OUTREACH_STAGES,
  outreachLabel,
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
        eyebrow="Evangelism"
        title="Every conversation can become a journey."
        description="Welcome people reached through outreach, take ownership of their care, and follow through on the next step."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/evangelism/links" className={buttonClass("secondary")}>
              Shareable links
            </Link>
            <Link href="/evangelism/new" className={buttonClass("primary")}>
              + Add contact
            </Link>
          </div>
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="People reached"
          value={String(data.summary.all)}
          delta="Outreach contacts in your branch scope"
        />
        <MetricCard
          label="New contacts"
          value={String(data.summary.fresh)}
          delta="Waiting for their first conversation"
          tone="warm"
        />
        <MetricCard
          label="Unassigned"
          value={String(data.summary.unassigned)}
          delta="Choose someone to own the next step"
          tone="warm"
        />
        <MetricCard
          label="Follow-up overdue"
          value={String(data.summary.overdue)}
          delta="Scheduled actions that need attention"
          tone="warm"
        />
      </section>
      <Card className="p-5 sm:p-7">
        <h2 className="text-lg font-semibold">
          Where people are in their journey
        </h2>
        <p className="mt-1 text-sm text-[#6b6b6b]">
          Current stages across the selected branch scope.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {OUTREACH_STAGES.map(([key, label]) => (
            <div key={key} className="rounded-xl bg-white p-4">
              <p className="text-xs text-[#8a8780]">{label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {data.stages[key] || 0}
              </p>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-5 sm:p-7">
        <form
          action="/evangelism"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]"
        >
          <label className="text-xs text-[#6b6b6b]">
            Search
            <input
              name="search"
              defaultValue={params.search}
              placeholder="Name, phone or email"
              className="ui-input mt-1"
              maxLength={100}
            />
          </label>
          <label className="text-xs text-[#6b6b6b]">
            Branch
            <select
              name="branchId"
              defaultValue={params.branchId || ""}
              className="ui-input mt-1"
            >
              <option value="">All accessible branches</option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-[#6b6b6b]">
            Progress
            <select
              name="stage"
              defaultValue={params.stage || ""}
              className="ui-input mt-1"
            >
              <option value="">All stages</option>
              {OUTREACH_STAGES.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-[#6b6b6b]">
            Queue
            <select
              name="queue"
              defaultValue={params.queue || ""}
              className="ui-input mt-1"
            >
              <option value="">All contacts</option>
              <option value="mine">Assigned to me</option>
              <option value="unassigned">Unassigned</option>
              <option value="overdue">Overdue</option>
            </select>
          </label>
          <button
            type="submit"
            className={buttonClass("primary", "md", "self-end")}
          >
            Apply
          </button>
        </form>
        <div className="mt-6">
          {data.items.length ? (
            <TableWrap>
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Branch</th>
                    <th>Progress</th>
                    <th>Follow-up owner</th>
                    <th>Next action</th>
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
                            {outreachLabel(contact.stage)}
                          </Badge>
                        </td>
                        <td>{outreachName(contact.assignedTo)}</td>
                        <td>
                          <span className={overdue ? "text-red-700" : ""}>
                            {contact.nextActionDate
                              ? new Date(
                                  contact.nextActionDate,
                                ).toLocaleDateString("en-US", {
                                  timeZone: "UTC",
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "Not scheduled"}
                            {overdue ? " · Overdue" : ""}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          ) : (
            <EmptyState icon="care" title="No outreach contacts here yet">
              Create a link to share during outreach, or add a person who has
              given permission to connect.
            </EmptyState>
          )}
        </div>
        <p className="mt-5 text-xs text-[#8a8780]">
          {data.total} matching contacts. Outreach contacts do not count as
          church attendance.
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
