"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BranchSummary, DistrictOption, OversightRegionOption } from "@/lib/types";

type FollowUpScopeFilterBarProps = {
  canChooseRegion: boolean;
  canChooseDistrict: boolean;
  canChooseBranch: boolean;
  oversightRegion?: string;
  district?: string;
  branchId?: string;
  status?: string;
  search?: string;
  oversightRegions: OversightRegionOption[];
  districts: DistrictOption[];
  branches: BranchSummary[];
};

function buildFollowUpHref(filters: {
  oversightRegion?: string;
  district?: string;
  branchId?: string;
  status?: string;
  search?: string;
}) {
  const query = new URLSearchParams();

  if (filters.oversightRegion) {
    query.set("oversightRegion", filters.oversightRegion);
  }

  if (filters.district) {
    query.set("district", filters.district);
  }

  if (filters.branchId) {
    query.set("branchId", filters.branchId);
  }

  if (filters.status) {
    query.set("status", filters.status);
  }

  if (filters.search) {
    query.set("search", filters.search);
  }

  return query.toString() ? `/follow-up?${query.toString()}` : "/follow-up";
}

export function FollowUpScopeFilterBar({
  canChooseRegion,
  canChooseDistrict,
  canChooseBranch,
  oversightRegion,
  district,
  branchId,
  status,
  search,
  oversightRegions,
  districts,
  branches,
}: FollowUpScopeFilterBarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedRegion, setSelectedRegion] = useState(oversightRegion || "");
  const [selectedDistrict, setSelectedDistrict] = useState(district || "");
  const [selectedBranchId, setSelectedBranchId] = useState(branchId || "");
  const [selectedStatus, setSelectedStatus] = useState(status || "");
  const [searchDraft, setSearchDraft] = useState(search || "");

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
    oversightRegion?: string;
    district?: string;
    branchId?: string;
    status?: string;
    search?: string;
  }) => {
    startTransition(() => {
      router.push(
        buildFollowUpHref({
          oversightRegion: next.oversightRegion ?? selectedRegion,
          district: next.district ?? selectedDistrict,
          branchId: next.branchId ?? selectedBranchId,
          status: next.status ?? selectedStatus,
          search: next.search ?? searchDraft,
        }),
      );
    });
  };

  return (
    <section className="surface rounded-[24px] p-5">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
            Scope filters
          </span>
          <span className="text-sm text-slate-500">
            Monitor broadly, then narrow to the branch before assigning a guest.
          </span>
          {isPending ? (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">
              Updating
            </span>
          ) : null}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_1.15fr_1.15fr_0.9fr_1.2fr]">
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
              Stage
            </span>
            <select
              value={selectedStatus}
              disabled={isPending}
              onChange={(event) => {
                const nextStatus = event.target.value;
                setSelectedStatus(nextStatus);
                pushFilters({ status: nextStatus });
              }}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="">All stages</option>
              <option value="new">New</option>
              <option value="assigned">Assigned</option>
              <option value="contacted">Contacted</option>
              <option value="prayed_with">Prayed with</option>
              <option value="invited_back">Invited back</option>
              <option value="returned">Returned</option>
              <option value="converted">Converted</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Search
            </span>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                pushFilters({ search: searchDraft });
              }}
              className="flex gap-2"
            >
              <input
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Guest or note"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
              />
              <button className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                Go
              </button>
            </form>
          </label>
        </div>
      </div>
    </section>
  );
}
