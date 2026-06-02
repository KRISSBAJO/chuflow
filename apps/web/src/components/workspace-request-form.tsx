"use client";

import Link from "next/link";
import { useState } from "react";
import { API_URL } from "@/lib/api";
import { useGeo } from "@/hooks/use-geo";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 transition focus:border-amber-400 focus:ring-3 focus:ring-amber-400/10";

const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400";

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
      setMessage("Request received. The admin team will review it and be in touch.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to send workspace request",
      );
    } finally {
      setLoading(false);
    }
  }

  if (isSuccess) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-6 w-6 text-emerald-600">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <p className="mb-1 text-base font-semibold text-emerald-900">Request sent</p>
        <p className="mb-5 text-sm text-emerald-700">{message}</p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:to-orange-500 transition-all"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-5">

      <div>
        <label className={labelClass}>Church / Organization name</label>
        <input
          name="organizationName"
          placeholder="Grace Community Church"
          className={inputClass}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Primary contact</label>
          <input
            name="contactName"
            placeholder="Pastor John Smith"
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className={labelClass}>Email address</label>
          <input
            name="email"
            type="email"
            placeholder="pastor@church.org"
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className={labelClass}>Phone number</label>
          <input
            name="phone"
            type="tel"
            placeholder="+1 (555) 000-0000"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>City</label>
          <input
            name="city"
            placeholder="Lagos, Abuja..."
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>State / Province</label>
          <select
            name="state"
            defaultValue=""
            className={inputClass}
          >
            <option value="">Select state</option>
            {states.map((state) => (
              <option key={state.code} value={state.code}>
                {state.name} ({state.code})
              </option>
            ))}
          </select>
          <input type="hidden" name="country" value={country.name} />
        </div>
        <div>
          <label className={labelClass}>Expected branches</label>
          <input
            name="branchCount"
            type="number"
            min="1"
            placeholder="e.g. 5"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Anything we should know?</label>
        <textarea
          name="notes"
          placeholder="Your church structure, special requirements, timeline..."
          className={`${inputClass} min-h-[96px] resize-none`}
        />
      </div>

      {message && !isSuccess && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {message}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Already set up?{" "}
          <Link
            href="/login"
            className="font-semibold text-slate-900 hover:text-amber-600 transition-colors"
          >
            Sign in →
          </Link>
        </p>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all hover:to-orange-500 disabled:opacity-60"
        >
          {loading ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Sending...
            </>
          ) : (
            <>
              Send request
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </>
          )}
        </button>
      </div>

    </form>
  );
}
