"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

export function WorkspaceTabs({
  tabs,
  defaultTab,
  label = "Sections",
}: {
  tabs: {
    id: string;
    label: string;
    count?: number;
    hidden?: boolean;
    content: ReactNode;
  }[];
  defaultTab: string;
  label?: string;
}) {
  const path = usePathname();
  const params = useSearchParams();
  const selected =
    tabs.find((tab) => tab.id === params.get("tab")) ||
    tabs.find((tab) => tab.id === defaultTab) ||
    tabs[0];
  return (
    <div className="min-w-0 space-y-5">
      <nav
        aria-label={label}
        className="flex gap-1 overflow-x-auto border-b border-black/[0.08]"
      >
        {tabs
          .filter((tab) => !tab.hidden)
          .map((tab) => {
            const query = new URLSearchParams(params.toString());
            query.set("tab", tab.id);
            query.delete("edit");
            return (
              <Link
                key={tab.id}
                href={`${path}?${query}`}
                scroll={false}
                aria-current={selected?.id === tab.id ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${selected?.id === tab.id ? "border-orange-600 text-orange-700" : "border-transparent text-[#6b6b6b] hover:text-[#111]"}`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-xs tabular-nums">
                    {tab.count}
                  </span>
                )}
              </Link>
            );
          })}
      </nav>
      <section
        key={selected?.id}
        aria-label={selected?.label}
        className="min-w-0 space-y-5"
      >
        {selected?.content}
      </section>
    </div>
  );
}
