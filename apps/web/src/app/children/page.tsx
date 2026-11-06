import Link from "next/link";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { ChildrenLocalTime } from "@/components/children/local-time";
import { ChildrenWelcome } from "@/components/children/welcome";
import { FilterPanel } from "@/components/filter-panel";
import type { ChildrenOverview } from "@/lib/children";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireServerRole("/children");
  const q = await searchParams;
  const params = new URLSearchParams();
  for (const key of ["branchId", "search", "page", "sessionPage"])
    if (q[key]) params.set(key, q[key]!);
  const data = await serverGet<ChildrenOverview>(`/children?${params}`);
  const pageHref = (page: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(page));
    return `/children?${next}`;
  };
  const sessionHref = (page: number) => {
    const next = new URLSearchParams(params);
    next.set("sessionPage", String(page));
    return `/children?${next}`;
  };
  return (
    <>
      <ChildrenWelcome />
      <section className="children-steps" aria-label="How it works">
        <div className="children-step">
          <strong>A</strong>
          <h2 className="text-lg font-semibold">A friendly hello</h2>
          <p className="children-muted mt-2">
            Find a family or scan their QR card at an open session.
          </p>
        </div>
        <div className="children-step">
          <strong>B</strong>
          <h2 className="text-lg font-semibold">A place to belong</h2>
          <p className="children-muted mt-2">
            Choose the right room and give the guardian their pickup receipt.
          </p>
        </div>
        <div className="children-step">
          <strong>C</strong>
          <h2 className="text-lg font-semibold">A careful goodbye</h2>
          <p className="children-muted mt-2">
            Check the receipt and authorized adult before confirming pickup.
          </p>
        </div>
      </section>
      <FilterPanel>
        <form className="flex flex-wrap items-end gap-3">
          <label className="min-w-60 flex-1">
            <span className="children-label">Church</span>
            <select
              name="branchId"
              defaultValue={data.branchId || ""}
              className="children-input"
            >
              {data.branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          {data.canManage && (
            <label className="min-w-60 flex-1">
              <span className="children-label">Find a family</span>
              <input
                name="search"
                className="children-input"
                placeholder="Family name"
                defaultValue={q.search}
              />
            </label>
          )}
          <button className="children-button" type="submit">
            Apply
          </button>
        </form>
      </FilterPanel>
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Your sessions</h2>
          {data.canManage && (
            <Link
              href={`/children/sessions/new?branchId=${data.branchId || ""}`}
              className="children-button"
            >
              + Open session
            </Link>
          )}
        </div>
        <div className="children-grid">
          {data.sessions.map((s) => (
            <Link
              key={s._id}
              href={`/children/sessions/${s._id}`}
              className="children-panel children-room"
            >
              <div className="flex justify-between gap-3">
                <h3 className="text-xl font-bold">{s.name} →</h3>
                <span className="children-badge">{s.status}</span>
              </div>
              <p className="children-muted mt-2">
                <ChildrenLocalTime value={s.startsAt} />
              </p>
              <div className="mt-5 flex gap-8">
                <div>
                  <p className="text-3xl font-bold">{s.present}</p>
                  <p className="children-muted">Here now</p>
                </div>
                <div>
                  <p className="text-3xl font-bold">{s.attended}</p>
                  <p className="children-muted">Unique children attended</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
        {!data.sessions.length && (
          <div className="children-panel children-muted">
            {data.branches.length
              ? "No sessions yet. A supervisor can open a service and set up classrooms."
              : "Ask your church administrator to assign children’s ministry access."}
          </div>
        )}
        {data.sessionPagination?.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span>
              Session page {data.sessionPagination.page} of{" "}
              {data.sessionPagination.totalPages}
            </span>
            <div className="flex gap-4">
              {data.sessionPagination.page > 1 && (
                <Link href={sessionHref(data.sessionPagination.page - 1)}>
                  ← Newer sessions
                </Link>
              )}
              {data.sessionPagination.page <
                data.sessionPagination.totalPages && (
                <Link href={sessionHref(data.sessionPagination.page + 1)}>
                  Older sessions →
                </Link>
              )}
            </div>
          </div>
        )}
      </section>
      {data.canManage && (
        <section className="children-panel">
          <div className="flex justify-between gap-3">
            <h2 className="text-xl font-bold">Families</h2>
            <span className="children-badge">
              {data.pagination.total} registered
            </span>
          </div>
          <div className="mt-4 divide-y divide-[#e8ebdf]">
            {data.families.map((f) => (
              <Link
                key={f._id}
                className="flex justify-between py-4 font-medium"
                href={`/children/families/${f._id}`}
              >
                {f.name}
                <span>Open →</span>
              </Link>
            ))}
          </div>
          {!data.families.length && (
            <p className="children-muted my-5">
              No matching families. Register a parent or guardian first, then
              add their children.
            </p>
          )}
          <div className="mt-4 flex items-center justify-between text-sm">
            <span>
              Page {data.pagination.page} of {data.pagination.totalPages}
            </span>
            <div className="flex gap-3">
              {data.pagination.page > 1 && (
                <Link href={pageHref(data.pagination.page - 1)}>
                  ← Previous
                </Link>
              )}
              {data.pagination.page < data.pagination.totalPages && (
                <Link href={pageHref(data.pagination.page + 1)}>Next →</Link>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
