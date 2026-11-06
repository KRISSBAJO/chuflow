"use client";
import { toast } from "sonner";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, Button, Card, CardHeader, Field } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";
import type { OversightRegionOption } from "@/lib/types";

export function OversightRegionEditorCard({
  region,
  canEdit,
}: {
  region: OversightRegionOption;
  canEdit: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("org.regionEditor");
  const tCommon = useTranslations("common");
  const tStatuses = useTranslations("statuses");

  const [saving, setSaving] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSaving(true);

    try {
      const response = await fetch(
        `${API_URL}/oversight-regions/${region._id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: formData.get("name"),
            isActive: formData.get("isActive") === "active",
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || t("updateError"));
      }

      toast.success(t("updated"));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("updateError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="app-rise p-6 sm:p-7">
      <CardHeader
        label={tCommon("nationalArea")}
        title={region.name}
        description={t.rich("summary", {
          districts: region.districtCount,
          branches: region.branchCount,
          n: (chunks) => <span className="tabular-nums">{chunks}</span>,
        })}
        action={
          <Badge tone={region.isActive ? "success" : "neutral"} dot>
            {region.isActive ? tStatuses("active") : tStatuses("inactive")}
          </Badge>
        }
      />

      {canEdit ? (
        <form action={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label={t("name")} required>
            <input
              name="name"
              defaultValue={region.name}
              className="ui-input"
              required
            />
          </Field>
          <Field label={tCommon("status")}>
            <select
              name="isActive"
              defaultValue={region.isActive ? "active" : "inactive"}
              className="ui-input"
            >
              <option value="active">{tStatuses("active")}</option>
              <option value="inactive">{tStatuses("inactive")}</option>
            </select>
          </Field>
          <div>
            <Button type="submit" disabled={saving}>
              {saving ? tCommon("saving") : t("save")}
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-6 rounded-xl bg-[#f6f5f1] px-4 py-3 text-[14px] leading-[1.6] text-[#55534e]">
          {t("readOnly")}
        </p>
      )}
    </Card>
  );
}
