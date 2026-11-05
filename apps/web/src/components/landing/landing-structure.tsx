"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Reveal } from "./landing-motion";

const LEVELS = [
  { key: "national", roles: ["levels.national.role1", "levels.national.role2"] },
  { key: "district", roles: ["levels.district.role1", "levels.district.role2"] },
  { key: "branch", roles: ["levels.branch.role1", "levels.branch.role2", "levels.branch.role3"] },
  { key: "units", roles: ["levels.units.role1", "levels.units.role2"] },
] as const;

export function LandingStructure() {
  const t = useTranslations("structure");
  const [open, setOpen] = useState(2);

  return (
    <section id="structure" className="scroll-mt-20 py-28 sm:py-36">
      <div className="mx-auto grid max-w-[1240px] gap-12 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-20">
        <Reveal>
          <p className="lp-label">{t("label")}</p>
          <h2 className="lp-heading mt-4 text-[2.5rem] leading-[1.05] sm:text-[3.5rem]">{t("title")}</h2>
          <p className="mt-5 max-w-[400px] text-[17px] leading-[1.6] text-[var(--lp-muted)]">{t("body")}</p>
        </Reveal>

        <Reveal delay={120}>
          <ul className="border-t border-black/[0.08]">
            {LEVELS.map((level, index) => {
              const active = open === index;
              return (
                <li key={level.key} className="border-b border-black/[0.08]">
                  <button
                    type="button"
                    onClick={() => setOpen(index)}
                    aria-expanded={active}
                    className="group flex w-full items-center justify-between gap-6 py-6 text-left sm:py-7"
                  >
                    <span className="flex items-center gap-4">
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full transition-all duration-500 ${active ? "lp-flame-bg scale-100" : "scale-75 bg-black/15"}`}
                      />
                      <span
                        className={`lp-heading text-[2.25rem] leading-none transition-all duration-500 sm:text-[3.25rem] ${active ? "text-[var(--lp-ink)]" : "text-black/25 group-hover:translate-x-1 group-hover:text-black/50"}`}
                      >
                        {t(`levels.${level.key}.name`)}
                      </span>
                    </span>
                    <span className="text-[13px] font-medium tabular-nums text-[var(--lp-muted)]">0{index + 1}</span>
                  </button>
                  <div className={`grid transition-[grid-template-rows] duration-500 ease-out ${active ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                    <div className="overflow-hidden">
                      <div className="pb-8 pl-[26px]">
                        <p className="max-w-[520px] text-[17px] leading-[1.6] text-[var(--lp-muted)]">{t(`levels.${level.key}.body`)}</p>
                        <div className="mt-5 flex flex-wrap gap-2">
                          {level.roles.map((role) => (
                            <span key={role} className="rounded-full bg-[var(--lp-panel)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--lp-ink)]">
                              {t(role)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
