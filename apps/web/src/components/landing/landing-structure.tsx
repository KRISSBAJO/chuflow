"use client";

import { useState } from "react";
import { Reveal } from "./landing-motion";

const LEVELS = [
  {
    name: "National",
    body: "See the whole network at once: reports, approvals, settings and the health of every district.",
    roles: ["National admin", "National pastor"],
  },
  {
    name: "District",
    body: "Coordinate a region, compare branches and step in where a branch needs support.",
    roles: ["District admin", "District pastor"],
  },
  {
    name: "Branch",
    body: "Run the day-to-day: guests, members, services, offerings and the teams that serve.",
    roles: ["Branch admin", "Resident pastor", "Associate pastor"],
  },
  {
    name: "Units",
    body: "Give follow-up workers and ushers focused tools for exactly the work they do.",
    roles: ["Follow-up", "Usher"],
  },
];

export function LandingStructure() {
  const [open, setOpen] = useState(2);

  return (
    <section id="structure" className="scroll-mt-20 py-28 sm:py-36">
      <div className="mx-auto grid max-w-[1240px] gap-12 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-20">
        <Reveal>
          <p className="lp-label">Built for church structure</p>
          <h2 className="lp-heading mt-4 text-[2.5rem] leading-[1.05] sm:text-[3.5rem]">
            The right view for every level.
          </h2>
          <p className="mt-5 max-w-[400px] text-[17px] leading-[1.6] text-[var(--lp-muted)]">
            Access follows your church&apos;s structure. Each person sees what their role needs, and every action is kept
            on an audit trail.
          </p>
        </Reveal>

        <Reveal delay={120}>
          <ul className="border-t border-black/[0.08]">
            {LEVELS.map((level, index) => {
              const active = open === index;
              return (
                <li key={level.name} className="border-b border-black/[0.08]">
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
                        {level.name}
                      </span>
                    </span>
                    <span className="text-[13px] font-medium tabular-nums text-[var(--lp-muted)]">0{index + 1}</span>
                  </button>
                  <div className={`grid transition-[grid-template-rows] duration-500 ease-out ${active ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                    <div className="overflow-hidden">
                      <div className="pb-8 pl-[26px]">
                        <p className="max-w-[520px] text-[17px] leading-[1.6] text-[var(--lp-muted)]">{level.body}</p>
                        <div className="mt-5 flex flex-wrap gap-2">
                          {level.roles.map((role) => (
                            <span key={role} className="rounded-full bg-[var(--lp-panel)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--lp-ink)]">
                              {role}
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
