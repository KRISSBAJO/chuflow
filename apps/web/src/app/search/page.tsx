import Link from "next/link";
import { Icon, type IconName } from "@/components/app/icons";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { Badge, Button, Card, CardHeader, EmptyState, formatStatus } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { getUserScopeLabel } from "@/lib/permissions";
import { serverGet } from "@/lib/server-api";
import type { GlobalSearchResponse, GlobalSearchResultItem } from "@/lib/types";

function SearchResultSection({
  title,
  icon,
  items,
  total,
  delay = 0,
}: {
  title: string;
  icon: IconName;
  items: GlobalSearchResultItem[];
  total: number;
  delay?: number;
}) {
  return (
    <Card className="app-rise p-6 sm:p-7" style={{ animationDelay: `${delay}ms` }}>
      <CardHeader
        label={title}
        title={`${total} result${total === 1 ? "" : "s"}`}
        description={`Showing ${items.length} of ${total} matches in your scope`}
        action={
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f6f5f1] text-[#55534e]">
            <Icon name={icon} className="h-4 w-4" />
          </span>
        }
      />

      <div className="mt-5">
        {items.length === 0 ? (
          <EmptyState icon={icon}>Nothing matched in this group.</EmptyState>
        ) : (
          <ul className="divide-y divide-black/[0.05]">
            {items.map((item) => (
              <li key={`${item.entityType}-${item._id}`}>
                <Link
                  href={item.href}
                  className="group -mx-2 flex items-start gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-[#f6f5f1]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-medium text-[#111111]">{item.title}</span>
                      <Badge>{formatStatus(item.entityType)}</Badge>
                    </span>
                    <span className="mt-0.5 block text-[13px] text-[#6b6b6b]">{item.subtitle}</span>
                    {item.meta ? (
                      <span className="mt-1 block text-[12px] text-[#8a8780]">{item.meta}</span>
                    ) : null}
                  </span>
                  <Icon
                    name="arrowUpRight"
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#8a8780] transition-colors group-hover:text-[#111111]"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
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
        title="Find guests, members, branches, users and follow-up"
        description={`Searching ${getUserScopeLabel(user)}, so results stay inside what you are allowed to see.`}
      />

      <Card className="app-rise p-4 sm:p-5">
        <form className="grid gap-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,0.6fr)_auto]">
          <label className="relative block">
            <span className="sr-only">Search</span>
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8780]"
            />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search by name, phone, email, branch or note"
              className="ui-input !pl-9"
            />
          </label>
          <select name="type" defaultValue={type} aria-label="Result type" className="ui-input">
            <option value="all">All results</option>
            <option value="guests">Guests</option>
            <option value="members">Members</option>
            <option value="branches">Branches</option>
            <option value="users">Users</option>
            <option value="followups">Follow-up</option>
          </select>
          <Button type="submit">Search</Button>
        </form>

        {search ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            <Badge tone="flame">
              <span className="tabular-nums">{search.totals.total}</span> results
            </Badge>
            <Badge>
              <span className="tabular-nums">{search.totals.guests}</span> guests
            </Badge>
            <Badge>
              <span className="tabular-nums">{search.totals.members}</span> members
            </Badge>
            <Badge>
              <span className="tabular-nums">{search.totals.users}</span> users
            </Badge>
            <Badge>
              <span className="tabular-nums">{search.totals.branches}</span> branches
            </Badge>
            <Badge>
              <span className="tabular-nums">{search.totals.followUps}</span> follow-up
            </Badge>
          </div>
        ) : null}
      </Card>

      {!q.trim() ? (
        <EmptyState icon="search" title="Start searching">
          Type at least two characters to search across your current scope.
        </EmptyState>
      ) : !search || search.totals.total === 0 ? (
        <EmptyState icon="search" title="No matches">
          Nothing matched <span className="font-medium text-[#111111]">{q}</span> in your current scope.
        </EmptyState>
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          {(type === "all" || type === "guests") && (
            <SearchResultSection
              title="Guests"
              icon="guests"
              items={search.results.guests}
              total={search.totals.guests}
            />
          )}
          {(type === "all" || type === "members") && (
            <SearchResultSection
              title="Members"
              icon="members"
              items={search.results.members}
              total={search.totals.members}
              delay={40}
            />
          )}
          {(type === "all" || type === "users") && (
            <SearchResultSection
              title="Users"
              icon="users"
              items={search.results.users}
              total={search.totals.users}
              delay={80}
            />
          )}
          {(type === "all" || type === "branches") && (
            <SearchResultSection
              title="Branches"
              icon="branches"
              items={search.results.branches}
              total={search.totals.branches}
              delay={120}
            />
          )}
          {(type === "all" || type === "followups") && (
            <SearchResultSection
              title="Follow-up"
              icon="care"
              items={search.results.followUps}
              total={search.totals.followUps}
              delay={160}
            />
          )}
        </section>
      )}
    </Shell>
  );
}
