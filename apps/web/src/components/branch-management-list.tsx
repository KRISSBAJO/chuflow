"use client";

import Link from "next/link";
import type { BranchOverview } from "@/lib/types";

export function BranchManagementList({
  branches,
}: {
  branches: BranchOverview[];
}) {
  return (
    <div className="space-y-3">
      {branches.map((branch) => {
        const pastorCount =
          branch.metrics.residentPastorCount + branch.metrics.associatePastorCount;
        const hasPastoralGap =
          branch.metrics.residentPastorCount === 0 ||
          branch.metrics.associatePastorCount === 0;

        return (
          <Link
            key={branch._id}
            href={`/branches/${branch._id}`}
            className="block rounded-[18px] border border-slate-200 bg-white px-4 py-4 transition hover:border-slate-300 hover:shadow-sm"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-950">
                    {branch.name}
                  </h3>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                      branch.status === "active"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {branch.status}
                  </span>
                  {hasPastoralGap ? (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                      Pastoral gap
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {[branch.city, branch.state].filter(Boolean).join(", ")} ·{" "}
                  {branch.district} · {branch.oversightRegion}
                </p>
              </div>

              <div className="grid grid-cols-4 gap-2 text-xs lg:min-w-[360px]">
                {[
                  ["Guests", branch.metrics.guestCount],
                  ["Members", branch.metrics.memberCount],
                  ["Admins", branch.metrics.branchAdminCount],
                  ["Pastors", pastorCount],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {label}
                    </p>
                    <p className="mt-1 font-semibold text-slate-950">{value}</p>
                  </div>
                ))}
              </div>

              <div className="text-sm font-semibold text-slate-700">
                Open
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
