"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { Button, Card, Field } from "@/components/ui/ui";
import type { SettingsOverview } from "@/lib/types";

export function UserPreferencesForm({
  preferences,
}: {
  preferences: SettingsOverview["preferences"];
}) {
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
        throw new Error(result.message || "Unable to save your preferences");
      }

      toast.success("Preferences saved", {
        description: "Your working defaults are now active.",
      });
      router.refresh();
    } catch (error) {
      toast.error("Preferences update failed", {
        description:
          error instanceof Error ? error.message : "Unable to save your preferences",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-6 sm:p-7">
      <form action={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Interface density">
            <select name="interfaceDensity" defaultValue={preferences.interfaceDensity} className="ui-input">
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </Field>
          <Field label="Default report range">
            <select
              name="defaultReportDays"
              defaultValue={String(preferences.defaultReportDays)}
              className="ui-input"
            >
              {[7, 14, 30, 60, 90].map((value) => (
                <option key={value} value={value}>
                  Last {value} days
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-6 flex justify-end border-t border-black/[0.06] pt-5">
          <Button type="submit" variant="secondary" disabled={loading}>
            {loading ? "Saving..." : "Save my preferences"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
