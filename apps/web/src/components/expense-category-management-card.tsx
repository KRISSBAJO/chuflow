"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("admin.expenseCategories");
  const tc = useTranslations("common");
  const ts = useTranslations("statuses");
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
        throw new Error(result.message || t("createError"));
      }

      toast.success(t("createdTitle"), {
        description: t("createdDescription"),
      });
      router.refresh();
    } catch (error) {
      toast.error(t("createFailedTitle"), {
        description:
          error instanceof Error ? error.message : t("createError"),
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
        throw new Error(result.message || t("updateError"));
      }

      toast.success(t("updatedTitle"), {
        description: t("updatedDescription"),
      });
      router.refresh();
    } catch (error) {
      toast.error(t("updateFailedTitle"), {
        description:
          error instanceof Error ? error.message : t("updateError"),
      });
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <Card className="app-rise p-6 sm:p-7" style={{ animationDelay: "60ms" }}>
      <CardHeader
        label={t("label")}
        title={t("title")}
        description={t("description")}
        action={<Badge>{t("count", { count: categories.length })}</Badge>}
      />

      <form action={createCategory} className="mt-6 rounded-2xl bg-[#f6f5f1] p-4 sm:p-5">
        <p className="text-[14px] font-semibold text-[#111111]">{t("addTitle")}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={t("name")} required>
            <input name="name" placeholder={t("namePlaceholder")} className="ui-input" required />
          </Field>
          <Field label={t("key")}>
            <input name="key" placeholder={t("keyPlaceholder")} className="ui-input" />
          </Field>
          <Field label={t("defaultAccount")}>
            <select name="defaultAccountKey" className="ui-input">
              <option value="">{t("noDefaultAccount")}</option>
              {accounts.map((account) => (
                <option key={account._id} value={account.key}>
                  {account.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("sortOrder")}>
            <input name="sortOrder" type="number" defaultValue={0} className="ui-input tabular-nums" />
          </Field>
          <Field label={t("descriptionLabel")} className="sm:col-span-2">
            <textarea name="description" placeholder={t("descriptionPlaceholder")} className="ui-input" />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-[14px] text-[#55534e]">
            <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4 accent-[#111111]" />
            {t("activeImmediately")}
          </label>
          <Button type="submit" icon="plus" disabled={loading}>
            {loading ? t("creating") : t("create")}
          </Button>
        </div>
      </form>

      <div className="mt-5 space-y-3">
        {categories.length === 0 ? (
          <EmptyState icon="finance" title={t("emptyTitle")}>
            {t("emptyBody")}
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
                {category.isActive ? ts("active") : ts("inactive")}
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
                <Field label={t("name")}>
                  <input name={`name-${category._id}`} defaultValue={category.name} className="ui-input" />
                </Field>
                <Field label={t("key")}>
                  <input name={`key-${category._id}`} defaultValue={category.key} className="ui-input" />
                </Field>
                <Field label={t("defaultAccount")}>
                  <select
                    name={`defaultAccountKey-${category._id}`}
                    defaultValue={category.defaultAccountKey || ""}
                    className="ui-input"
                  >
                    <option value="">{t("noDefaultAccount")}</option>
                    {accounts.map((account) => (
                      <option key={account._id} value={account.key}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("sortOrder")}>
                  <input
                    name={`sortOrder-${category._id}`}
                    type="number"
                    defaultValue={category.sortOrder}
                    className="ui-input tabular-nums"
                  />
                </Field>
                <Field label={t("descriptionLabel")} className="sm:col-span-2">
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
                    {t("activeCategory")}
                  </label>
                  <Button type="submit" size="sm" disabled={loadingId === category._id}>
                    {loadingId === category._id ? tc("saving") : t("update")}
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
