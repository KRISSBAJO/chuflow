import Link from "next/link";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { Card, buttonClass } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { Meeting, MeetingOptions } from "@/lib/meetings";
export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireServerRole("/meetings");
  const raw = await searchParams;
  const query = new URLSearchParams();
  for (const key of [
    "q",
    "groupId",
    "branchId",
    "status",
    "minutes",
    "sort",
    "page",
    "from",
    "to",
    "actions",
    "upcoming",
  ])
    if (typeof raw[key] === "string" && raw[key].trim()) query.set(key, raw[key]);
  const [result, options] = await Promise.all([
    serverGet<{ items: Meeting[]; total: number; page: number; limit: number }>(
      `/meetings?${query}`,
    ),
    serverGet<MeetingOptions>("/meetings/options"),
  ]);
  const pageLink = (page: number) => {
    const q = new URLSearchParams(query);
    q.set("page", String(page));
    return `/meetings?${q}`;
  };
  return (
    <Shell>
      <PageHeader
        eyebrow="Meetings"
        title="Meet, decide and follow through"
        description="Schedule group meetings, record attendance, submit minutes and track actions."
        action={
          <div className="flex flex-wrap gap-2">
            {options.isAdmin && (
              <Link
                href="/meetings/groups"
                className={buttonClass("secondary")}
              >
                Group settings
              </Link>
            )}
            <Link href="/meetings/new" className={buttonClass()}>
              + Schedule meeting
            </Link>
          </div>
        }
      />
      <Card className="p-5">
        <form className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <input
            name="q"
            className="ui-input"
            placeholder="Search meetings"
            aria-label="Search meetings"
            defaultValue={query.get("q") || ""}
          />
          <select
            name="branchId"
            className="ui-input"
            aria-label="Branch"
            defaultValue={query.get("branchId") || ""}
          >
            <option value="">All accessible branches</option>
            {options.branches.map((b) => (
              <option value={b._id} key={b._id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            name="groupId"
            className="ui-input"
            aria-label="Meeting group"
            defaultValue={query.get("groupId") || ""}
          >
            <option value="">All meeting groups</option>
            {options.groups.map((g) => (
              <option value={g._id} key={g._id}>
                {g.name}
              </option>
            ))}
          </select>
          <select
            name="status"
            className="ui-input"
            aria-label="Meeting status"
            defaultValue={query.get("status") || ""}
          >
            <option value="">All meeting statuses</option>
            {["scheduled", "ongoing", "completed", "cancelled"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            name="minutes"
            className="ui-input"
            aria-label="Minutes status"
            defaultValue={query.get("minutes") || ""}
          >
            <option value="">All minutes statuses</option>
            {[
              "overdue",
              "draft",
              "submitted",
              "approved",
              "changes_requested",
            ].map((s) => (
              <option value={s} key={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <select
            name="sort"
            className="ui-input"
            aria-label="Sort meetings"
            defaultValue={query.get("sort") || "newest"}
          >
            <option value="newest">Latest first</option>
            <option value="oldest">Earliest first</option>
          </select>
          <label className="text-sm">
            From (UTC)
            <input
              name="from"
              type="date"
              className="ui-input"
              defaultValue={query.get("from") || ""}
            />
          </label>
          <label className="text-sm">
            To (UTC)
            <input
              name="to"
              type="date"
              className="ui-input"
              defaultValue={query.get("to") || ""}
            />
          </label>
          <select
            className="ui-input"
            name="actions"
            aria-label="Actions"
            defaultValue={query.get("actions") || ""}
          >
            <option value="">All actions</option>
            <option value="due">My overdue actions</option>
          </select>
          <select
            className="ui-input"
            name="upcoming"
            aria-label="Upcoming"
            defaultValue={query.get("upcoming") || ""}
          >
            <option value="">All dates</option>
            <option value="true">Next 24 hours</option>
          </select>
          <button className={buttonClass()}>Apply filters</button>
          <Link className={buttonClass("secondary")} href="/meetings">
            Clear filters
          </Link>
        </form>
      </Card>
      <Card className="p-5 overflow-x-auto">
        <p className="mb-4 text-sm">{result.total} meetings</p>
        <table className="ui-table w-full">
          <thead>
            <tr>
              <th>Meeting</th>
              <th>Branch / group</th>
              <th>Starts</th>
              <th>Status</th>
              <th>Minutes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((m) => (
              <tr key={m._id}>
                <td>
                  <Link
                    className="font-medium underline"
                    href={`/meetings/${m._id}`}
                  >
                    {m.title}
                  </Link>
                </td>
                <td>
                  {typeof m.branchId === "object" ? m.branchId.name : ""}
                  <br />
                  {typeof m.groupId === "object" ? m.groupId.name : ""}
                </td>
                <td>
                  {new Date(m.startsAt).toLocaleString("en-US", {
                    timeZone: "UTC",
                  })}{" "}
                  UTC
                </td>
                <td>{m.status}</td>
                <td className={m.minutesOverdue ? "text-red-700" : ""}>
                  {m.minutesOverdue ? "Overdue · " : ""}
                  {m.minutesStatus.replaceAll("_", " ")}
                </td>
                <td>
                  {m.actions.filter((a) => a.status === "open").length} open
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!result.items.length && (
          <p className="py-8 text-center text-[#6b6b6b]">
            No meetings match these filters. Enable a group in Group settings to
            get started.
          </p>
        )}
        <div className="mt-4 flex items-center justify-between">
          <span>
            Page {result.page} of{" "}
            {Math.max(1, Math.ceil(result.total / result.limit))}
          </span>
          <div className="flex gap-2">
            {result.page > 1 && (
              <Link
                href={pageLink(result.page - 1)}
                className={buttonClass("secondary", "sm")}
              >
                Previous
              </Link>
            )}
            {result.page * result.limit < result.total && (
              <Link
                href={pageLink(result.page + 1)}
                className={buttonClass("secondary", "sm")}
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
