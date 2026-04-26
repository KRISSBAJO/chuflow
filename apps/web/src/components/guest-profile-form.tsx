"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";

export function GuestProfileForm({
  guest,
  defaultBranchId,
}: {
  guest: {
    _id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    title?: string;
    gender?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    maritalStatus?: string;
    invitedBy?: string;
    heardAboutChurch?: string;
    prayerRequest?: string;
    salvationResponse?: string;
    visitStatus: string;
    branchId?: { _id?: string; name?: string };
  };
  defaultBranchId?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch(`${API_URL}/guests/${guest._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          branchId: guest.branchId?._id || defaultBranchId,
          firstName: formData.get("firstName"),
          lastName: formData.get("lastName"),
          phone: formData.get("phone"),
          email: formData.get("email") || undefined,
          title: formData.get("title") || undefined,
          gender: formData.get("gender") || undefined,
          address: formData.get("address") || undefined,
          city: formData.get("city") || undefined,
          state: formData.get("state") || undefined,
          zipCode: formData.get("zipCode") || undefined,
          maritalStatus: formData.get("maritalStatus") || undefined,
          invitedBy: formData.get("invitedBy") || undefined,
          heardAboutChurch: formData.get("heardAboutChurch") || undefined,
          prayerRequest: formData.get("prayerRequest") || undefined,
          salvationResponse: formData.get("salvationResponse") || undefined,
          visitStatus: formData.get("visitStatus") || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to update guest");
      }

      setStatus("Guest profile successfully updated ✓");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to update guest");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-3xl bg-white/90 p-8 shadow-sm backdrop-blur-xl border border-white/60">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.125em] text-amber-600">
          GUEST PROFILE
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          Update Guest Details
        </h2>
        <p className="mt-2 text-slate-600">
          Keep their information accurate and up to date.
        </p>
      </div>

      {/* Form */}
      <form action={handleSubmit} className="space-y-8">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Personal Info */}
          <div className="md:col-span-2">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Basic Information
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <input
                name="title"
                defaultValue={guest.title || ""}
                placeholder="Title (e.g. Mr, Mrs, Pastor)"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm outline-none focus:border-slate-400 focus:bg-white transition"
              />
              <input
                name="gender"
                defaultValue={guest.gender || ""}
                placeholder="Gender"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm outline-none focus:border-slate-400 focus:bg-white transition"
              />
              <input
                name="firstName"
                defaultValue={guest.firstName}
                required
                placeholder="First name"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm outline-none focus:border-slate-400 focus:bg-white transition"
              />
              <input
                name="lastName"
                defaultValue={guest.lastName}
                required
                placeholder="Last name"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm outline-none focus:border-slate-400 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Contact */}
          <div className="md:col-span-2">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Contact Information
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <input
                name="phone"
                defaultValue={guest.phone}
                required
                placeholder="Phone number"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm outline-none focus:border-slate-400 focus:bg-white transition"
              />
              <input
                name="email"
                defaultValue={guest.email || ""}
                placeholder="Email address"
                type="email"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm outline-none focus:border-slate-400 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Additional Details */}
          <div className="md:col-span-2">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Additional Details
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <input
                name="maritalStatus"
                defaultValue={guest.maritalStatus || ""}
                placeholder="Marital status"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm outline-none focus:border-slate-400 focus:bg-white transition"
              />
              <input
                name="visitStatus"
                defaultValue={guest.visitStatus}
                placeholder="Visit status"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm outline-none focus:border-slate-400 focus:bg-white transition"
              />
              <input
                name="invitedBy"
                defaultValue={guest.invitedBy || ""}
                placeholder="Invited by"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm outline-none focus:border-slate-400 focus:bg-white transition"
              />
              <input
                name="heardAboutChurch"
                defaultValue={guest.heardAboutChurch || ""}
                placeholder="How did they hear about us?"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm outline-none focus:border-slate-400 focus:bg-white transition"
              />

              <input
                name="address"
                defaultValue={guest.address || ""}
                placeholder="Street address"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm outline-none focus:border-slate-400 focus:bg-white transition md:col-span-2"
              />
              <input
                name="city"
                defaultValue={guest.city || ""}
                placeholder="City"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm outline-none focus:border-slate-400 focus:bg-white transition"
              />
              <input
                name="state"
                defaultValue={guest.state || ""}
                placeholder="State"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm outline-none focus:border-slate-400 focus:bg-white transition"
              />
              <input
                name="zipCode"
                defaultValue={guest.zipCode || ""}
                placeholder="Zip code"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm outline-none focus:border-slate-400 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Spiritual Info */}
          <div className="md:col-span-2">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Spiritual Information
            </p>
            <div className="grid gap-4">
              <input
                name="salvationResponse"
                defaultValue={guest.salvationResponse || ""}
                placeholder="Salvation response"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm outline-none focus:border-slate-400 focus:bg-white transition"
              />
              <textarea
                name="prayerRequest"
                defaultValue={guest.prayerRequest || ""}
                placeholder="Prayer request..."
                className="min-h-[110px] rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm outline-none focus:border-slate-400 focus:bg-white transition md:col-span-2 resize-y"
              />
            </div>
          </div>
        </div>

        {/* Submit Section */}
        <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-slate-900 px-8 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? "Saving changes..." : "Save Guest Profile"}
          </button>

          {status && (
            <p
              className={`text-center text-sm ${
                status.includes("success") || status.includes("✓")
                  ? "text-emerald-600"
                  : "text-red-600"
              }`}
            >
              {status}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}