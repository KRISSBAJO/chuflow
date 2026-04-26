"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import type { FinanceAccountSummary } from "@/lib/types";

export function FinanceAccountManagementCard({
  accounts,
}: {
  accounts: FinanceAccountSummary[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function createAccount(formData: FormData) {
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/finance/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: formData.get("name"),
          key: formData.get("key") || undefined,
          description: formData.get("description") || undefined,
          isActive: formData.get("isActive") === "on",
          sortOrder: Number(formData.get("sortOrder") || 0),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to create account");
      }

      toast.success("Finance account created", {
        description: "This account is now available across branch ledger workflows.",
      });
      router.refresh();
    } catch (error) {
      toast.error("Finance account not created", {
        description: error instanceof Error ? error.message : "Unable to create account",
      });
    } finally {
      setLoading(false);
    }
  }

  async function updateAccount(id: string, formData: FormData) {
    setLoadingId(id);

    try {
      const response = await fetch(`${API_URL}/finance/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: formData.get(`name-${id}`),
          key: formData.get(`key-${id}`) || undefined,
          description: formData.get(`description-${id}`) || undefined,
          isActive: formData.get(`isActive-${id}`) === "on",
          sortOrder: Number(formData.get(`sortOrder-${id}`) || 0),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to update account");
      }

      toast.success("Finance account updated", {
        description: "Ledger routing will now use the latest account setup.",
      });
      router.refresh();
    } catch (error) {
      toast.error("Finance account update failed", {
        description: error instanceof Error ? error.message : "Unable to update account",
      });
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <section className="surface rounded-[24px] p-5">
      <div className="flex flex-col gap-2">
        <p className="eyebrow">Accounts / funds</p>
        <h3 className="text-lg font-semibold text-slate-950">Shared finance accounts</h3>
      </div>

      <form action={createAccount} className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <input
          name="name"
          placeholder="Account name"
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
          required
        />
        <input
          name="key"
          placeholder="Optional key"
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
        />
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
          {loading ? "Creating..." : "Create account"}
        </button>
      </form>

      <div className="mt-4 space-y-3">
        {accounts.map((account) => (
          <details key={account._id} className="rounded-[20px] border border-slate-200 bg-white">
            <summary className="cursor-pointer list-none px-4 py-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{account.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {account.key}
                    {account.isSeeded ? " · seeded default" : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    account.isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {account.isActive ? "active" : "inactive"}
                </span>
              </div>
            </summary>
            <div className="border-t border-slate-200 px-4 py-4">
              <form
                action={(formData) => updateAccount(account._id, formData)}
                className="grid gap-3"
              >
                <input
                  name={`name-${account._id}`}
                  defaultValue={account.name}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                />
                <input
                  name={`key-${account._id}`}
                  defaultValue={account.key}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                />
                <input
                  name={`sortOrder-${account._id}`}
                  type="number"
                  defaultValue={account.sortOrder}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                />
                <textarea
                  name={`description-${account._id}`}
                  defaultValue={account.description || ""}
                  className="min-h-20 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                />
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name={`isActive-${account._id}`}
                    defaultChecked={account.isActive}
                    className="h-4 w-4"
                  />
                  Active account
                </label>
                <button
                  type="submit"
                  disabled={loadingId === account._id}
                  className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white md:w-fit"
                >
                  {loadingId === account._id ? "Saving..." : "Update account"}
                </button>
              </form>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
