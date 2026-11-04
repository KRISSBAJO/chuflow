"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/app/icons";
import { Badge, Button, Card, CardHeader, EmptyState, Field } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";
import type { ExpenseCategorySummary, FinanceAccountSummary } from "@/lib/types";

export function ExpenseCategoryManagementCard({
  categories,
  accounts,
}: {
  categories: ExpenseCategorySummary[];
  accounts: FinanceAccountSummary[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function createCategory(formData: FormData) {
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/finance/expense-categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: formData.get("name"),
          key: formData.get("key") || undefined,
          description: formData.get("description") || undefined,
          defaultAccountKey: formData.get("defaultAccountKey") || undefined,
          isActive: formData.get("isActive") === "on",
          sortOrder: Number(formData.get("sortOrder") || 0),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to create expense category");
      }

      toast.success("Expense category created", {
        description: "Branches can now classify expenses under this shared category.",
      });
      router.refresh();
    } catch (error) {
      toast.error("Expense category not created", {
        description:
          error instanceof Error ? error.message : "Unable to create expense category",
      });
    } finally {
      setLoading(false);
    }
  }

  async function updateCategory(id: string, formData: FormData) {
    setLoadingId(id);

    try {
      const response = await fetch(`${API_URL}/finance/expense-categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: formData.get(`name-${id}`),
          key: formData.get(`key-${id}`) || undefined,
          description: formData.get(`description-${id}`) || undefined,
          defaultAccountKey: formData.get(`defaultAccountKey-${id}`) || undefined,
          isActive: formData.get(`isActive-${id}`) === "on",
          sortOrder: Number(formData.get(`sortOrder-${id}`) || 0),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to update expense category");
      }

      toast.success("Expense category updated", {
        description: "Expense classification and default account routing are up to date.",
      });
      router.refresh();
    } catch (error) {
      toast.error("Expense category update failed", {
        description:
          error instanceof Error ? error.message : "Unable to update expense category",
      });
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <Card className="app-rise p-6 sm:p-7" style={{ animationDelay: "60ms" }}>
      <CardHeader
        label="Expense categories"
        title="Expense categories"
        description="Shared categories branches use to classify spending, each with an optional default account."
        action={<Badge>{categories.length} categories</Badge>}
      />

      <form action={createCategory} className="mt-6 rounded-2xl bg-[#f6f5f1] p-4 sm:p-5">
        <p className="text-[14px] font-semibold text-[#111111]">Add a category</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Category name" required>
            <input name="name" placeholder="e.g. Utilities" className="ui-input" required />
          </Field>
          <Field label="Key">
            <input name="key" placeholder="Optional" className="ui-input" />
          </Field>
          <Field label="Default account">
            <select name="defaultAccountKey" className="ui-input">
              <option value="">No default account</option>
              {accounts.map((account) => (
                <option key={account._id} value={account.key}>
                  {account.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sort order">
            <input name="sortOrder" type="number" defaultValue={0} className="ui-input tabular-nums" />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <textarea name="description" placeholder="Optional description" className="ui-input" />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-[14px] text-[#55534e]">
            <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4 accent-[#111111]" />
            Active immediately
          </label>
          <Button type="submit" icon="plus" disabled={loading}>
            {loading ? "Creating..." : "Create category"}
          </Button>
        </div>
      </form>

      <div className="mt-5 space-y-3">
        {categories.length === 0 ? (
          <EmptyState icon="finance" title="No categories yet">
            Create the first expense category above.
          </EmptyState>
        ) : null}
        {categories.map((category) => (
          <details
            key={category._id}
            className="group rounded-2xl border border-black/[0.06] transition-colors hover:border-black/[0.12] open:border-black/[0.12]"
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-[#111111]">{category.name}</p>
                <p className="mt-0.5 truncate text-[12px] text-[#8a8780]">
                  {category.key}
                  {category.defaultAccountKey ? ` · ${category.defaultAccountKey}` : ""}
                </p>
              </div>
              <Badge tone={category.isActive ? "success" : "neutral"} dot>
                {category.isActive ? "Active" : "Inactive"}
              </Badge>
              <Icon
                name="chevronDown"
                className="h-4 w-4 shrink-0 text-[#8a8780] transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="border-t border-black/[0.06] px-4 py-5">
              <form
                action={(formData) => updateCategory(category._id, formData)}
                className="grid gap-4 sm:grid-cols-2"
              >
                <Field label="Category name">
                  <input name={`name-${category._id}`} defaultValue={category.name} className="ui-input" />
                </Field>
                <Field label="Key">
                  <input name={`key-${category._id}`} defaultValue={category.key} className="ui-input" />
                </Field>
                <Field label="Default account">
                  <select
                    name={`defaultAccountKey-${category._id}`}
                    defaultValue={category.defaultAccountKey || ""}
                    className="ui-input"
                  >
                    <option value="">No default account</option>
                    {accounts.map((account) => (
                      <option key={account._id} value={account.key}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Sort order">
                  <input
                    name={`sortOrder-${category._id}`}
                    type="number"
                    defaultValue={category.sortOrder}
                    className="ui-input tabular-nums"
                  />
                </Field>
                <Field label="Description" className="sm:col-span-2">
                  <textarea
                    name={`description-${category._id}`}
                    defaultValue={category.description || ""}
                    className="ui-input"
                  />
                </Field>
                <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
                  <label className="flex items-center gap-2 text-[14px] text-[#55534e]">
                    <input
                      type="checkbox"
                      name={`isActive-${category._id}`}
                      defaultChecked={category.isActive}
                      className="h-4 w-4 accent-[#111111]"
                    />
                    Active category
                  </label>
                  <Button type="submit" size="sm" disabled={loadingId === category._id}>
                    {loadingId === category._id ? "Saving..." : "Update category"}
                  </Button>
                </div>
              </form>
            </div>
          </details>
        ))}
      </div>
    </Card>
  );
}
