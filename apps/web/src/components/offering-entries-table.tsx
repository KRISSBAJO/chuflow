"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import type {
  FinanceAccountSummary,
  OfferingEntrySummary,
  OfferingTypeSummary,
  ServiceTypeSummary,
} from "@/lib/types";

function getBranchId(value: ServiceTypeSummary["branchId"]) {
  return typeof value === "string" ? value : value?._id;
}

function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function OfferingEntriesTable({
  entries,
  offeringTypes,
  serviceTypes,
  accounts,
}: {
  entries: OfferingEntrySummary[];
  offeringTypes: OfferingTypeSummary[];
  serviceTypes: ServiceTypeSummary[];
  accounts: FinanceAccountSummary[];
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function updateEntry(entryId: string, formData: FormData) {
    setLoadingId(entryId);

    try {
      const response = await fetch(`${API_URL}/finance/offerings/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          serviceDate: formData.get(`serviceDate-${entryId}`),
          serviceTypeId: formData.get(`serviceTypeId-${entryId}`),
          offeringTypeId: formData.get(`offeringTypeId-${entryId}`),
          accountId: formData.get(`accountId-${entryId}`) || undefined,
          amount: Number(formData.get(`amount-${entryId}`)),
          notes: formData.get(`notes-${entryId}`) || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to update offering");
      }

      toast.success("Offering updated", {
        description: "The finance record was saved with the latest correction.",
      });
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error("Offering update failed", {
        description:
          error instanceof Error ? error.message : "Unable to update offering",
      });
    } finally {
      setLoadingId(entryId);
      setLoadingId(null);
    }
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-500">
        No offering entries match the current scope or filters.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const availableServiceTypes = serviceTypes.filter(
          (serviceType) =>
            getBranchId(serviceType.branchId) === entry.branchId?._id,
        );

        return (
          <details key={entry._id} className="rounded-[20px] border border-slate-200 bg-white">
            <summary className="cursor-pointer list-none px-4 py-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {entry.offeringTypeLabel} · {entry.serviceTypeLabel}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {entry.branchId?.name} · {formatDate(entry.serviceDate)} ·{" "}
                    {entry.serviceLabel || entry.serviceTypeLabel}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                    {formatMoney(entry.amount, entry.currency)}
                  </span>
                  {entry.accountId?.name ? (
                    <span className="rounded-full bg-sky-50 px-2.5 py-1 font-semibold text-sky-700">
                      {entry.accountId.name}
                    </span>
                  ) : null}
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
                    {entry.createdBy?.firstName} {entry.createdBy?.lastName}
                  </span>
                </div>
              </div>
            </summary>
            <div className="border-t border-slate-200 px-4 py-4">
              {entry.permissions.canEdit ? (
                <form
                  action={(formData) => updateEntry(entry._id, formData)}
                  className="grid gap-3 md:grid-cols-2"
                >
                  <input
                    name={`serviceDate-${entry._id}`}
                    type="datetime-local"
                    defaultValue={new Date(entry.serviceDate).toISOString().slice(0, 16)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  />
                  <select
                    name={`serviceTypeId-${entry._id}`}
                    defaultValue={entry.serviceTypeId?._id || ""}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  >
                    {availableServiceTypes.map((serviceType) => (
                      <option key={serviceType._id} value={serviceType._id}>
                        {serviceType.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name={`offeringTypeId-${entry._id}`}
                    defaultValue={entry.offeringTypeId?._id || ""}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  >
                    {offeringTypes.map((offeringType) => (
                      <option key={offeringType._id} value={offeringType._id}>
                        {offeringType.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name={`accountId-${entry._id}`}
                    defaultValue={entry.accountId?._id || ""}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  >
                    <option value="">Use default account</option>
                    {accounts.map((account) => (
                      <option key={account._id} value={account._id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                  <input
                    name={`amount-${entry._id}`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    defaultValue={entry.amount}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  />
                  <textarea
                    name={`notes-${entry._id}`}
                    defaultValue={entry.notes || ""}
                    className="min-h-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none md:col-span-2"
                  />
                  <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                    {entry.permissions.reason}
                  </div>
                  <button
                    type="submit"
                    disabled={loadingId === entry._id || pending}
                    className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white md:w-fit"
                  >
                    {loadingId === entry._id ? "Saving..." : "Update offering"}
                  </button>
                </form>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  {entry.permissions.reason}
                </div>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
