"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BranchSummary, DistrictOption, OversightRegionOption } from "@/lib/types";

type DashboardScopeFilterBarProps = {
  canChooseRegion: boolean;
  canChooseDistrict: boolean;
  canChooseBranch: boolean;
  days: number;
  oversightRegion?: string;
  district?: string;
  branchId?: string;
  oversightRegions: OversightRegionOption[];
  districts: DistrictOption[];
  branches: BranchSummary[];
};

function buildDashboardHref(filters: {
  days: number | string;
  oversightRegion?: string;
  district?: string;
  branchId?: string;
}) {
  const query = new URLSearchParams();

  query.set("days", String(filters.days));

  if (filters.oversightRegion) {
    query.set("oversightRegion", filters.oversightRegion);
  }

  if (filters.district) {
    query.set("district", filters.district);
  }

  if (filters.branchId) {
    query.set("branchId", filters.branchId);
  }

  return `/dashboard?${query.toString()}`;
}

export function DashboardScopeFilterBar({
  canChooseRegion,
  canChooseDistrict,
  canChooseBranch,
  days,
  oversightRegion,
  district,
  branchId,
  oversightRegions,
  districts,
  branches,
}: DashboardScopeFilterBarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedDays, setSelectedDays] = useState(String(days));
  const [selectedRegion, setSelectedRegion] = useState(oversightRegion || "");
  const [selectedDistrict, setSelectedDistrict] = useState(district || "");
  const [selectedBranchId, setSelectedBranchId] = useState(branchId || "");

  const filteredDistricts = districts.filter(
    (item) => !selectedRegion || item.oversightRegion === selectedRegion,
  );
  const filteredBranches = branches.filter((item) => {
    if (selectedRegion && item.oversightRegion !== selectedRegion) {
      return false;
    }

    if (selectedDistrict && item.district !== selectedDistrict) {
      return false;
    }

    return true;
  });

  const pushFilters = (next: {
    days?: string;
    oversightRegion?: string;
    district?: string;
    branchId?: string;
  }) => {
    startTransition(() => {
      router.push(
        buildDashboardHref({
          days: next.days ?? selectedDays,
          oversightRegion: next.oversightRegion ?? selectedRegion,
          district: next.district ?? selectedDistrict,
          branchId: next.branchId ?? selectedBranchId,
        }),
      );
    });
  };

  return (
    <section className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-sm backdrop-blur-xl">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
            Scope filters
          </span>
          <span className="text-sm text-slate-500">
            Move from network view into a national area, district, or branch.
          </span>
          {isPending ? (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">
              Updating
            </span>
          ) : null}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_1.15fr_1.15fr_0.9fr]">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              National area
            </span>
            <select
              value={selectedRegion}
              disabled={!canChooseRegion || isPending}
              onChange={(event) => {
                const nextRegion = event.target.value;
                setSelectedRegion(nextRegion);
                setSelectedDistrict("");
                setSelectedBranchId("");
                pushFilters({
                  oversightRegion: nextRegion,
                  district: "",
                  branchId: "",
                });
              }}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="">All national areas</option>
              {oversightRegions.map((region) => (
                <option key={region._id} value={region.name}>
                  {region.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              District
            </span>
            <select
              value={selectedDistrict}
              disabled={!canChooseDistrict || isPending}
              onChange={(event) => {
                const nextDistrict = event.target.value;
                setSelectedDistrict(nextDistrict);
                setSelectedBranchId("");
                pushFilters({
                  district: nextDistrict,
                  branchId: "",
                });
              }}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="">All districts</option>
              {filteredDistricts.map((item) => (
                <option key={item._id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Branch
            </span>
            <select
              value={selectedBranchId}
              disabled={!canChooseBranch || isPending}
              onChange={(event) => {
                const nextBranchId = event.target.value;
                setSelectedBranchId(nextBranchId);
                pushFilters({ branchId: nextBranchId });
              }}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="">All branches</option>
              {filteredBranches.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Date range
            </span>
            <select
              value={selectedDays}
              disabled={isPending}
              onChange={(event) => {
                const nextDays = event.target.value;
                setSelectedDays(nextDays);
                pushFilters({ days: nextDays });
              }}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none disabled:bg-slate-50 disabled:text-slate-500"
            >
              {[7, 14, 30, 60, 90].map((value) => (
                <option key={value} value={value}>
                  Last {value} days
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </section>
  );
}
