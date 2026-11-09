import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/app/icons";
import { LogoutButton } from "@/components/logout-button";
import { Shell } from "@/components/shell";
import { requireServerRole } from "@/lib/auth";
import { settingsGroups } from "./sections";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string }>;
}) {
  const [user, t, { branchId }] = await Promise.all([requireServerRole("/settings"), getTranslations("admin.settings"), searchParams]);
  if (typeof branchId === "string" && branchId) {
    redirect("/settings/branch-defaults?" + new URLSearchParams({ branchId }));
  }
  const groups = settingsGroups(user);

  return (
    <Shell>
      <div className="app-rise mx-auto w-full max-w-3xl space-y-8">
        <header>
          <h1 className="lp-heading text-3xl leading-tight sm:text-4xl">{t("eyebrow")}</h1>
          <p className="mt-2 text-sm text-[var(--lp-muted)]">{t("navigation.intro")}</p>
        </header>

        {(["workspace", "personal", "forms"] as const).filter((group) => groups[group].length > 0).map((group) => (
          <section key={group} aria-labelledby={`settings-${group}`}>
            <h2 id={`settings-${group}`} className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-[var(--lp-muted)]">
              {t(`navigation.${group}`)}
            </h2>
            <ul className="divide-y divide-black/[.07] rounded-2xl border border-black/10">
              {groups[group].map((item) => (
                <li key={item.id}>
                  <Link href={`/settings/${item.id}`} prefetch={false} className="flex items-center gap-3 rounded-xl px-3.5 py-3 hover:bg-[var(--lp-panel)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 sm:gap-4 sm:px-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--lp-panel)]"><Icon name={item.icon} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{t(item.title)}</span>
                      {item.description !== "guestFields.ministryDescription" && (
                        <span className="mt-0.5 block text-[13px] leading-snug text-[var(--lp-muted)]">{t(item.description)}</span>
                      )}
                    </span>
                    <Icon name="chevronDown" className="h-4 w-4 shrink-0 -rotate-90 text-[var(--lp-muted)]" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <LogoutButton />
      </div>
    </Shell>
  );
}
