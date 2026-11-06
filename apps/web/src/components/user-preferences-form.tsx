"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { Button, Card, Field } from "@/components/ui/ui";
import type { SettingsOverview } from "@/lib/types";

export function UserPreferencesForm({
  preferences,
}: {
  preferences: SettingsOverview["preferences"];
}) {
  const t = useTranslations("admin.settings.preferences");
  const tc = useTranslations("common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/settings/preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          interfaceDensity: formData.get("interfaceDensity"),
          defaultReportDays: Number(formData.get("defaultReportDays") || preferences.defaultReportDays),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || t("saveError"));
      }

      toast.success(t("savedTitle"), {
        description: t("savedDescription"),
      });
      router.refresh();
    } catch (error) {
      toast.error(t("saveFailedTitle"), {
        description:
          error instanceof Error ? error.message : t("saveError"),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-6 sm:p-7">
      <form action={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("interfaceDensity")}>
            <select name="interfaceDensity" defaultValue={preferences.interfaceDensity} className="ui-input">
              <option value="comfortable">{t("comfortable")}</option>
              <option value="compact">{t("compact")}</option>
            </select>
          </Field>
          <Field label={t("defaultReportRange")}>
            <select
              name="defaultReportDays"
              defaultValue={String(preferences.defaultReportDays)}
              className="ui-input"
            >
              {[7, 14, 30, 60, 90].map((value) => (
                <option key={value} value={value}>
                  {t("lastDays", { count: value })}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-6 flex justify-end border-t border-black/[0.06] pt-5">
          <Button type="submit" variant="secondary" disabled={loading}>
            {loading ? tc("saving") : t("save")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
