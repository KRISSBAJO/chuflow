"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import type { PublicConnectOption } from "@/lib/types";

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
}

function scoreOption(option: PublicConnectOption, query: string) {
  if (!query.trim()) {
    return 0;
  }

  const branch = option.branch;
  const haystack = normalize(
    [
      option.name,
      option.title,
      branch?.name,
      branch?.city,
      branch?.state,
      branch?.address,
      branch?.country,
    ]
      .filter(Boolean)
      .join(" "),
  );

  const terms = normalize(query)
    .split(/\s+/)
    .filter(Boolean);

  return terms.reduce((total, term) => {
    if (!term) {
      return total;
    }

    if (haystack.includes(` ${term} `) || haystack.startsWith(`${term} `) || haystack.endsWith(` ${term}`)) {
      return total + 4;
    }

    if (haystack.includes(term)) {
      return total + 2;
    }

    return total;
  }, 0);
}

export function PublicConnectChooser({
  options,
}: {
  options: PublicConnectOption[];
}) {
  const [query, setQuery] = useState("");

  const sortedOptions = useMemo(() => {
    return [...options]
      .map((option) => ({
        option,
        score: scoreOption(option, query),
      }))
      .filter((entry) => (!query.trim() ? true : entry.score > 0))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return (left.option.branch?.name || left.option.name).localeCompare(
          right.option.branch?.name || right.option.name,
        );
      })
      .map((entry) => entry.option);
  }, [options, query]);

  const visibleOptions = sortedOptions.length > 0 ? sortedOptions : options;

  return (
    <div className="lp-root min-h-screen w-full bg-white">
      <header className="flex h-20 items-center px-6 sm:px-10">
        <Wordmark size={22} />
      </header>

      <main className="mx-auto max-w-[1100px] px-5 pb-24 pt-8 sm:px-8 sm:pt-14">
        <div className="lp-rise mx-auto max-w-[680px] text-center">
          <p className="lp-label">Connect</p>
          <h1 className="lp-heading mt-5 text-[2.6rem] leading-[1.04] sm:text-[3.75rem]">Find your branch.</h1>
          <p className="mx-auto mt-5 max-w-[480px] text-[17px] leading-[1.6] text-[var(--lp-muted)]">
            Search by city, state or branch name, then open the welcome form for the branch you visited.
          </p>

          <label className="relative mx-auto mt-9 block max-w-[560px]">
            <span className="sr-only">Search branches</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="pointer-events-none absolute left-5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--lp-muted)]">
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="City, state or branch name"
              className="lp-input !h-14 !rounded-full !pl-12 text-[16px]"
            />
          </label>
        </div>

        {query.trim() && sortedOptions.length === 0 ? (
          <p className="mx-auto mt-8 max-w-[560px] rounded-2xl bg-[var(--lp-panel)] px-5 py-4 text-center text-[14px] text-[var(--lp-muted)]">
            No branch matched &ldquo;{query.trim()}&rdquo;. Try a nearby city or the branch name. All branches are listed below.
          </p>
        ) : null}

        <section className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibleOptions.map((option) => (
            <Link
              key={option._id}
              href={`/intake/${option.slug}`}
              className="lp-card group flex flex-col p-7"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-[12px] font-medium text-[var(--lp-ink)]">
                  {option.badge || "First-timer form"}
                </span>
                {option.branch?.state ? (
                  <span className="rounded-full bg-white px-3 py-1 text-[12px] font-medium text-[var(--lp-muted)]">
                    {option.branch.state}
                  </span>
                ) : null}
              </div>

              <h2 className="lp-heading mt-8 text-[24px] leading-[1.15]">{option.branch?.name || option.title}</h2>
              <p className="mt-2 text-[14px] leading-[1.6] text-[var(--lp-muted)]">
                {option.branch?.address
                  ? `${option.branch.address}, ${option.branch.city}, ${option.branch.state}`
                  : option.subtitle || "Public first-timer form"}
              </p>

              <dl className="mt-6 space-y-2 text-[14px]">
                {option.branch?.serviceTimes ? (
                  <div className="flex gap-2">
                    <dt className="text-[var(--lp-muted)]">Services</dt>
                    <dd className="text-[var(--lp-ink)]">{option.branch.serviceTimes}</dd>
                  </div>
                ) : null}
                {option.branch?.contactInfo ? (
                  <div className="flex gap-2">
                    <dt className="text-[var(--lp-muted)]">Contact</dt>
                    <dd className="text-[var(--lp-ink)]">{option.branch.contactInfo}</dd>
                  </div>
                ) : null}
              </dl>

              <span className="mt-auto inline-flex items-center gap-2 pt-8 text-[15px] font-medium text-[var(--lp-ink)]">
                Open welcome form
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 transition-transform group-hover:translate-x-1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
