"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
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
    <form action={handleSubmit} className="space-y-4 rounded-[28px] bg-white p-6">
      <div>
        <p className="eyebrow">Personal defaults</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">
          Preferences that shape your own workspace
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          These values change how the app feels for you without changing the ministry data itself.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Interface density</span>
          <select
            name="interfaceDensity"
            defaultValue={preferences.interfaceDensity}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Default report range</span>
          <select
            name="defaultReportDays"
            defaultValue={String(preferences.defaultReportDays)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          >
            {[7, 14, 30, 60, 90].map((value) => (
              <option key={value} value={value}>
                Last {value} days
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
      >
        {loading ? "Saving..." : "Save my preferences"}
      </button>
    </form>
  );
}
