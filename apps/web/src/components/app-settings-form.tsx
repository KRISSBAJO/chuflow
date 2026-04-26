"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
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
    <form action={handleSubmit} className="space-y-4 rounded-[28px] bg-white p-6">
      <div>
        <p className="eyebrow">Admin defaults</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">
          Global settings that shape the app
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Use these defaults to control public connect behavior and reporting defaults across the platform.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Organization name</span>
          <input
            name="organizationName"
            defaultValue={app.organizationName}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Tagline</span>
          <input
            name="organizationTagline"
            defaultValue={app.organizationTagline}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Default report range</span>
          <select
            name="defaultReportDays"
            defaultValue={String(app.defaultReportDays)}
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

      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
        <input
          type="checkbox"
          name="publicConnectEnabled"
          defaultChecked={app.publicConnectEnabled}
          className="h-4 w-4"
        />
        Public Connect is live for guest self-registration and QR access.
      </label>

      <button
        type="submit"
        disabled={loading}
        className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
      >
        {loading ? "Saving..." : "Save admin settings"}
      </button>
    </form>
  );
}
