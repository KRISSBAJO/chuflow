"use client";
import { FilterPanel } from "@/components/filter-panel";

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

  const selectClass =
    "h-10 w-full appearance-none rounded-xl border border-black/[0.07] bg-white bg-[length:16px] bg-[right_12px_center] bg-no-repeat pl-3.5 pr-9 text-[14px] text-[var(--lp-ink)] outline-none transition hover:border-black/[0.15] focus:border-[var(--lp-ink)] focus:shadow-[0_0_0_4px_rgba(245,158,11,0.16)] disabled:cursor-not-allowed disabled:bg-[#f6f5f1] disabled:text-[#8a8780]";
  const chevron = {
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a8780' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
  };
  const hasScopeFilter = Boolean(selectedRegion || selectedDistrict || selectedBranchId);

  return (
    <FilterPanel><section className="app-rise flex flex-col gap-3 rounded-2xl border border-black/[0.06] bg-white p-3 lg:flex-row lg:items-center" style={{ animationDelay: "60ms" }}>
      <div className="grid flex-1 gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="sr-only">National area</span>
          <select
            value={selectedRegion}
            disabled={!canChooseRegion || isPending}
            onChange={(event) => {
              const nextRegion = event.target.value;
              setSelectedRegion(nextRegion);
              setSelectedDistrict("");
              setSelectedBranchId("");
              pushFilters({ oversightRegion: nextRegion, district: "", branchId: "" });
            }}
            className={selectClass}
            style={chevron}
          >
            <option value="">All national areas</option>
            {oversightRegions.map((region) => (
              <option key={region._id} value={region.name}>
                {region.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="sr-only">District</span>
          <select
            value={selectedDistrict}
            disabled={!canChooseDistrict || isPending}
            onChange={(event) => {
              const nextDistrict = event.target.value;
              setSelectedDistrict(nextDistrict);
              setSelectedBranchId("");
              pushFilters({ district: nextDistrict, branchId: "" });
            }}
            className={selectClass}
            style={chevron}
          >
            <option value="">All districts</option>
            {filteredDistricts.map((item) => (
              <option key={item._id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="sr-only">Branch</span>
          <select
            value={selectedBranchId}
            disabled={!canChooseBranch || isPending}
            onChange={(event) => {
              const nextBranchId = event.target.value;
              setSelectedBranchId(nextBranchId);
              pushFilters({ branchId: nextBranchId });
            }}
            className={selectClass}
            style={chevron}
          >
            <option value="">All branches</option>
            {filteredBranches.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-2">
        <div role="radiogroup" aria-label="Date range" className="flex flex-1 rounded-xl bg-[#f6f5f1] p-1 lg:flex-none">
          {[7, 14, 30, 60, 90].map((value) => {
            const active = selectedDays === String(value);
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={isPending}
                onClick={() => {
                  setSelectedDays(String(value));
                  pushFilters({ days: String(value) });
                }}
                className={`flex-1 rounded-lg px-3 py-1.5 text-[13px] font-medium tabular-nums transition-all lg:flex-none ${active ? "bg-white text-[var(--lp-ink)] shadow-[0_1px_3px_rgba(17,17,17,0.1)]" : "text-[#6b6b6b] hover:text-[var(--lp-ink)]"}`}
              >
                {value}d
              </button>
            );
          })}
        </div>
        {isPending ? (
          <span className="flex h-8 items-center gap-2 px-2 text-[13px] text-[#8a8780]" role="status">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#e4e3df] border-t-[#ea580c]" />
            Updating
          </span>
        ) : hasScopeFilter && canChooseBranch ? (
          <button
            type="button"
            onClick={() => {
              setSelectedRegion("");
              setSelectedDistrict("");
              setSelectedBranchId("");
              pushFilters({ oversightRegion: "", district: "", branchId: "" });
            }}
            className="h-8 rounded-lg px-2.5 text-[13px] font-medium text-[#6b6b6b] transition-colors hover:bg-[#f6f5f1] hover:text-[var(--lp-ink)]"
          >
            Reset
          </button>
        ) : null}
      </div>
    </section></FilterPanel>
  );
}
