import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { requireServerRole } from "@/lib/auth";
import { getUserScopeLabel } from "@/lib/permissions";
import { serverGet } from "@/lib/server-api";
import type { GlobalSearchResponse, GlobalSearchResultItem } from "@/lib/types";

function SearchResultSection({
  title,
  items,
  total,
}: {
  title: string;
  items: GlobalSearchResultItem[];
  total: number;
}) {
  return (
    <section className="surface rounded-[32px] p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow">{title}</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            {total} result{total === 1 ? "" : "s"}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Showing {items.length} of {total} scoped matches
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">
            Nothing matched in this group.
          </div>
        ) : (
          items.map((item) => (
            <Link
              key={`${item.entityType}-${item._id}`}
              href={item.href}
              className="block rounded-2xl border border-slate-200 bg-white px-4 py-4 transition hover:border-slate-300"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.subtitle}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">
                  {item.entityType}
                </span>
              </div>
              {item.meta ? (
                <p className="mt-3 text-sm text-slate-600">{item.meta}</p>
              ) : null}
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireServerRole("/search");
  const resolvedSearchParams = (await searchParams) ?? {};
  const q =
    typeof resolvedSearchParams.q === "string" ? resolvedSearchParams.q : "";
  const type =
    typeof resolvedSearchParams.type === "string"
      ? resolvedSearchParams.type
      : "all";

  const search = q.trim()
    ? await serverGet<GlobalSearchResponse>(
        `/search/global?q=${encodeURIComponent(q)}&type=${encodeURIComponent(
          type,
        )}&limit=10`,
      ).catch(() => null)
    : null;

  return (
    <Shell>
      <PageHeader
        eyebrow="Search"
        title="Find guests, members, branches, users, and follow-up"
        description={`Searching ${getUserScopeLabel(user)} so the results stay inside your visibility boundary.`}
      />

      <section className="surface rounded-[32px] p-8">
        <form className="grid gap-4 md:grid-cols-[1.5fr_0.6fr_auto]">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by name, phone, email, branch, or note"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
          />
          <select
            name="type"
            defaultValue={type}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
          >
            <option value="all">All results</option>
            <option value="guests">Guests</option>
            <option value="members">Members</option>
            <option value="branches">Branches</option>
            <option value="users">Users</option>
            <option value="followups">Follow-up</option>
          </select>
          <button
            type="submit"
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
          >
            Search
          </button>
        </form>

        {search ? (
          <div className="mt-5 flex flex-wrap gap-3">
            <span className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              {search.totals.total} results
            </span>
            <span className="rounded-2xl bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700">
              {search.totals.guests} guests
            </span>
            <span className="rounded-2xl bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700">
              {search.totals.members} members
            </span>
            <span className="rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
              {search.totals.users} users
            </span>
            <span className="rounded-2xl bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700">
              {search.totals.branches} branches
            </span>
            <span className="rounded-2xl bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
              {search.totals.followUps} follow-up
            </span>
          </div>
        ) : null}
      </section>

      {!q.trim() ? (
        <section className="surface rounded-[32px] p-8">
          <p className="text-sm text-slate-500">
            Start with at least two characters to search across your current scope.
          </p>
        </section>
      ) : !search || search.totals.total === 0 ? (
        <section className="surface rounded-[32px] p-8">
          <p className="text-sm text-slate-500">
            Nothing matched <span className="font-semibold text-slate-700">{q}</span>{" "}
            in your current scope.
          </p>
        </section>
      ) : (
        <section className="grid gap-6 xl:grid-cols-2">
          {(type === "all" || type === "guests") && (
            <SearchResultSection
              title="Guests"
              items={search.results.guests}
              total={search.totals.guests}
            />
          )}
          {(type === "all" || type === "members") && (
            <SearchResultSection
              title="Members"
              items={search.results.members}
              total={search.totals.members}
            />
          )}
          {(type === "all" || type === "users") && (
            <SearchResultSection
              title="Users"
              items={search.results.users}
              total={search.totals.users}
            />
          )}
          {(type === "all" || type === "branches") && (
            <SearchResultSection
              title="Branches"
              items={search.results.branches}
              total={search.totals.branches}
            />
          )}
          {(type === "all" || type === "followups") && (
            <SearchResultSection
              title="Follow-up"
              items={search.results.followUps}
              total={search.totals.followUps}
            />
          )}
        </section>
      )}
    </Shell>
  );
}
