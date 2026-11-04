"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/app/icons";
import { Badge, Button, Card, CardHeader, EmptyState, Field } from "@/components/ui/ui";
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
    <Card className="app-rise p-6 sm:p-7">
      <CardHeader
        label="Accounts and funds"
        title="Finance accounts"
        description="Shared accounts that offerings and expenses are posted to."
        action={<Badge>{accounts.length} accounts</Badge>}
      />

      <form action={createAccount} className="mt-6 rounded-2xl bg-[#f6f5f1] p-4 sm:p-5">
        <p className="text-[14px] font-semibold text-[#111111]">Add an account</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px]">
          <Field label="Account name" required>
            <input name="name" placeholder="e.g. Building fund" className="ui-input" required />
          </Field>
          <Field label="Key">
            <input name="key" placeholder="Optional" className="ui-input" />
          </Field>
          <Field label="Sort order">
            <input name="sortOrder" type="number" defaultValue={0} className="ui-input tabular-nums" />
          </Field>
          <Field label="Description" className="sm:col-span-3">
            <textarea name="description" placeholder="Optional description" className="ui-input" />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-[14px] text-[#55534e]">
            <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4 accent-[#111111]" />
            Active immediately
          </label>
          <Button type="submit" icon="plus" disabled={loading}>
            {loading ? "Creating..." : "Create account"}
          </Button>
        </div>
      </form>

      <div className="mt-5 space-y-3">
        {accounts.length === 0 ? (
          <EmptyState icon="finance" title="No accounts yet">
            Create the first account above.
          </EmptyState>
        ) : null}
        {accounts.map((account) => (
          <details
            key={account._id}
            className="group rounded-2xl border border-black/[0.06] transition-colors hover:border-black/[0.12] open:border-black/[0.12]"
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-[#111111]">{account.name}</p>
                <p className="mt-0.5 truncate text-[12px] text-[#8a8780]">
                  {account.key}
                  {account.isSeeded ? " · Default" : ""}
                </p>
              </div>
              <Badge tone={account.isActive ? "success" : "neutral"} dot>
                {account.isActive ? "Active" : "Inactive"}
              </Badge>
              <Icon
                name="chevronDown"
                className="h-4 w-4 shrink-0 text-[#8a8780] transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="border-t border-black/[0.06] px-4 py-5">
              <form
                action={(formData) => updateAccount(account._id, formData)}
                className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px]"
              >
                <Field label="Account name">
                  <input name={`name-${account._id}`} defaultValue={account.name} className="ui-input" />
                </Field>
                <Field label="Key">
                  <input name={`key-${account._id}`} defaultValue={account.key} className="ui-input" />
                </Field>
                <Field label="Sort order">
                  <input
                    name={`sortOrder-${account._id}`}
                    type="number"
                    defaultValue={account.sortOrder}
                    className="ui-input tabular-nums"
                  />
                </Field>
                <Field label="Description" className="sm:col-span-3">
                  <textarea
                    name={`description-${account._id}`}
                    defaultValue={account.description || ""}
                    className="ui-input"
                  />
                </Field>
                <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-3">
                  <label className="flex items-center gap-2 text-[14px] text-[#55534e]">
                    <input
                      type="checkbox"
                      name={`isActive-${account._id}`}
                      defaultChecked={account.isActive}
                      className="h-4 w-4 accent-[#111111]"
                    />
                    Active account
                  </label>
                  <Button type="submit" size="sm" disabled={loadingId === account._id}>
                    {loadingId === account._id ? "Saving..." : "Update account"}
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
