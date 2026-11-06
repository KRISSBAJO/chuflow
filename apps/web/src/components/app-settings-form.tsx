"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { Button, Card, Field } from "@/components/ui/ui";
import type { SettingsOverview } from "@/lib/types";

export function AppSettingsForm({
  app,
}: {
  app: SettingsOverview["app"];
}) {
  const t = useTranslations("admin.settings.app");
  const tc = useTranslations("common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/settings/app`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          organizationName: formData.get("organizationName"),
          organizationTagline: formData.get("organizationTagline"),
          publicConnectEnabled: formData.get("publicConnectEnabled") === "on",
          defaultReportDays: Number(formData.get("defaultReportDays") || app.defaultReportDays),
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
          <Field label={t("organisationName")}>
            <input name="organizationName" defaultValue={app.organizationName} className="ui-input" />
          </Field>
          <Field label={t("tagline")}>
            <input name="organizationTagline" defaultValue={app.organizationTagline} className="ui-input" />
          </Field>
          <Field label={t("defaultReportRange")} hint={t("defaultReportRangeHint")}>
            <select name="defaultReportDays" defaultValue={String(app.defaultReportDays)} className="ui-input">
              {[7, 14, 30, 60, 90].map((value) => (
                <option key={value} value={value}>
                  {t("lastDays", { count: value })}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <label className="mt-5 flex items-start gap-3 rounded-2xl bg-[#f6f5f1] px-4 py-3.5">
          <input
            type="checkbox"
            name="publicConnectEnabled"
            defaultChecked={app.publicConnectEnabled}
            className="mt-0.5 h-4 w-4 accent-[#111111]"
          />
          <span>
            <span className="block text-[14px] font-medium text-[#111111]">{t("publicConnect")}</span>
            <span className="mt-0.5 block text-[13px] leading-[1.55] text-[#6b6b6b]">
              {t("publicConnectHelp")}
            </span>
          </span>
        </label>

        <div className="mt-6 flex justify-end border-t border-black/[0.06] pt-5">
          <Button type="submit" disabled={loading}>
            {loading ? tc("saving") : t("save")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
