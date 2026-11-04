"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/app/icons";
import { Badge, Button, EmptyState, Field, formatStatus, type BadgeTone } from "@/components/ui/ui";
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

/** "submitted" means awaiting approval here, so it reads as pending rather than done. */
function expenseStatusTone(status: string): BadgeTone {
  if (status === "approved") return "success";
  if (status === "submitted") return "warning";
  if (status === "rejected") return "danger";
  return "neutral";
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
      <EmptyState icon="finance" title="No expenses">
        No expense entries match the current scope or filters.
      </EmptyState>
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
          <details
            key={entry._id}
            className="group rounded-2xl border border-black/[0.06] transition-colors hover:border-black/[0.12] open:border-black/[0.12]"
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
              <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-[#111111]">
                    {entry.expenseCategoryLabel} · {entry.description}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-[#8a8780]">
                    {entry.branchId?.name} · {formatDate(entry.expenseDate)} · {serviceLabel}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className="text-[14px] font-semibold tabular-nums text-[#111111]">
                    {formatMoney(entry.amount, entry.currency)}
                  </span>
                  <Badge tone={expenseStatusTone(entry.status)} dot>
                    {formatStatus(entry.status)}
                  </Badge>
                  <Badge>{entry.accountLabel}</Badge>
                </div>
              </div>
              <Icon
                name="chevronDown"
                className="h-4 w-4 shrink-0 text-[#8a8780] transition-transform group-open:rotate-180"
              />
            </summary>

            <div className="border-t border-black/[0.06] px-4 py-5">
              <dl className="grid gap-3 text-[14px] md:grid-cols-3">
                <div className="rounded-xl bg-[#f6f5f1] px-4 py-3">
                  <dt className="text-[12px] text-[#8a8780]">Payee</dt>
                  <dd className="mt-0.5 text-[#111111]">{entry.payee || "Not recorded"}</dd>
                </div>
                <div className="rounded-xl bg-[#f6f5f1] px-4 py-3">
                  <dt className="text-[12px] text-[#8a8780]">Account and category</dt>
                  <dd className="mt-0.5 text-[#111111]">
                    {entry.accountLabel} · {entry.expenseCategoryLabel}
                  </dd>
                </div>
                <div className="rounded-xl bg-[#f6f5f1] px-4 py-3">
                  <dt className="text-[12px] text-[#8a8780]">Receipt</dt>
                  <dd className="mt-0.5 break-all text-[#111111]">{entry.receiptUrl || "No receipt link"}</dd>
                </div>
              </dl>

              {entry.permissions.canEdit ? (
                <form
                  action={(formData) => updateEntry(entry._id, formData)}
                  className="mt-5 grid gap-4 md:grid-cols-2"
                >
                  <Field label="Expense date">
                    <input
                      name={`expenseDate-${entry._id}`}
                      type="date"
                      defaultValue={entry.expenseDate.slice(0, 10)}
                      className="ui-input"
                    />
                  </Field>
                  <Field label="Account">
                    <select
                      name={`accountId-${entry._id}`}
                      defaultValue={entry.accountId?._id || ""}
                      className="ui-input"
                    >
                      {accounts.map((account) => (
                        <option key={account._id} value={account._id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Category">
                    <select
                      name={`expenseCategoryId-${entry._id}`}
                      defaultValue={entry.expenseCategoryId?._id || ""}
                      className="ui-input"
                    >
                      {expenseCategories.map((category) => (
                        <option key={category._id} value={category._id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Linked service">
                    <select
                      name={`serviceScheduleId-${entry._id}`}
                      defaultValue={entry.serviceScheduleId?._id || ""}
                      className="ui-input"
                    >
                      <option value="">No linked service</option>
                      {availableSchedules.map((schedule) => (
                        <option key={schedule._id} value={schedule._id}>
                          {schedule.name} · {schedule.dayOfWeek} · {schedule.startTime}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Payee or vendor">
                    <input
                      name={`payee-${entry._id}`}
                      defaultValue={entry.payee || ""}
                      placeholder="Who received the payment?"
                      className="ui-input"
                    />
                  </Field>
                  <Field label="Description">
                    <input
                      name={`description-${entry._id}`}
                      defaultValue={entry.description}
                      placeholder="Description"
                      className="ui-input"
                    />
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
                  <Field label="Currency">
                    <input
                      name={`currency-${entry._id}`}
                      defaultValue={entry.currency}
                      className="ui-input"
                    />
                  </Field>
                  <Field label="Receipt link" className="md:col-span-2">
                    <input
                      name={`receiptUrl-${entry._id}`}
                      defaultValue={entry.receiptUrl || ""}
                      placeholder="Receipt URL"
                      className="ui-input"
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
                      {loadingId === entry._id ? "Saving..." : "Update expense"}
                    </Button>
                  </div>
                </form>
              ) : (
                <p className="mt-4 flex items-start gap-2 rounded-xl border border-black/[0.06] px-4 py-3 text-[13px] leading-[1.5] text-[#6b6b6b]">
                  <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0 text-[#8a8780]" />
                  {entry.permissions.reason}
                </p>
              )}

              {entry.status === "submitted" && canApprove ? (
                <div className="mt-5 rounded-2xl bg-[#f6f5f1] p-4">
                  <p className="text-[14px] font-semibold text-[#111111]">Approval decision</p>
                  <p className="mt-0.5 text-[13px] text-[#6b6b6b]">
                    Approved expenses post to the branch ledger as debits.
                  </p>
                  <textarea
                    value={reviewNotes[entry._id] || ""}
                    onChange={(event) =>
                      setReviewNotes((current) => ({
                        ...current,
                        [entry._id]: event.target.value,
                      }))
                    }
                    placeholder="Optional approval or rejection note"
                    aria-label="Approval or rejection note"
                    className="ui-input mt-3"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => reviewEntry(entry._id, "approve")}
                      disabled={reviewingId === entry._id}
                    >
                      {reviewingId === entry._id ? "Working..." : "Approve expense"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-700 hover:bg-red-50 hover:text-red-800"
                      onClick={() => reviewEntry(entry._id, "reject")}
                      disabled={reviewingId === entry._id}
                    >
                      Reject expense
                    </Button>
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
