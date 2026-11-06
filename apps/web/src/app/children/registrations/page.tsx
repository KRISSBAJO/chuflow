import Link from "next/link";
import { serverGet } from "@/lib/server-api";
import { ParentRegistrationLink } from "@/components/children/registration-review";
import type { ChildrenOptions } from "@/lib/children";
type Queue = ChildrenOptions & {
  branchId: string;
  items: { _id: string; familyName: string; status: string }[];
  pagination: { page: number; total: number; totalPages: number };
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; page?: string }>;
}) {
  const q = await searchParams;
  const params = new URLSearchParams();
  if (q.branchId) params.set("branchId", q.branchId);
  if (q.page) params.set("page", q.page);
  const data = await serverGet<Queue>(`/children/registrations?${params}`);
  return (
    <>
      <Link className="text-sm" href="/children">
        ← Back to children’s workspace
      </Link>
      <section className="children-panel">
        <h1 className="text-3xl font-bold">Parent registration</h1>
        <p className="children-muted mt-3">
          Share the form, then verify each submission before creating active
          records or issuing cards.
        </p>
        <form className="mt-4 flex flex-wrap gap-3">
          <select
            className="children-input max-w-md"
            name="branchId"
            defaultValue={data.branchId}
            aria-label="Church"
          >
            {data.branches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>
          <button className="children-button">Open church</button>
        </form>
      </section>
      <ParentRegistrationLink key={data.branchId} branchId={data.branchId} />
      <section className="children-panel">
        <h2 className="text-xl font-bold">
          Awaiting review · {data.pagination.total}
        </h2>
        <div className="mt-4 divide-y divide-[#e4e7d9]">
          {data.items.map((r) => (
            <Link
              key={r._id}
              href={`/children/registrations/${r._id}`}
              className="flex justify-between py-4 font-medium"
            >
              {r.familyName}
              <span className="children-badge">{r.status} →</span>
            </Link>
          ))}
        </div>
        {!data.items.length && (
          <p className="children-muted mt-5">
            No registrations are waiting for review.
          </p>
        )}
        <div className="mt-5 flex justify-between text-sm">
          <span>
            Page {data.pagination.page} of {data.pagination.totalPages}
          </span>
          <div className="flex gap-3">
            {data.pagination.page > 1 && (
              <Link
                href={`/children/registrations?branchId=${data.branchId}&page=${data.pagination.page - 1}`}
              >
                ← Previous
              </Link>
            )}
            {data.pagination.page < data.pagination.totalPages && (
              <Link
                href={`/children/registrations?branchId=${data.branchId}&page=${data.pagination.page + 1}`}
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
