"use client";

import Link from "next/link";
import { Icon } from "@/components/app/icons";
import { Badge, formatStatus, statusTone } from "@/components/ui/ui";
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
            className="group block rounded-2xl border border-black/[0.06] p-4 transition-colors hover:border-black/[0.12] hover:bg-[#fbfaf8] sm:p-5"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f6f5f1] text-[#111111]">
                  <Icon name="branches" className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-semibold text-[#111111]">
                      {branch.name}
                    </h3>
                    <Badge tone={statusTone(branch.status)} dot>
                      {formatStatus(branch.status)}
                    </Badge>
                    {hasPastoralGap ? (
                      <Badge tone="warning">Pastoral gap</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[13px] text-[#6b6b6b]">
                    {[branch.city, branch.state].filter(Boolean).join(", ")} ·{" "}
                    {branch.district} · {branch.oversightRegion}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <dl className="grid flex-1 grid-cols-4 gap-2 lg:min-w-[360px]">
                  {[
                    ["Guests", branch.metrics.guestCount],
                    ["Members", branch.metrics.memberCount],
                    ["Admins", branch.metrics.branchAdminCount],
                    ["Pastors", pastorCount],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-[#f6f5f1] px-3 py-2">
                      <dt className="text-[12px] text-[#8a8780]">{label}</dt>
                      <dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-[#111111]">{value}</dd>
                    </div>
                  ))}
                </dl>

                <span className="hidden items-center gap-1 text-[13px] font-medium text-[#55534e] group-hover:text-[#111111] lg:inline-flex">
                  Open
                  <Icon name="arrowRight" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
