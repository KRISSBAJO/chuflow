"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { Icon, type IconName } from "@/components/app/icons";
import { Avatar, Badge } from "@/components/ui/ui";
import { operatorLogout } from "@/lib/ops/client";
import { OPERATOR_ROLE_LABELS, can, type Operator } from "@/lib/ops/types";

type NavItem = { href: string; label: string; icon: IconName; exact?: boolean };

function navFor(operator: Operator): NavItem[] {
  const items: NavItem[] = [
    { href: "/ops", label: "Overview", icon: "home", exact: true },
    { href: "/ops/workspaces", label: "Workspaces", icon: "branches" },
    { href: "/ops/plans", label: "Plans", icon: "finance" },
    { href: "/ops/audit", label: "Audit log", icon: "clock" },
  ];
  if (can.manageOperators(operator.role)) items.splice(3, 0, { href: "/ops/operators", label: "Operators", icon: "users" });
  return items;
}

export function OpsShell({ operator, children }: { operator: Operator; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const items = navFor(operator);

  const isActive = (item: NavItem) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/"));

  async function signOut() {
    setSigningOut(true);
    try {
      await operatorLogout();
    } finally {
      router.replace("/ops/login");
      router.refresh();
    }
  }

  const nav = (
    <nav aria-label="Operator console" className="space-y-0.5">
      {items.map((item) => {
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={() => setMenuOpen(false)}
            className={[
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors",
              active ? "bg-[#111111] text-white" : "text-[#55534e] hover:bg-[#f2f1ed] hover:text-[#111111]",
            ].join(" ")}
          >
            <Icon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const account = (
    <div className="flex items-center gap-3 rounded-2xl bg-[#f6f5f1] px-3 py-2.5">
      <Avatar name={operator.email} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-[#111111]">{operator.email}</p>
        <p className="text-[11px] text-[#8a8780]">{OPERATOR_ROLE_LABELS[operator.role]}</p>
      </div>
      <button
        type="button"
        onClick={() => void signOut()}
        disabled={signingOut}
        aria-label="Sign out"
        title="Sign out"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#8a8780] transition-colors hover:bg-white hover:text-[#111111] disabled:opacity-50"
      >
        <Icon name="logout" className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="lp-root min-h-screen bg-[#fbfaf8] text-[#111111]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1400px]">
        <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-black/[0.06] bg-white px-4 py-5 lg:flex">
          <div className="flex items-center justify-between px-2">
            <Wordmark size={20} href="/ops" />
            <Badge tone="flame">Ops</Badge>
          </div>
          <p className="mt-5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a09a]">Control plane</p>
          <div className="mt-2 flex-1">{nav}</div>
          {account}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-black/[0.06] bg-white/90 px-4 backdrop-blur lg:hidden">
            <div className="flex items-center gap-2">
              <Wordmark size={18} href="/ops" />
              <Badge tone="flame">Ops</Badge>
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label="Menu"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[#55534e] hover:bg-[#f2f1ed]"
            >
              <Icon name={menuOpen ? "close" : "menu"} className="h-5 w-5" />
            </button>
          </header>
          {menuOpen ? (
            <div className="border-b border-black/[0.06] bg-white px-4 py-4 lg:hidden">
              {nav}
              <div className="mt-3">{account}</div>
            </div>
          ) : null}
          <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
            <div className="mx-auto w-full max-w-[1120px] space-y-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
