"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-white px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[32px] border border-white/70 bg-white/90 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-700">
            Public Connect
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950">
            Find the right Winners Chapel branch before you start your first-timer form
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
            Type your city, state, or branch name and we will bring the best branch options
            forward. If you are in Tennessee and there are multiple branches, the Tennessee
            branches will rise to the top first.
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Search by city, state, branch, or address
              </span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nashville, Tennessee, Atlanta, Antioch..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
            </label>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-sm font-semibold text-slate-900">Suggestion logic</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                We currently suggest branches from the branch name, address, city, and state.
                This keeps public connect branch-aware now, and gives us a clean base for deeper
                geolocation later.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          {(sortedOptions.length > 0 ? sortedOptions : options).map((option) => (
            <article
              key={option._id}
              className="rounded-[28px] border border-white/70 bg-white/95 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-orange-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-700">
                  {option.badge || "First Timer Intake"}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                  {option.branch?.state || "Branch"}
                </span>
              </div>

              <h2 className="mt-4 text-2xl font-semibold text-slate-950">
                {option.branch?.name || option.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {option.branch?.address
                  ? `${option.branch.address}, ${option.branch.city}, ${option.branch.state}`
                  : option.subtitle || "Public first-timer intake"}
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                    Service times
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    {option.branch?.serviceTimes || "See branch information"}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                    Contact
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    {option.branch?.contactInfo || "Branch contact available after selection"}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/intake/${option.slug}`}
                  className="inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
                >
                  Open first-timer form
                </Link>
              </div>
            </article>
          ))}
        </section>

        {query.trim() && sortedOptions.length === 0 ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-slate-300 bg-white px-5 py-6 text-sm text-slate-500">
            No branch matched that search yet. Try a city, state abbreviation, or the nearest branch
            name instead.
          </div>
        ) : null}
      </div>
    </div>
  );
}
