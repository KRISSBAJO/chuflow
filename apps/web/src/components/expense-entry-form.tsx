"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import type {
  BranchSummary,
  ExpenseCategorySummary,
  FinanceAccountSummary,
  ServiceScheduleSummary,
} from "@/lib/types";

function getScheduleBranchId(value: ServiceScheduleSummary["branchId"]) {
  return typeof value === "string" ? value : value?._id;
}

export function ExpenseEntryForm({
  defaultBranchId,
  branches,
  accounts,
  expenseCategories,
  serviceSchedules,
  canChooseBranch,
}: {
  defaultBranchId?: string;
  branches: BranchSummary[];
  accounts: FinanceAccountSummary[];
  expenseCategories: ExpenseCategorySummary[];
  serviceSchedules: ServiceScheduleSummary[];
  canChooseBranch: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState(
    defaultBranchId || branches[0]?._id || "",
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");

  const filteredSchedules = useMemo(
    () =>
      serviceSchedules.filter((schedule) => {
        if (!schedule.isActive || !schedule.financeEntryEnabled) {
          return false;
        }

        if (selectedBranchId && getScheduleBranchId(schedule.branchId) !== selectedBranchId) {
          return false;
        }

        return true;
      }),
    [selectedBranchId, serviceSchedules],
  );

  async function handleSubmit(formData: FormData) {
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/finance/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          branchId: canChooseBranch ? formData.get("branchId") || undefined : defaultBranchId,
          expenseDate: formData.get("expenseDate"),
          accountId: formData.get("accountId"),
          expenseCategoryId: formData.get("expenseCategoryId"),
          serviceScheduleId: formData.get("serviceScheduleId") || undefined,
          payee: formData.get("payee") || undefined,
          description: formData.get("description"),
          amount: Number(formData.get("amount")),
          currency: formData.get("currency") || undefined,
          receiptUrl: formData.get("receiptUrl") || undefined,
          notes: formData.get("notes") || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to create expense");
      }

      toast.success("Expense recorded", {
        description:
          "The expense is now in the finance ledger and follows the approval rules for your role.",
      });
      router.refresh();
    } catch (error) {
      toast.error("Expense not recorded", {
        description: error instanceof Error ? error.message : "Unable to create expense",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="rounded-[24px] bg-white p-5">
      <div className="flex flex-col gap-2">
        <p className="eyebrow">Record expense</p>
        <h3 className="text-lg font-semibold text-slate-950">Branch expense submission</h3>
        <p className="text-sm leading-6 text-slate-500">
          Branch leadership can submit expenses, while oversight roles can enter and approve directly.
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        {canChooseBranch ? (
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Branch</span>
            <select
              name="branchId"
              value={selectedBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              required
            >
              <option value="">Select branch</option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="branchId" value={defaultBranchId ?? ""} />
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Expense date</span>
            <input
              name="expenseDate"
              type="date"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              required
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Expense category</span>
            <select
              name="expenseCategoryId"
              value={selectedCategoryId}
              onChange={(event) => {
                const nextCategoryId = event.target.value;
                setSelectedCategoryId(nextCategoryId);
                const category = expenseCategories.find((item) => item._id === nextCategoryId);
                const matchingAccount = accounts.find(
                  (account) => account.key === category?.defaultAccountKey,
                );

                if (!selectedAccountId && matchingAccount?._id) {
                  setSelectedAccountId(matchingAccount._id);
                }
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              required
            >
              <option value="">Select category</option>
              {expenseCategories
                .filter((item) => item.isActive)
                .map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Account / fund</span>
            <select
              name="accountId"
              value={selectedAccountId}
              onChange={(event) => setSelectedAccountId(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              required
            >
              <option value="">Select account</option>
              {accounts
                .filter((item) => item.isActive)
                .map((account) => (
                  <option key={account._id} value={account._id}>
                    {account.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Amount</span>
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              required
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Currency</span>
            <input
              name="currency"
              defaultValue="USD"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Linked service</span>
            <select
              name="serviceScheduleId"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            >
              <option value="">No linked service</option>
              {filteredSchedules.map((schedule) => (
                <option key={schedule._id} value={schedule._id}>
                  {schedule.name} · {schedule.dayOfWeek} · {schedule.startTime}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Payee / vendor</span>
          <input
            name="payee"
            placeholder="Who received the payment?"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Description</span>
          <input
            name="description"
            placeholder="Sound maintenance, diesel purchase, welfare support..."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Receipt URL</span>
          <input
            name="receiptUrl"
            placeholder="Optional cloud file or receipt link"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Notes</span>
          <textarea
            name="notes"
            placeholder="Optional finance note for approval or reconciliation"
            className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-4 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
      >
        {loading ? "Recording..." : "Record expense"}
      </button>
    </form>
  );
}
