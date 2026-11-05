import { FilterPanel } from "@/components/filter-panel";
import Link from "next/link";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { Card, buttonClass } from "@/components/ui/ui";
import { Icon } from "@/components/app/icons";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import {
  careLabel,
  type CareRecord,
  type CareOverview,
  type CareOptions,
} from "@/lib/care";
export default async function CareHub({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireServerRole("/care");
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["branchId", "view", "q", "page"])
    if (typeof params[key] === "string" && params[key]?.trim())
      query.set(key, params[key]!);
  const [options, report, list] = await Promise.all([
    serverGet<CareOptions>("/care/options"),
    serverGet<CareOverview>(
      `/care/overview${query.get("branchId") ? "?branchId=" + query.get("branchId") : ""}`,
    ),
    serverGet<{
      items: CareRecord[];
      total: number;
      page: number;
      totalPages: number;
    }>(`/care/cases?${query}`),
  ]);
  const href = (view: string, page = 1) => {
    const q = new URLSearchParams(query);
    q.set("view", view);
    q.set("page", String(page));
    return "/care?" + q;
  };
  return (
    <Shell>
      <PageHeader
        eyebrow="Care & connection"
        title="Make sure care follows through"
        description="One history, a named owner and a clear next step for each person."
        action={
          <div className="flex gap-2">
            <Link className={buttonClass("secondary")} href="/follow-up">
              Guest task records
            </Link>
            {options.isAdmin && (
              <Link className={buttonClass()} href="/care/settings">
                Automation settings
              </Link>
            )}
          </div>
        }
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["People", report.total, "all"],
          ["Need an owner", report.unassigned, "unassigned"],
          ["Overdue tasks", report.overdue, "overdue"],
          ["Participation gaps", report.retention, "retention"],
        ].map(([label, value, view]) => (
          <Link className="app-card p-5" href={href(String(view))} key={label}>
            <p className="text-xs text-[#6b6b6b]">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {value}
            </p>
          </Link>
        ))}
      </section>
      <details className="app-card p-5">
        <summary className="cursor-pointer font-medium">
          Leadership briefing · last 30 days
        </summary>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <ul className="space-y-2 text-sm">
            {report.briefing.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <div className="space-y-2 text-sm">
            <p>{report.cohort.guests} newly recorded guests</p>
            <p>
              {report.cohort.contacted24h} with a care-hub contact recorded
              within 24 hours
            </p>
            <p>
              {report.cohort.returned} with a recorded return visit ·{" "}
              {report.cohort.becameMembers} with linked membership
            </p>
            <p className="text-xs text-[#8a8780]">
              Observed records, not proof that follow-up caused a return. Legacy
              notes are retained without inventing contact dates.
            </p>
          </div>
        </div>
      </details>
      <details className="app-card p-5"><summary className="cursor-pointer font-medium">Guest connection cohorts · last 90 days</summary><div className="mt-4 overflow-x-auto"><table className="ui-table w-full"><thead><tr><th>Registration week</th><th>Guests</th><th>Contact in 24h</th><th>Recorded return within 30d</th><th>Linked membership</th></tr></thead><tbody>{report.cohorts.map(row=><tr key={row._id}><td>{row._id}</td><td>{row.guests}</td><td>{row.contacted24h}</td><td>{row.returned30}</td><td>{row.members}</td></tr>)}</tbody></table><p className="mt-3 text-xs text-[#8a8780]">Recent cohorts have not had a full 30-day observation period. Missing individual contact dates are not counted as successful contacts.</p></div></details>
      <nav
        className="flex gap-1 overflow-x-auto border-b border-black/10"
        aria-label="Care queues"
      >
        {[
          "today",
          "mine",
          "unassigned",
          "overdue",
          "escalated",
          "retention",
          "all",
        ].map((view) => (
          <Link
            key={view}
            href={href(view)}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm ${(query.get("view") || "all") === view ? "border-[#ed7b19] font-semibold text-[#b94f0a]" : "border-transparent text-[#6b6b6b]"}`}
          >
            {view === "retention" ? "Participation checks" : careLabel(view)}
          </Link>
        ))}
      </nav>
      <Card className="p-5">
        <FilterPanel><form className="flex flex-wrap gap-3">
          <input type="hidden" name="view" value={query.get("view") || "all"} />
          <input
            className="ui-input min-w-48 flex-1"
            aria-label="Search care records"
            name="q"
            defaultValue={query.get("q") || ""}
            placeholder="Search a person by name or email…"
          />
          <select
            className="ui-input max-w-xs"
            aria-label="Branch"
            name="branchId"
            defaultValue={query.get("branchId") || ""}
          >
            <option value="">All accessible branches</option>
            {options.branches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>
          <button className={buttonClass("secondary")}>Search</button>
        </form></FilterPanel>
      </Card>
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm">{list.total} matching people</p>
          <span className="text-xs text-[#8a8780]">
            Sources sync in the background
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="ui-table w-full">
            <thead>
              <tr>
                <th>Person</th>
                <th>Journey</th>
                <th>Owner</th>
                <th>Next action</th>
                <th>Stage</th>
                <th>
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((c) => (
                <tr key={c._id}>
                  <td>
                    <Link className="font-medium" href={"/care/" + c._id}>
                      {c.firstName} {c.lastName}
                    </Link>
                    <p className="text-xs text-[#8a8780]">
                      {typeof c.branchId === "object"
                        ? c.branchId.name
                        : careLabel(c.personType)}
                    </p>
                  </td>
                  <td>{careLabel(c.journey)}</td>
                  <td>
                    {typeof c.ownerId === "object"
                      ? `${c.ownerId.firstName} ${c.ownerId.lastName}`
                      : "Unassigned"}
                  </td>
                  <td>
                    {c.nextTask ? (
                      <>
                        <p>{c.nextTask.title}</p>
                        <p className="text-xs text-[#8a8780]">
                          {new Date(c.nextTask.dueAt).toLocaleDateString(
                            "en-US",
                            { timeZone: "UTC" },
                          )}{" "}
                          UTC{c.nextTask.escalated ? " · Escalated" : ""}
                        </p>
                      </>
                    ) : (
                      "No open task"
                    )}
                  </td>
                  <td>
                    {c.stopContact ? "Contact stopped" : careLabel(c.stage)}
                  </td>
                  <td>
                    <Link
                      href={"/care/" + c._id}
                      aria-label={`Open care for ${c.firstName} ${c.lastName}`}
                      className={buttonClass("ghost", "sm")}
                    >
                      <Icon name="arrowUpRight" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.items.length && (
            <p className="py-8 text-center text-sm text-[#8a8780]">
              No matching care records. Existing people appear as background
              synchronization runs; automation remains off until a branch
              enables it.
            </p>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between text-sm">
          <span>
            Page {list.page} of {list.totalPages}
          </span>
          <div className="flex gap-2">
            {list.page > 1 && (
              <Link
                className={buttonClass("secondary", "sm")}
                href={href(query.get("view") || "all", list.page - 1)}
              >
                Previous
              </Link>
            )}
            {list.page < list.totalPages && (
              <Link
                className={buttonClass("secondary", "sm")}
                href={href(query.get("view") || "all", list.page + 1)}
              >
                Next
              </Link>
            )}
          </div>
        </div>
      </Card>
    </Shell>
  );
}
