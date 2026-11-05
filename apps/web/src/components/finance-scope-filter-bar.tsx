"use client";
import { FilterPanel } from "@/components/filter-panel";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/app/icons";
import { Button } from "@/components/ui/ui";
import type {
  BranchSummary,
  DistrictOption,
  FinanceAccountSummary,
  OfferingTypeSummary,
  OversightRegionOption,
} from "@/lib/types";

type FinanceScopeFilterBarProps = {
  canChooseRegion: boolean;
  canChooseDistrict: boolean;
  canChooseBranch: boolean;
  oversightRegion?: string;
  district?: string;
  branchId?: string;
  offeringTypeId?: string;
  accountId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  oversightRegions: OversightRegionOption[];
  districts: DistrictOption[];
  branches: BranchSummary[];
  offeringTypes: OfferingTypeSummary[];
  accounts: FinanceAccountSummary[];
};

function buildFinanceHref(filters: {
  oversightRegion?: string;
  district?: string;
  branchId?: string;
  offeringTypeId?: string;
  accountId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
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

  if (filters.offeringTypeId) {
    query.set("offeringTypeId", filters.offeringTypeId);
  }

  if (filters.accountId) {
    query.set("accountId", filters.accountId);
  }

  if (filters.search) {
    query.set("search", filters.search);
  }

  if (filters.dateFrom) {
    query.set("dateFrom", filters.dateFrom);
  }

  if (filters.dateTo) {
    query.set("dateTo", filters.dateTo);
  }

  return query.toString() ? `/finance?${query.toString()}` : "/finance";
}

export function FinanceScopeFilterBar({
  canChooseRegion,
  canChooseDistrict,
  canChooseBranch,
  oversightRegion,
  district,
  branchId,
  offeringTypeId,
  accountId,
  search,
  dateFrom,
  dateTo,
  oversightRegions,
  districts,
  branches,
  offeringTypes,
  accounts,
}: FinanceScopeFilterBarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedRegion, setSelectedRegion] = useState(oversightRegion || "");
  const [selectedDistrict, setSelectedDistrict] = useState(district || "");
  const [selectedBranchId, setSelectedBranchId] = useState(branchId || "");
  const [selectedOfferingTypeId, setSelectedOfferingTypeId] = useState(offeringTypeId || "");
  const [selectedAccountId, setSelectedAccountId] = useState(accountId || "");
  const [searchDraft, setSearchDraft] = useState(search || "");
  const [fromDraft, setFromDraft] = useState(dateFrom || "");
  const [toDraft, setToDraft] = useState(dateTo || "");

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
    offeringTypeId?: string;
    accountId?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    startTransition(() => {
      router.push(
        buildFinanceHref({
          oversightRegion: next.oversightRegion ?? selectedRegion,
          district: next.district ?? selectedDistrict,
          branchId: next.branchId ?? selectedBranchId,
          offeringTypeId: next.offeringTypeId ?? selectedOfferingTypeId,
          accountId: next.accountId ?? selectedAccountId,
          search: next.search ?? searchDraft,
          dateFrom: next.dateFrom ?? fromDraft,
          dateTo: next.dateTo ?? toDraft,
        }),
      );
    });
  };

  const submitSearchAndDates = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    pushFilters({
      search: searchDraft,
      dateFrom: fromDraft,
      dateTo: toDraft,
    });
  };

  return (
    <FilterPanel><section
      className="app-rise flex flex-col gap-3 rounded-2xl border border-black/[0.06] bg-white p-3"
      style={{ animationDelay: "60ms" }}
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
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
              setSelectedAccountId("");
              pushFilters({
                oversightRegion: nextRegion,
                district: "",
                branchId: "",
                accountId: "",
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
              setSelectedAccountId("");
              pushFilters({
                district: nextDistrict,
                branchId: "",
                accountId: "",
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
          <span className="sr-only">Account</span>
          <select
            value={selectedAccountId}
            disabled={isPending}
            onChange={(event) => {
              const nextAccountId = event.target.value;
              setSelectedAccountId(nextAccountId);
              pushFilters({ accountId: nextAccountId });
            }}
            className="ui-input"
          >
            <option value="">All accounts</option>
            {accounts.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="sr-only">Offering type</span>
          <select
            value={selectedOfferingTypeId}
            disabled={isPending}
            onChange={(event) => {
              const nextOfferingTypeId = event.target.value;
              setSelectedOfferingTypeId(nextOfferingTypeId);
              pushFilters({ offeringTypeId: nextOfferingTypeId });
            }}
            className="ui-input"
          >
            <option value="">All offering types</option>
            {offeringTypes.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <form onSubmit={submitSearchAndDates} className="flex min-w-0 flex-1 gap-2">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Search</span>
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8780]"
            />
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search service, note or type"
              className="ui-input !pl-9"
            />
          </label>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        <form onSubmit={submitSearchAndDates} className="flex flex-wrap items-center gap-2">
          <label className="block w-full sm:w-[160px]">
            <span className="sr-only">From</span>
            <input
              type="date"
              value={fromDraft}
              onChange={(event) => setFromDraft(event.target.value)}
              className="ui-input"
            />
          </label>
          <span className="text-[13px] text-[#8a8780]">to</span>
          <label className="block w-full sm:w-[160px]">
            <span className="sr-only">To</span>
            <input
              type="date"
              value={toDraft}
              onChange={(event) => setToDraft(event.target.value)}
              className="ui-input"
            />
          </label>
          <Button type="submit">Apply dates</Button>
        </form>

        {isPending ? (
          <span className="flex h-8 items-center gap-2 px-2 text-[13px] text-[#8a8780]" role="status">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#e4e3df] border-t-[#ea580c]" />
            Updating
          </span>
        ) : null}
      </div>
    </section></FilterPanel>
  );
}
