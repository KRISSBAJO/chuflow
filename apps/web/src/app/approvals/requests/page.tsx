import Link from "next/link";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { FilterPanel } from "@/components/filter-panel";
import { Button, Card, Pagination, buttonClass } from "@/components/ui/ui";
import type { ApprovalList } from "@/lib/approval-workflows";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireServerRole("/approvals/requests");
  const q = await searchParams;
  const params = new URLSearchParams();
  for (const key of ["search", "status", "view", "page"])
    if (q[key]) params.set(key, q[key]!);
  const data = await serverGet<ApprovalList>(
    `/approval-workflows/requests?${params}`,
  );
  const href = (page: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(page));
    return `/approvals/requests?${next}`;
  };
  return (
    <Shell>
      <Link href="/approvals" className="text-sm hover:underline">
        ← Back to approvals
      </Link>
      <PageHeader
        eyebrow="General approvals"
        title="Requests and decisions"
        description="Track each request to its designated final approver."
        action={
          <div className="flex gap-2">
            {["super_admin", "national_admin"].includes(user.role) && (
              <Link
                className={buttonClass("secondary")}
                href="/approvals/routes"
              >
                Approval routes
              </Link>
            )}
            <Link
              className={buttonClass("primary")}
              href="/approvals/requests/new"
            >
              + New request
            </Link>
          </div>
        }
      />
      <FilterPanel>
        <form className="grid gap-3 sm:grid-cols-4">
          <input
            className="ui-input"
            name="search"
            aria-label="Search requests"
            placeholder="Search request titles"
            defaultValue={q.search}
          />
          <select
            className="ui-input"
            name="status"
            aria-label="Request status"
            defaultValue={q.status || ""}
          >
            <option value="">All statuses</option>
            {["pending", "approved", "returned", "rejected", "withdrawn"].map(
              (s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ),
            )}
          </select>
          <select
            className="ui-input"
            name="view"
            aria-label="Request view"
            defaultValue={q.view || "all"}
          >
            <option value="all">All accessible requests</option>
            <option value="mine">My requests</option>
            <option value="review">Awaiting my review</option>
            <option value="overdue">Overdue reviews</option>
          </select>
          <Button type="submit">Apply filters</Button>
          <Link href="/approvals/requests" className="text-sm hover:underline">
            Reset filters
          </Link>
        </form>
      </FilterPanel>
      <Card className="p-5">
        <p className="mb-4 text-sm text-[#6b6b6b]">
          {data.pagination.total} matching requests
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[#8a8780]">
              <tr>
                {[
                  "Request",
                  "Church",
                  "Status",
                  "Current review",
                  "Final level",
                ].map((h) => (
                  <th key={h} className="px-3 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r._id} className="border-t border-black/5">
                  <td className="px-3 py-4">
                    <Link
                      href={`/approvals/requests/${r._id}`}
                      className="font-medium hover:underline"
                    >
                      {r.title} →
                    </Link>
                    <p className="mt-1 text-xs text-[#8a8780]">{r.category}</p>
                  </td>
                  <td className="px-3 py-4">{r.branchName}</td>
                  <td className="px-3 py-4">{r.status}</td>
                  <td className="px-3 py-4">
                    {r.status === "pending" ? (
                      <>
                        {r.stages[r.currentStage]?.label}
                        <p
                          className={
                            new Date(r.dueAt) < new Date()
                              ? "text-xs text-red-700"
                              : "text-xs text-[#8a8780]"
                          }
                        >
                          Due{" "}
                          {new Date(r.dueAt).toLocaleDateString("en-US", {
                            timeZone: "UTC",
                          })}
                        </p>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-4">{r.finalLevel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.items.length && (
          <p className="py-8 text-center text-sm text-[#6b6b6b]">
            No requests match these filters.
          </p>
        )}
        <Pagination
          page={data.pagination.page}
          totalPages={data.pagination.totalPages}
          prevHref={href(Math.max(1, data.pagination.page - 1))}
          nextHref={href(
            Math.min(data.pagination.totalPages, data.pagination.page + 1),
          )}
        />
      </Card>
    </Shell>
  );
}
