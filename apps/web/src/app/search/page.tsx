import { FilterPanel } from "@/components/filter-panel";
import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Icon, type IconName } from "@/components/app/icons";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { Badge, Button, Card, CardHeader, EmptyState } from "@/components/ui/ui";
import { useScopeLabel } from "@/i18n/labels";
import { requireServerRole, type SessionUser } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { GlobalSearchResponse, GlobalSearchResultItem } from "@/lib/types";

function SearchHeader({ user }: { user: SessionUser }) {
  const t = useTranslations("services.search");
  const scopeLabel = useScopeLabel();
  return (
    <PageHeader
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description", { scope: scopeLabel(user) })}
    />
  );
}

function SearchResultSection({
  type,
  icon,
  items,
  total,
  delay = 0,
}: {
  type: GlobalSearchResultItem["entityType"];
  icon: IconName;
  items: GlobalSearchResultItem[];
  total: number;
  delay?: number;
}) {
  const t = useTranslations("services.search");
  return (
    <Card className="app-rise p-6 sm:p-7" style={{ animationDelay: `${delay}ms` }}>
      <CardHeader
        label={t(`types.${type}`)}
        title={t("section.results", { count: total })}
        description={t("section.showing", { shown: items.length, total })}
        action={
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f6f5f1] text-[#55534e]">
            <Icon name={icon} className="h-4 w-4" />
          </span>
        }
      />

      <div className="mt-5">
        {items.length === 0 ? (
          <EmptyState icon={icon}>{t("section.empty")}</EmptyState>
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
                      <Badge>{t(`types.${item.entityType}`)}</Badge>
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
  const t = await getTranslations("services.search");
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

  const count = (chunks: ReactNode) => <span className="tabular-nums">{chunks}</span>;

  return (
    <Shell>
      <SearchHeader user={user} />

      <Card className="app-rise p-4 sm:p-5">
        <FilterPanel><form className="grid gap-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,0.6fr)_auto]">
          <label className="relative block">
            <span className="sr-only">{t("searchLabel")}</span>
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8780]"
            />
            <input
              name="q"
              defaultValue={q}
              placeholder={t("placeholder")}
              className="ui-input !pl-9"
            />
          </label>
          <select name="type" defaultValue={type} aria-label={t("typeAria")} className="ui-input">
            <option value="all">{t("allResults")}</option>
            <option value="guests">{t("types.guests")}</option>
            <option value="members">{t("types.members")}</option>
            <option value="branches">{t("types.branches")}</option>
            <option value="users">{t("types.users")}</option>
            <option value="followups">{t("types.followups")}</option>
          </select>
          <Button type="submit">{t("search")}</Button>
        </form></FilterPanel>

        {search ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            <Badge tone="flame">{t.rich("totals.results", { count: search.totals.total, n: count })}</Badge>
            <Badge>{t.rich("totals.guests", { count: search.totals.guests, n: count })}</Badge>
            <Badge>{t.rich("totals.members", { count: search.totals.members, n: count })}</Badge>
            <Badge>{t.rich("totals.users", { count: search.totals.users, n: count })}</Badge>
            <Badge>{t.rich("totals.branches", { count: search.totals.branches, n: count })}</Badge>
            <Badge>{t.rich("totals.followUp", { count: search.totals.followUps, n: count })}</Badge>
          </div>
        ) : null}
      </Card>

      {!q.trim() ? (
        <EmptyState icon="search" title={t("startTitle")}>
          {t("startBody")}
        </EmptyState>
      ) : !search || search.totals.total === 0 ? (
        <EmptyState icon="search" title={t("noMatchesTitle")}>
          {t.rich("noMatchesBody", {
            query: q,
            b: (chunks: ReactNode) => <span className="font-medium text-[#111111]">{chunks}</span>,
          })}
        </EmptyState>
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          {(type === "all" || type === "guests") && (
            <SearchResultSection
              type="guests"
              icon="guests"
              items={search.results.guests}
              total={search.totals.guests}
            />
          )}
          {(type === "all" || type === "members") && (
            <SearchResultSection
              type="members"
              icon="members"
              items={search.results.members}
              total={search.totals.members}
              delay={40}
            />
          )}
          {(type === "all" || type === "users") && (
            <SearchResultSection
              type="users"
              icon="users"
              items={search.results.users}
              total={search.totals.users}
              delay={80}
            />
          )}
          {(type === "all" || type === "branches") && (
            <SearchResultSection
              type="branches"
              icon="branches"
              items={search.results.branches}
              total={search.totals.branches}
              delay={120}
            />
          )}
          {(type === "all" || type === "followups") && (
            <SearchResultSection
              type="followups"
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
