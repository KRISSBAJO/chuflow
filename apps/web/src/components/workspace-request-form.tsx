"use client";

import Link from "next/link";
import { useState } from "react";
import { API_URL } from "@/lib/api";
import { useGeo } from "@/hooks/use-geo";

export function WorkspaceRequestForm() {
  const { country, states } = useGeo();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setMessage(null);
    setIsSuccess(false);

    try {
      const response = await fetch(`${API_URL}/workspace-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: formData.get("organizationName"),
          contactName: formData.get("contactName"),
          email: formData.get("email"),
          phone: formData.get("phone"),
          country: formData.get("country"),
          state: formData.get("state"),
          city: formData.get("city"),
          branchCount: Number(formData.get("branchCount")) || undefined,
          notes: formData.get("notes"),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        const reason = Array.isArray(result.message)
          ? result.message.join(", ")
          : result.message;
        throw new Error(reason || "Unable to send workspace request");
      }

      setIsSuccess(true);
      setMessage("Request received. The admin team will review it.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to send workspace request",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        <input
          name="organizationName"
          placeholder="Church or organization name"
          className="w-full rounded-2xl border border-slate-200 bg-[#fcfaf4] px-4 py-3.5 text-slate-900 outline-none transition focus:border-orange-300 focus:bg-white md:col-span-2"
          required
        />
        <input
          name="contactName"
          placeholder="Primary contact"
          className="w-full rounded-2xl border border-slate-200 bg-[#fcfaf4] px-4 py-3.5 text-slate-900 outline-none transition focus:border-orange-300 focus:bg-white"
          required
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          className="w-full rounded-2xl border border-slate-200 bg-[#fcfaf4] px-4 py-3.5 text-slate-900 outline-none transition focus:border-orange-300 focus:bg-white"
          required
        />
        <input
          name="phone"
          type="tel"
          placeholder="Phone"
          className="w-full rounded-2xl border border-slate-200 bg-[#fcfaf4] px-4 py-3.5 text-slate-900 outline-none transition focus:border-orange-300 focus:bg-white"
        />
        <input
          name="city"
          placeholder="City"
          className="w-full rounded-2xl border border-slate-200 bg-[#fcfaf4] px-4 py-3.5 text-slate-900 outline-none transition focus:border-orange-300 focus:bg-white"
        />

        <input type="hidden" name="country" value={country.name} />

        <select
          name="state"
          defaultValue=""
          className="w-full rounded-2xl border border-slate-200 bg-[#fcfaf4] px-4 py-3.5 text-slate-900 outline-none transition focus:border-orange-300 focus:bg-white"
        >
          <option value="">State</option>
          {states.map((state) => (
            <option key={state.code} value={state.code}>
              {state.name} ({state.code})
            </option>
          ))}
        </select>

        <input
          name="branchCount"
          type="number"
          min="1"
          placeholder="Expected branches"
          className="w-full rounded-2xl border border-slate-200 bg-[#fcfaf4] px-4 py-3.5 text-slate-900 outline-none transition focus:border-orange-300 focus:bg-white"
        />

        <textarea
          name="notes"
          placeholder="Anything we should know?"
          className="min-h-24 w-full rounded-2xl border border-slate-200 bg-[#fcfaf4] px-4 py-3.5 text-slate-900 outline-none transition focus:border-orange-300 focus:bg-white md:col-span-2"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Already provisioned?{" "}
          <Link href="/login" className="font-semibold text-slate-900">
            Go to sign in
          </Link>
        </p>

        <button
          type="submit"
          disabled={loading}
          className="rounded-2xl bg-slate-950 px-6 py-3.5 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Sending request..." : "Send request"}
        </button>
      </div>

      {message ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            isSuccess
              ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {message}
        </div>
      ) : null}
    </form>
  );
}
