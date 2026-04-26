"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
    <section className="surface rounded-[24px] p-5">
      <div className="flex flex-col gap-2">
        <p className="eyebrow">Expense categories</p>
        <h3 className="text-lg font-semibold text-slate-950">Shared expense setup</h3>
      </div>

      <form action={createCategory} className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <input
          name="name"
          placeholder="Category name"
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
          required
        />
        <input
          name="key"
          placeholder="Optional key"
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
        />
        <select
          name="defaultAccountKey"
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
        >
          <option value="">No default account</option>
          {accounts.map((account) => (
            <option key={account._id} value={account.key}>
              {account.name}
            </option>
          ))}
        </select>
        <input
          name="sortOrder"
          type="number"
          defaultValue={0}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
        />
        <textarea
          name="description"
          placeholder="Optional description"
          className="min-h-20 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
        />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4" />
          Active immediately
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white md:w-fit"
        >
          {loading ? "Creating..." : "Create category"}
        </button>
      </form>

      <div className="mt-4 space-y-3">
        {categories.map((category) => (
          <details key={category._id} className="rounded-[20px] border border-slate-200 bg-white">
            <summary className="cursor-pointer list-none px-4 py-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{category.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {category.key}
                    {category.defaultAccountKey ? ` · ${category.defaultAccountKey}` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    category.isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {category.isActive ? "active" : "inactive"}
                </span>
              </div>
            </summary>
            <div className="border-t border-slate-200 px-4 py-4">
              <form
                action={(formData) => updateCategory(category._id, formData)}
                className="grid gap-3"
              >
                <input
                  name={`name-${category._id}`}
                  defaultValue={category.name}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                />
                <input
                  name={`key-${category._id}`}
                  defaultValue={category.key}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                />
                <select
                  name={`defaultAccountKey-${category._id}`}
                  defaultValue={category.defaultAccountKey || ""}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                >
                  <option value="">No default account</option>
                  {accounts.map((account) => (
                    <option key={account._id} value={account.key}>
                      {account.name}
                    </option>
                  ))}
                </select>
                <input
                  name={`sortOrder-${category._id}`}
                  type="number"
                  defaultValue={category.sortOrder}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                />
                <textarea
                  name={`description-${category._id}`}
                  defaultValue={category.description || ""}
                  className="min-h-20 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                />
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name={`isActive-${category._id}`}
                    defaultChecked={category.isActive}
                    className="h-4 w-4"
                  />
                  Active category
                </label>
                <button
                  type="submit"
                  disabled={loadingId === category._id}
                  className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white md:w-fit"
                >
                  {loadingId === category._id ? "Saving..." : "Update category"}
                </button>
              </form>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
