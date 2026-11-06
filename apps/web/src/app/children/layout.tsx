import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChildrenAuthBoundary } from "@/components/children/auth-boundary";
import { KidsNav } from "@/components/children/kids-nav";
import { requireServerRole } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";
import { LanguagePicker } from "@/components/i18n/language-picker";
import "@/components/children/children.css";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireServerRole("/children");
  const t = await getTranslations("children");
  const dedicated = ["children_worker", "children_supervisor"].includes(
    user.role,
  );
  const manages = user.role !== "children_worker";
  const items = [
    { href: "/children", label: t("nav.home") },
    ...(manages
      ? [
          { href: "/children/sessions/new", label: t("nav.openSession") },
          { href: "/children/families/new", label: t("nav.registerFamily") },
          { href: "/children/registrations", label: t("nav.registrations") },
        ]
      : []),
    { href: "/children/account", label: t("nav.account") },
  ];
  return (
    <ChildrenAuthBoundary
      userId={user._id || user.id || ""}
      role={user.role}
      scopeKey={[
        user.branchId || "",
        user.oversightRegion || "",
        user.district || "",
      ].join("|")}
    >
      <div className="children-workspace">
        <header className="sticky top-0 z-20 border-b border-[#e5e7db] bg-white/90 backdrop-blur">
          <div className="children-wrap flex flex-wrap items-center justify-between gap-4 !py-3">
            <Link
              href="/children"
              className="text-2xl font-bold tracking-tight"
            >
              {t("layout.brand")}{" "}
              <span className="rounded-xl bg-[#ffdda4] px-2 text-[#7b4c24]">
                {t("layout.kids")}
              </span>
            </Link>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <LanguagePicker />
              <span className="hidden items-center gap-2 text-sm text-[#647565] sm:inline-flex">
                <span className="kids-avatar !h-8 !w-8 !rounded-lg !text-sm">
                  {(user.firstName || "?").slice(0, 1)}
                </span>
                <span>
                  <span className="font-semibold text-[#243a36]">
                    {user.firstName}
                  </span>{" "}
                  · {dedicated ? t("layout.team") : t("layout.leadership")}
                </span>
              </span>
              {!dedicated && (
                <Link
                  href="/dashboard"
                  className="kids-chip"
                >
                  {t("layout.mainApp")} ↗
                </Link>
              )}
              <LogoutButton />
            </div>
          </div>
        </header>
        <main className="children-wrap space-y-6">
          <KidsNav items={items} label={t("layout.workspace")} />
          {children}
        </main>
        <footer className="children-wrap text-center text-xs text-[#788578]">
          {t("layout.footer")}
        </footer>
      </div>
    </ChildrenAuthBoundary>
  );
}
