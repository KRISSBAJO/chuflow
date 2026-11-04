"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createdHref } from "@/lib/directory";
import { toast } from "sonner";
import { Button, Card, CardHeader, Field } from "@/components/ui/ui";
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
      router.push(createdHref("/finance?tab=expenses", result, "Expense"));
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
    <Card className="app-rise p-6 sm:p-7">
      <CardHeader
        label="Record expense"
        title="Submit a branch expense"
        description="Branch leaders submit expenses for approval. Oversight roles can enter and approve directly."
      />

      <form action={handleSubmit} className="mt-6 grid gap-4">
        {canChooseBranch ? (
          <Field label="Branch" required>
            <select
              name="branchId"
              value={selectedBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              className="ui-input"
              required
            >
              <option value="">Select branch</option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <input type="hidden" name="branchId" value={defaultBranchId ?? ""} />
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Expense date" required>
            <input name="expenseDate" type="date" className="ui-input" required />
          </Field>

          <Field label="Category" required>
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
              className="ui-input"
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
          </Field>

          <Field label="Account or fund" required>
            <select
              name="accountId"
              value={selectedAccountId}
              onChange={(event) => setSelectedAccountId(event.target.value)}
              className="ui-input"
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
          </Field>

          <Field label="Amount" required>
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              className="ui-input tabular-nums"
              required
            />
          </Field>

          <Field label="Currency">
            <input name="currency" defaultValue="USD" className="ui-input" />
          </Field>

          <Field label="Linked service">
            <select name="serviceScheduleId" className="ui-input">
              <option value="">No linked service</option>
              {filteredSchedules.map((schedule) => (
                <option key={schedule._id} value={schedule._id}>
                  {schedule.name} · {schedule.dayOfWeek} · {schedule.startTime}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Payee or vendor">
          <input name="payee" placeholder="Who received the payment?" className="ui-input" />
        </Field>

        <Field label="Description" required>
          <input
            name="description"
            placeholder="Sound maintenance, diesel purchase, welfare support..."
            className="ui-input"
            required
          />
        </Field>

        <Field label="Receipt link" hint="Optional link to a scanned receipt or cloud file.">
          <input name="receiptUrl" placeholder="https://" className="ui-input" />
        </Field>

        <Field label="Notes">
          <textarea
            name="notes"
            placeholder="Optional note for approval or reconciliation"
            className="ui-input"
          />
        </Field>

        <div className="pt-1">
          <Button type="submit" disabled={loading}>
            {loading ? "Recording..." : "Record expense"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
