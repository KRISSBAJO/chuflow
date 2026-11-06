"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  submitPath = "/finance/expenses",
  onSuccess,
}: {
  defaultBranchId?: string;
  branches: Pick<BranchSummary, "_id" | "name">[];
  accounts: FinanceAccountSummary[];
  expenseCategories: ExpenseCategorySummary[];
  serviceSchedules: ServiceScheduleSummary[];
  canChooseBranch: boolean;
  submitPath?: string;
  onSuccess?: () => void;
}) {
  const t = useTranslations("admin.expenseForm");
  const tc = useTranslations("common");
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
      const response = await fetch(`${API_URL}${submitPath}`, {
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
        throw new Error(result.message || t("createError"));
      }

      toast.success(t("recordedTitle"), {
        description: t("recordedDescription"),
      });
      if (onSuccess) onSuccess();
      else router.push(createdHref("/finance?tab=expenses", result, t("entityName")));
      router.refresh();
    } catch (error) {
      toast.error(t("notRecordedTitle"), {
        description: error instanceof Error ? error.message : t("createError"),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="app-rise p-6 sm:p-7">
      <CardHeader
        label={t("label")}
        title={t("title")}
        description={t("description")}
      />

      <form action={handleSubmit} className="mt-6 grid gap-4">
        {canChooseBranch ? (
          <Field label={t("branch")} required>
            <select
              name="branchId"
              value={selectedBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              className="ui-input"
              required
            >
              <option value="">{tc("selectBranch")}</option>
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
          <Field label={t("expenseDate")} required>
            <input name="expenseDate" type="date" className="ui-input" required />
          </Field>

          <Field label={t("category")} required>
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
              <option value="">{t("selectCategory")}</option>
              {expenseCategories
                .filter((item) => item.isActive)
                .map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
            </select>
          </Field>

          <Field label={t("accountOrFund")} required>
            <select
              name="accountId"
              value={selectedAccountId}
              onChange={(event) => setSelectedAccountId(event.target.value)}
              className="ui-input"
              required
            >
              <option value="">{t("selectAccount")}</option>
              {accounts
                .filter((item) => item.isActive)
                .map((account) => (
                  <option key={account._id} value={account._id}>
                    {account.name}
                  </option>
                ))}
            </select>
          </Field>

          <Field label={t("amount")} required>
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

          <Field label={t("currency")}>
            <input name="currency" defaultValue="USD" className="ui-input" />
          </Field>

          <Field label={t("linkedService")}>
            <select name="serviceScheduleId" className="ui-input">
              <option value="">{t("noLinkedService")}</option>
              {filteredSchedules.map((schedule) => (
                <option key={schedule._id} value={schedule._id}>
                  {schedule.name} · {schedule.dayOfWeek} · {schedule.startTime}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label={t("payeeOrVendor")}>
          <input name="payee" placeholder={t("payeePlaceholder")} className="ui-input" />
        </Field>

        <Field label={t("descriptionLabel")} required>
          <input
            name="description"
            placeholder={t("descriptionPlaceholder")}
            className="ui-input"
            required
          />
        </Field>

        <Field label={t("receiptLink")} hint={t("receiptHint")}>
          <input name="receiptUrl" placeholder="https://" className="ui-input" />
        </Field>

        <Field label={t("notes")}>
          <textarea
            name="notes"
            placeholder={t("notesPlaceholder")}
            className="ui-input"
          />
        </Field>

        <div className="pt-1">
          <Button type="submit" disabled={loading}>
            {loading ? t("recording") : t("record")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
