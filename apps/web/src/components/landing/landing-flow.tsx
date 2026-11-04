"use client";

import { Reveal, useViewProgress } from "./landing-motion";

const STEPS = [
  {
    title: "Welcome",
    body: "Guests register at the welcome desk or with a QR code in under a minute.",
    tag: "Guest intake",
  },
  {
    title: "Follow up",
    body: "A care worker is assigned with a clear next step, so nobody slips through.",
    tag: "Care workflow",
  },
  {
    title: "Belong",
    body: "When they are ready, guests become members and keep their full history.",
    tag: "Membership",
  },
  {
    title: "Grow",
    body: "Attendance, service units and reports show every life moving forward.",
    tag: "Ministry",
  },
];

export function LandingFlow() {
  const [ref, progress] = useViewProgress<HTMLDivElement>();
  const drawn = Math.min(1, Math.max(0, (progress - 0.15) / 0.4));

  return (
    <section id="flow" className="scroll-mt-20 py-28 sm:py-36">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
        <Reveal className="mx-auto max-w-[760px] text-center">
          <p className="lp-label">How it flows</p>
          <h2 className="lp-heading mt-4 text-[2.5rem] leading-[1.05] sm:text-[3.75rem]">
            From first visit to faithful service.
          </h2>
          <p className="mx-auto mt-5 max-w-[520px] text-[17px] leading-[1.6] text-[var(--lp-muted)]">
            One continuous journey for every person, so your teams always know what happens next.
          </p>
        </Reveal>

        <div ref={ref} className="relative mt-16 sm:mt-20">
          <svg viewBox="0 0 1000 40" preserveAspectRatio="none" className="absolute inset-x-[12.5%] top-[27px] hidden h-10 w-[75%] lg:block" aria-hidden>
            <path d="M0 20 C 120 0, 210 40, 333 20 S 540 0, 666 20 S 880 40, 1000 20" fill="none" stroke="#e7e5e0" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            <path
              d="M0 20 C 120 0, 210 40, 333 20 S 540 0, 666 20 S 880 40, 1000 20"
              fill="none"
              stroke="url(#lp-flow-line)"
              strokeWidth={3}
              strokeLinecap="round"
              pathLength={1}
              className="lp-ribbon"
              style={{ strokeDashoffset: 1 - drawn }}
            />
            <defs>
              <linearGradient id="lp-flow-line" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#ea580c" />
              </linearGradient>
            </defs>
          </svg>

          <ol className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
            {STEPS.map((step, index) => {
              const reached = drawn >= index / (STEPS.length - 1) - 0.02;
              return (
                <li key={step.title}>
                  <Reveal delay={index * 110} className="h-full">
                    <div className="flex h-full flex-col">
                      <span
                        className={`relative z-10 mx-auto hidden h-[54px] w-[54px] items-center justify-center rounded-full border-[6px] border-white text-[15px] font-semibold transition-colors duration-500 lg:flex ${reached ? "lp-flame-bg text-white" : "bg-[var(--lp-panel)] text-[var(--lp-muted)]"}`}
                      >
                        {index + 1}
                      </span>
                      <div className="mt-0 flex flex-1 flex-col rounded-[28px] bg-[var(--lp-panel)] p-7 lg:mt-6">
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-medium text-[var(--lp-muted)] lg:hidden">Step {index + 1}</span>
                          <span className="rounded-full bg-white px-3 py-1 text-[12px] font-medium text-[var(--lp-ink)] lg:ml-auto">
                            {step.tag}
                          </span>
                        </div>
                        <h3 className="lp-heading mt-10 text-[28px] leading-none">{step.title}</h3>
                        <p className="mt-3 text-[15px] leading-[1.6] text-[var(--lp-muted)]">{step.body}</p>
                      </div>
                    </div>
                  </Reveal>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
