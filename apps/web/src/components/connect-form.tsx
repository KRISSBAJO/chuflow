"use client";

import { useState } from "react";
import { API_URL } from "@/lib/api";

export function ConnectForm() {
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setStatus("Submitting...");

    try {
      const response = await fetch(`${API_URL}/guests/public-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: formData.get("branchId"),
          firstName: formData.get("firstName"),
          lastName: formData.get("lastName"),
          phone: formData.get("phone"),
          email: formData.get("email"),
          prayerRequest: formData.get("prayerRequest"),
          heardAboutChurch: formData.get("heardAboutChurch"),
          serviceType: "Sunday service",
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setStatus("Thank you. Your information has been received.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Submission failed");
    }
  }

  return (
    <form action={handleSubmit} className="surface rounded-[36px] bg-white/95 p-8 shadow-[0_30px_90px_rgba(15,23,42,0.12)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">First-Time Guest</p>
          <h1 className="heading mt-3 text-4xl font-semibold">Connect card</h1>
        </div>
        <div className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">
          Fast check-in
        </div>
      </div>
      <p className="mt-3 max-w-2xl text-slate-600">
        This form supports QR codes, self-service kiosks, and front-desk assisted registration.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          "Quick guest capture",
          "Auto follow-up creation",
          "Return-visit tracking",
        ].map((item) => (
          <div key={item} className="rounded-2xl bg-slate-50 px-4 py-4 text-sm font-medium text-slate-700">
            {item}
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <input name="branchId" placeholder="Branch ID" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none" required />
        <input name="firstName" placeholder="First name" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none" required />
        <input name="lastName" placeholder="Last name" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none" required />
        <input name="phone" placeholder="Phone number" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none" required />
        <input name="email" type="email" placeholder="Email" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none md:col-span-2" />
        <input name="heardAboutChurch" placeholder="How did you hear about us?" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none md:col-span-2" />
        <textarea name="prayerRequest" placeholder="Prayer request" className="min-h-32 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none md:col-span-2" />
      </div>
      <button className="mt-6 rounded-2xl bg-orange-600 px-5 py-3 font-semibold text-white transition hover:bg-orange-700">
        Submit connect card
      </button>
      {status ? <p className="mt-4 text-sm text-slate-700">{status}</p> : null}
    </form>
  );
}
