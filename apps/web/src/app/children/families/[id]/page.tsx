import Link from "next/link";
import { serverGet } from "@/lib/server-api";
import { ChildrenCardButton } from "@/components/children/receipt";
import type { Family } from "@/lib/children";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const q = await searchParams;
  const f = await serverGet<Family>(
    `/children/families/${encodeURIComponent(id)}`,
  );
  return (
    <>
      <Link href="/children" className="text-sm">
        ← Back to families
      </Link>
      {q.saved && (
        <p role="status" className="rounded-xl bg-green-50 p-4 text-green-800">
          Saved. The family and linked children are shown below.
        </p>
      )}
      <section className="children-panel">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="children-kicker">Family</p>
            <h1 className="mt-2 text-3xl font-bold">{f.name}</h1>
          </div>
          <Link
            className="children-button secondary"
            href={`/children/families/${id}/edit`}
          >
            Edit guardians
          </Link>
        </div>
        <div className="mt-5 children-grid">
          {f.guardians.map((g) => (
            <div key={g.id} className="rounded-xl bg-[#f5f7ef] p-4">
              <p className="font-semibold">
                {g.firstName} {g.lastName}
              </p>
              <p className="children-muted">
                {g.relationship} · {g.phone}
              </p>
              <p className="children-muted">
                {g.canCheckIn
                  ? "May bring linked children"
                  : "Emergency / contact only"}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <ChildrenCardButton kind="family" id={id} />
        </div>
      </section>
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Children</h2>
          <Link
            className="children-button"
            href={`/children/families/${id}/new`}
          >
            + Add child
          </Link>
        </div>
        {f.children.map((c) => (
          <section key={c._id} className="children-panel">
            <div className="flex justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold">
                  {c.firstName} {c.lastName}
                </h3>
                <p className="children-muted">
                  {c.isMember ? "Child member" : "Visiting child"} ·{" "}
                  {c.isActive ? "Active" : "Inactive"}
                </p>
              </div>
              <Link
                href={`/children/families/${id}/children/${c._id}`}
                className="text-sm underline"
              >
                Edit child
              </Link>
            </div>
            <p className="children-muted mt-4">
              Authorized pickup:{" "}
              {f.guardians
                .filter((g) => c.pickupGuardianIds.includes(g.id))
                .map((g) => `${g.firstName} ${g.lastName}`)
                .join(", ")}
            </p>
            {c.careNotes && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold">
                  Care instructions
                </summary>
                <p className="children-muted whitespace-pre-wrap mt-2">
                  {c.careNotes}
                </p>
              </details>
            )}
            {c.pickupNotes && (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">
                Pickup instructions: {c.pickupNotes}
              </p>
            )}
            <div className="mt-5">
              <ChildrenCardButton kind="child" id={c._id} />
            </div>
          </section>
        ))}
        {!f.children.length && (
          <p className="children-panel children-muted">
            Add the first child and choose their authorized pickup adults.
          </p>
        )}
      </section>
    </>
  );
}
