"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { Button, Card, Field } from "@/components/ui/ui";
import type { SettingsOverview } from "@/lib/types";

export function AppSettingsForm({
  app,
}: {
  app: SettingsOverview["app"];
}) {
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
        throw new Error(result.message || "Unable to save application settings");
      }

      toast.success("Application settings saved", {
        description: "The global defaults are now live for the app.",
      });
      router.refresh();
    } catch (error) {
      toast.error("Settings update failed", {
        description:
          error instanceof Error ? error.message : "Unable to save application settings",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-6 sm:p-7">
      <form action={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Organisation name">
            <input name="organizationName" defaultValue={app.organizationName} className="ui-input" />
          </Field>
          <Field label="Tagline">
            <input name="organizationTagline" defaultValue={app.organizationTagline} className="ui-input" />
          </Field>
          <Field label="Default report range" hint="Used when a report or dashboard opens without a date range.">
            <select name="defaultReportDays" defaultValue={String(app.defaultReportDays)} className="ui-input">
              {[7, 14, 30, 60, 90].map((value) => (
                <option key={value} value={value}>
                  Last {value} days
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
            <span className="block text-[14px] font-medium text-[#111111]">Public Connect</span>
            <span className="mt-0.5 block text-[13px] leading-[1.55] text-[#6b6b6b]">
              Guests can register themselves and open forms from QR codes.
            </span>
          </span>
        </label>

        <div className="mt-6 flex justify-end border-t border-black/[0.06] pt-5">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save admin settings"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
