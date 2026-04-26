"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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

  return (
    <section className="surface rounded-[24px] p-5">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
            Finance filters
          </span>
          <span className="text-sm text-slate-500">
            Move from network view into the right branch, offering, account, and service date window.
          </span>
          {isPending ? (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">
              Updating
            </span>
          ) : null}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr_1fr_1fr_1.2fr]">
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
                setSelectedAccountId("");
                pushFilters({
                  oversightRegion: nextRegion,
                  district: "",
                  branchId: "",
                  accountId: "",
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
                setSelectedAccountId("");
                pushFilters({
                  district: nextDistrict,
                  branchId: "",
                  accountId: "",
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
              Account
            </span>
            <select
              value={selectedAccountId}
              disabled={isPending}
              onChange={(event) => {
                const nextAccountId = event.target.value;
                setSelectedAccountId(nextAccountId);
                pushFilters({ accountId: nextAccountId });
              }}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="">All accounts</option>
              {accounts.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Offering type
            </span>
            <select
              value={selectedOfferingTypeId}
              disabled={isPending}
              onChange={(event) => {
                const nextOfferingTypeId = event.target.value;
                setSelectedOfferingTypeId(nextOfferingTypeId);
                pushFilters({ offeringTypeId: nextOfferingTypeId });
              }}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="">All offering types</option>
              {offeringTypes.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Search
            </span>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                pushFilters({
                  search: searchDraft,
                  dateFrom: fromDraft,
                  dateTo: toDraft,
                });
              }}
              className="flex gap-2"
            >
              <input
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Service, note, or type"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
              />
              <button className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                Go
              </button>
            </form>
          </label>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            pushFilters({
              search: searchDraft,
              dateFrom: fromDraft,
              dateTo: toDraft,
            });
          }}
          className="grid gap-4 md:grid-cols-[1fr_1fr_auto]"
        >
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              From
            </span>
            <input
              type="date"
              value={fromDraft}
              onChange={(event) => setFromDraft(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              To
            </span>
            <input
              type="date"
              value={toDraft}
              onChange={(event) => setToDraft(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
            />
          </label>
          <button className="mt-auto rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
            Apply date range
          </button>
        </form>
      </div>
    </section>
  );
}
