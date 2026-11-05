"use client";
import { FilterPanel } from "@/components/filter-panel";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/ui";
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
    <FilterPanel><section
      className="app-rise flex flex-col gap-3 rounded-2xl border border-black/[0.06] bg-white p-3"
      style={{ animationDelay: "60ms" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-0.5">
        <p className="text-[13px] text-[#6b6b6b]">
          Monitor broadly, then narrow to a branch before assigning a guest.
        </p>
        {isPending ? (
          <span className="flex items-center gap-2 text-[13px] text-[#8a8780]" role="status">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#e4e3df] border-t-[#ea580c]" />
            Updating
          </span>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.3fr)]">
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
              pushFilters({
                oversightRegion: nextRegion,
                district: "",
                branchId: "",
              });
            }}
            className="ui-input"
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
              pushFilters({
                district: nextDistrict,
                branchId: "",
              });
            }}
            className="ui-input"
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
            className="ui-input"
          >
            <option value="">All branches</option>
            {filteredBranches.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="sr-only">Stage</span>
          <select
            value={selectedStatus}
            disabled={isPending}
            onChange={(event) => {
              const nextStatus = event.target.value;
              setSelectedStatus(nextStatus);
              pushFilters({ status: nextStatus });
            }}
            className="ui-input"
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

        <form
          onSubmit={(event) => {
            event.preventDefault();
            pushFilters({ search: searchDraft });
          }}
          className="flex gap-2 sm:col-span-2 xl:col-span-1"
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Search</span>
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search guest or note"
              className="ui-input"
            />
          </label>
          <Button type="submit" variant="secondary" icon="search">
            Go
          </Button>
        </form>
      </div>
    </section></FilterPanel>
  );
}
