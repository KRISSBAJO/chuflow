"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type KidsNavItem = { href: string; label: string; count?: number };

/** Pill navigation for the Kids workspace with the current section highlighted. */
export function KidsNav({ items, label }: { items: KidsNavItem[]; label: string }) {
  const pathname = usePathname();
  const current = (href: string) =>
    href === "/children"
      ? pathname === "/children" ||
        pathname.startsWith("/children/families") ||
        pathname.startsWith("/children/sessions/")
      : pathname === href || pathname.startsWith(href + "/");
  return (
    <nav className="children-nav" aria-label={label}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={current(item.href) ? "page" : undefined}
        >
          {item.label}
          {item.count ? <span className="kids-nav-count">{item.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
