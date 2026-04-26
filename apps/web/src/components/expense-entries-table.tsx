"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import type {
  ExpenseCategorySummary,
  ExpenseEntrySummary,
  FinanceAccountSummary,
  ServiceScheduleSummary,
} from "@/lib/types";

function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function getScheduleBranchId(value: ServiceScheduleSummary["branchId"]) {
  return typeof value === "string" ? value : value?._id;
}

export function ExpenseEntriesTable({
  entries,
  accounts,
  expenseCategories,
  serviceSchedules,
  canApprove,
}: {
  entries: ExpenseEntrySummary[];
  accounts: FinanceAccountSummary[];
  expenseCategories: ExpenseCategorySummary[];
  serviceSchedules: ServiceScheduleSummary[];
  canApprove: boolean;
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const scheduleMap = useMemo(() => {
    return new Map(serviceSchedules.map((schedule) => [schedule._id, schedule]));
  }, [serviceSchedules]);

  async function updateEntry(entryId: string, formData: FormData) {
    setLoadingId(entryId);

    try {
      const response = await fetch(`${API_URL}/finance/expenses/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          expenseDate: formData.get(`expenseDate-${entryId}`),
          accountId: formData.get(`accountId-${entryId}`),
          expenseCategoryId: formData.get(`expenseCategoryId-${entryId}`),
          serviceScheduleId: formData.get(`serviceScheduleId-${entryId}`) || undefined,
          payee: formData.get(`payee-${entryId}`) || undefined,
          description: formData.get(`description-${entryId}`),
          amount: Number(formData.get(`amount-${entryId}`)),
          currency: formData.get(`currency-${entryId}`) || undefined,
          receiptUrl: formData.get(`receiptUrl-${entryId}`) || undefined,
          notes: formData.get(`notes-${entryId}`) || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to update expense");
      }

      toast.success("Expense updated", {
        description: "The finance record was saved with the latest correction.",
      });
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error("Expense update failed", {
        description: error instanceof Error ? error.message : "Unable to update expense",
      });
    } finally {
      setLoadingId(null);
    }
  }

  async function reviewEntry(entryId: string, action: "approve" | "reject") {
    setReviewingId(entryId);

    try {
      const response = await fetch(`${API_URL}/finance/expenses/${entryId}/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          notes: reviewNotes[entryId] || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `Unable to ${action} expense`);
      }

      toast.success(action === "approve" ? "Expense approved" : "Expense rejected", {
        description:
          action === "approve"
            ? "The expense is now committed in the branch ledger."
            : "The expense has been marked rejected and removed from approval flow.",
      });
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error(`Expense ${action} failed`, {
        description:
          error instanceof Error ? error.message : `Unable to ${action} expense`,
      });
    } finally {
      setReviewingId(null);
    }
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-500">
        No expense entries match the current scope or filters.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const branchId = entry.branchId?._id || "";
        const availableSchedules = serviceSchedules.filter((schedule) => {
          if (!schedule.isActive || !schedule.financeEntryEnabled) {
            return false;
          }

          return !branchId || getScheduleBranchId(schedule.branchId) === branchId;
        });
        const serviceLabel =
          entry.serviceLabel ||
          scheduleMap.get(entry.serviceScheduleId?._id || "")?.name ||
          "No linked service";

        return (
          <details key={entry._id} className="rounded-[20px] border border-slate-200 bg-white">
            <summary className="cursor-pointer list-none px-4 py-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {entry.expenseCategoryLabel} · {entry.description}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {entry.branchId?.name} · {formatDate(entry.expenseDate)} · {serviceLabel}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">
                    {formatMoney(entry.amount, entry.currency)}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 font-semibold ${
                      entry.status === "approved"
                        ? "bg-emerald-50 text-emerald-700"
                        : entry.status === "submitted"
                          ? "bg-amber-50 text-amber-700"
                          : entry.status === "rejected"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {entry.status}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
                    {entry.accountLabel}
                  </span>
                </div>
              </div>
            </summary>
            <div className="border-t border-slate-200 px-4 py-4">
              <div className="mb-4 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Payee
                  </p>
                  <p className="mt-1">{entry.payee || "Not recorded"}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Account / Category
                  </p>
                  <p className="mt-1">
                    {entry.accountLabel} · {entry.expenseCategoryLabel}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Receipt
                  </p>
                  <p className="mt-1 break-all">{entry.receiptUrl || "No receipt link"}</p>
                </div>
              </div>

              {entry.permissions.canEdit ? (
                <form
                  action={(formData) => updateEntry(entry._id, formData)}
                  className="grid gap-3 md:grid-cols-2"
                >
                  <input
                    name={`expenseDate-${entry._id}`}
                    type="date"
                    defaultValue={entry.expenseDate.slice(0, 10)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  />
                  <select
                    name={`accountId-${entry._id}`}
                    defaultValue={entry.accountId?._id || ""}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  >
                    {accounts.map((account) => (
                      <option key={account._id} value={account._id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name={`expenseCategoryId-${entry._id}`}
                    defaultValue={entry.expenseCategoryId?._id || ""}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  >
                    {expenseCategories.map((category) => (
                      <option key={category._id} value={category._id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name={`serviceScheduleId-${entry._id}`}
                    defaultValue={entry.serviceScheduleId?._id || ""}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  >
                    <option value="">No linked service</option>
                    {availableSchedules.map((schedule) => (
                      <option key={schedule._id} value={schedule._id}>
                        {schedule.name} · {schedule.dayOfWeek} · {schedule.startTime}
                      </option>
                    ))}
                  </select>
                  <input
                    name={`payee-${entry._id}`}
                    defaultValue={entry.payee || ""}
                    placeholder="Payee / vendor"
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  />
                  <input
                    name={`description-${entry._id}`}
                    defaultValue={entry.description}
                    placeholder="Description"
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  />
                  <input
                    name={`amount-${entry._id}`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    defaultValue={entry.amount}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  />
                  <input
                    name={`currency-${entry._id}`}
                    defaultValue={entry.currency}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  />
                  <input
                    name={`receiptUrl-${entry._id}`}
                    defaultValue={entry.receiptUrl || ""}
                    placeholder="Receipt URL"
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none md:col-span-2"
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
                    {loadingId === entry._id ? "Saving..." : "Update expense"}
                  </button>
                </form>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  {entry.permissions.reason}
                </div>
              )}

              {entry.status === "submitted" && canApprove ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-900">Approval action</p>
                  <textarea
                    value={reviewNotes[entry._id] || ""}
                    onChange={(event) =>
                      setReviewNotes((current) => ({
                        ...current,
                        [entry._id]: event.target.value,
                      }))
                    }
                    placeholder="Optional approval or rejection note"
                    className="mt-3 min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => reviewEntry(entry._id, "approve")}
                      disabled={reviewingId === entry._id}
                      className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      {reviewingId === entry._id ? "Working..." : "Approve expense"}
                    </button>
                    <button
                      type="button"
                      onClick={() => reviewEntry(entry._id, "reject")}
                      disabled={reviewingId === entry._id}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                    >
                      Reject expense
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </details>
        );
      })}
    </div>
  );
}
