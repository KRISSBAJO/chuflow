"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Icon } from "@/components/app/icons";
import { Badge, Button, Card, CardHeader, EmptyState, Field } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";
import type { OfferingTypeSummary } from "@/lib/types";

export function OfferingTypeManagementCard({
  offeringTypes,
}: {
  offeringTypes: OfferingTypeSummary[];
}) {
  const t = useTranslations("admin.offeringTypes");
  const tc = useTranslations("common");
  const ts = useTranslations("statuses");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function createOfferingType(formData: FormData) {
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/finance/offering-types`, {
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

  async function updateOfferingType(id: string, formData: FormData) {
    setLoadingId(id);

    try {
      const response = await fetch(`${API_URL}/finance/offering-types/${id}`, {
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
    <Card className="app-rise p-6 sm:p-7" style={{ animationDelay: "120ms" }}>
      <CardHeader
        label={t("label")}
        title={t("title")}
        description={t("description")}
        action={<Badge>{t("count", { count: offeringTypes.length })}</Badge>}
      />

      <form action={createOfferingType} className="mt-6 rounded-2xl bg-[#f6f5f1] p-4 sm:p-5">
        <p className="text-[14px] font-semibold text-[#111111]">{t("addTitle")}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px]">
          <Field label={t("name")} required>
            <input name="name" placeholder={t("namePlaceholder")} className="ui-input" required />
          </Field>
          <Field label={t("key")}>
            <input name="key" placeholder={t("keyPlaceholder")} className="ui-input" />
          </Field>
          <Field label={t("sortOrder")}>
            <input name="sortOrder" type="number" defaultValue={0} className="ui-input tabular-nums" />
          </Field>
          <Field label={t("descriptionLabel")} className="sm:col-span-3">
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
        {offeringTypes.length === 0 ? (
          <EmptyState icon="finance" title={t("emptyTitle")}>
            {t("emptyBody")}
          </EmptyState>
        ) : null}
        {offeringTypes.map((offeringType) => (
          <details
            key={offeringType._id}
            className="group rounded-2xl border border-black/[0.06] transition-colors hover:border-black/[0.12] open:border-black/[0.12]"
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-[#111111]">{offeringType.name}</p>
                <p className="mt-0.5 truncate text-[12px] text-[#8a8780]">
                  {offeringType.key}
                  {offeringType.isSeeded ? ` · ${t("default")}` : ""}
                </p>
              </div>
              <Badge tone={offeringType.isActive ? "success" : "neutral"} dot>
                {offeringType.isActive ? ts("active") : ts("inactive")}
              </Badge>
              <Icon
                name="chevronDown"
                className="h-4 w-4 shrink-0 text-[#8a8780] transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="border-t border-black/[0.06] px-4 py-5">
              <form
                action={(formData) => updateOfferingType(offeringType._id, formData)}
                className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px]"
              >
                <Field label={t("name")}>
                  <input
                    name={`name-${offeringType._id}`}
                    defaultValue={offeringType.name}
                    className="ui-input"
                  />
                </Field>
                <Field label={t("key")}>
                  <input
                    name={`key-${offeringType._id}`}
                    defaultValue={offeringType.key}
                    className="ui-input"
                  />
                </Field>
                <Field label={t("sortOrder")}>
                  <input
                    name={`sortOrder-${offeringType._id}`}
                    type="number"
                    defaultValue={offeringType.sortOrder}
                    className="ui-input tabular-nums"
                  />
                </Field>
                <Field label={t("descriptionLabel")} className="sm:col-span-3">
                  <textarea
                    name={`description-${offeringType._id}`}
                    defaultValue={offeringType.description || ""}
                    className="ui-input"
                  />
                </Field>
                <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-3">
                  <label className="flex items-center gap-2 text-[14px] text-[#55534e]">
                    <input
                      type="checkbox"
                      name={`isActive-${offeringType._id}`}
                      defaultChecked={offeringType.isActive}
                      className="h-4 w-4 accent-[#111111]"
                    />
                    {t("activeType")}
                  </label>
                  <Button type="submit" size="sm" disabled={loadingId === offeringType._id}>
                    {loadingId === offeringType._id ? tc("saving") : t("update")}
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
