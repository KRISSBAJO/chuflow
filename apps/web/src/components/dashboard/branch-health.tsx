"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAppFormat } from "@/i18n/labels";
import { Icon } from "@/components/app/icons";
import type { DashboardGrowthBranch } from "@/lib/types";

type Tab = "leaders" | "attention";

export function BranchHealth({
  leaders,
  attention,
  hrefFor,
}: {
  leaders: DashboardGrowthBranch[];
  attention: DashboardGrowthBranch[];
  hrefFor: Record<string, string>;
}) {
  const t = useTranslations("dashboard.health");
  const { number: formatNumber } = useAppFormat();
  const [tab, setTab] = useState<Tab>("leaders");
  const items = tab === "leaders" ? leaders : attention;
  const maxScore = Math.max(1, ...items.map((item) => item.growthScore));

  return (
    <section className="app-card flex h-full flex-col p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-[#6b6b6b]">{t("label")}</p>
          <h2 className="lp-heading mt-1 text-[22px]">
            {tab === "leaders" ? t("growing") : t("support")}
          </h2>
        </div>
        <div role="tablist" aria-label={t("view")} className="flex rounded-xl bg-[#f6f5f1] p-1">
          {(
            [
              ["leaders", t("leaders")],
              ["attention", t("attention")],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-all ${tab === value ? "bg-white text-[var(--lp-ink)] shadow-[0_1px_3px_rgba(17,17,17,0.1)]" : "text-[#6b6b6b] hover:text-[var(--lp-ink)]"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {items.length ? (
        <div key={tab} className="app-rise mt-6">
          <div className="hidden grid-cols-[minmax(0,1.6fr)_repeat(3,64px)_minmax(0,1.1fr)_28px] gap-4 border-b border-black/[0.06] pb-2.5 text-[12px] font-medium text-[#8a8780] md:grid">
            <span>{t("branch")}</span>
            <span className="text-right">{t("guests")}</span>
            <span className="text-right">{t("members")}</span>
            <span className="text-right">{t("converts")}</span>
            <span>{t("score")}</span>
            <span />
          </div>
          <ul className="divide-y divide-black/[0.05]">
            {items.map((item, index) => (
              <li key={item._id}>
                <Link
                  href={hrefFor[item._id]}
                  className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3.5 md:grid-cols-[minmax(0,1.6fr)_repeat(3,64px)_minmax(0,1.1fr)_28px]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f6f5f1] text-[12px] font-semibold tabular-nums text-[var(--lp-ink)]">
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-[var(--lp-ink)]">{item.name}</span>
                      <span className="block truncate text-[12px] text-[#8a8780]">
                        {item.district} · {item.oversightRegion}
                      </span>
                    </span>
                  </span>
                  <span className="hidden text-right text-[14px] tabular-nums text-[var(--lp-ink)] md:block">{formatNumber(item.guestsCaptured)}</span>
                  <span className="hidden text-right text-[14px] tabular-nums text-[var(--lp-ink)] md:block">{formatNumber(item.membersAdded)}</span>
                  <span className="hidden text-right text-[14px] tabular-nums text-[var(--lp-ink)] md:block">{formatNumber(item.newConverts)}</span>
                  <span className="col-span-2 flex items-center gap-3 md:col-span-1" title={t("scoreValue", { score: item.growthScore })}>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#f1f0ec]">
                      <span
                        className="app-bar block h-full rounded-full bg-[#ea580c]"
                        style={{ width: `${Math.max(4, (item.growthScore / maxScore) * 100)}%`, animationDelay: `${index * 60}ms` }}
                      />
                    </span>
                    <span className="w-10 text-right text-[13px] font-semibold tabular-nums text-[var(--lp-ink)]">
                      {formatNumber(item.growthScore)}
                    </span>
                  </span>
                  <span className="hidden justify-end text-[#a3a09a] transition-colors group-hover:text-[var(--lp-ink)] md:flex">
                    <Icon name="arrowRight" className="h-4 w-4" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-6 rounded-2xl bg-[#f6f5f1] px-5 py-8 text-center text-[14px] text-[#6b6b6b]">
          {tab === "leaders"
            ? t("noGrowth")
            : t("noLow")}
        </p>
      )}
    </section>
  );
}
