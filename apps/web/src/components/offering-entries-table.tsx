"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/app/icons";
import { Badge, Button, EmptyState, Field } from "@/components/ui/ui";
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
      <EmptyState icon="finance" title="No offerings">
        No offering entries match the current scope or filters.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const availableServiceTypes = serviceTypes.filter(
          (serviceType) =>
            getBranchId(serviceType.branchId) === entry.branchId?._id,
        );
        const enteredBy = [entry.createdBy?.firstName, entry.createdBy?.lastName]
          .filter(Boolean)
          .join(" ");

        return (
          <details
            key={entry._id}
            className="group rounded-2xl border border-black/[0.06] transition-colors hover:border-black/[0.12] open:border-black/[0.12]"
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
              <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-[#111111]">
                    {entry.offeringTypeLabel} · {entry.serviceTypeLabel}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-[#8a8780]">
                    {entry.branchId?.name} · {formatDate(entry.serviceDate)} ·{" "}
                    {entry.serviceLabel || entry.serviceTypeLabel}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className="text-[14px] font-semibold tabular-nums text-emerald-700">
                    {formatMoney(entry.amount, entry.currency)}
                  </span>
                  {entry.accountId?.name ? <Badge tone="info">{entry.accountId.name}</Badge> : null}
                  {enteredBy ? <Badge>{enteredBy}</Badge> : null}
                </div>
              </div>
              <Icon
                name="chevronDown"
                className="h-4 w-4 shrink-0 text-[#8a8780] transition-transform group-open:rotate-180"
              />
            </summary>

            <div className="border-t border-black/[0.06] px-4 py-5">
              {entry.permissions.canEdit ? (
                <form
                  action={(formData) => updateEntry(entry._id, formData)}
                  className="grid gap-4 md:grid-cols-2"
                >
                  <Field label="Service date">
                    <input
                      name={`serviceDate-${entry._id}`}
                      type="datetime-local"
                      defaultValue={new Date(entry.serviceDate).toISOString().slice(0, 16)}
                      className="ui-input"
                    />
                  </Field>
                  <Field label="Service type">
                    <select
                      name={`serviceTypeId-${entry._id}`}
                      defaultValue={entry.serviceTypeId?._id || ""}
                      className="ui-input"
                    >
                      {availableServiceTypes.map((serviceType) => (
                        <option key={serviceType._id} value={serviceType._id}>
                          {serviceType.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Offering type">
                    <select
                      name={`offeringTypeId-${entry._id}`}
                      defaultValue={entry.offeringTypeId?._id || ""}
                      className="ui-input"
                    >
                      {offeringTypes.map((offeringType) => (
                        <option key={offeringType._id} value={offeringType._id}>
                          {offeringType.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Account">
                    <select
                      name={`accountId-${entry._id}`}
                      defaultValue={entry.accountId?._id || ""}
                      className="ui-input"
                    >
                      <option value="">Use default account</option>
                      {accounts.map((account) => (
                        <option key={account._id} value={account._id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Amount">
                    <input
                      name={`amount-${entry._id}`}
                      type="number"
                      min="0.01"
                      step="0.01"
                      defaultValue={entry.amount}
                      className="ui-input tabular-nums"
                    />
                  </Field>
                  <Field label="Notes" className="md:col-span-2">
                    <textarea
                      name={`notes-${entry._id}`}
                      defaultValue={entry.notes || ""}
                      className="ui-input"
                    />
                  </Field>
                  <div className="flex flex-col gap-3 md:col-span-2 md:flex-row md:items-center md:justify-between">
                    <p className="text-[13px] leading-[1.5] text-[#6b6b6b]">{entry.permissions.reason}</p>
                    <Button type="submit" disabled={loadingId === entry._id || pending}>
                      {loadingId === entry._id ? "Saving..." : "Update offering"}
                    </Button>
                  </div>
                </form>
              ) : (
                <p className="flex items-start gap-2 rounded-xl border border-black/[0.06] px-4 py-3 text-[13px] leading-[1.5] text-[#6b6b6b]">
                  <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0 text-[#8a8780]" />
                  {entry.permissions.reason}
                </p>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
