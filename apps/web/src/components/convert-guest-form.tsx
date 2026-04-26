"use client";

import { useState } from "react";
import { API_URL } from "@/lib/api";
import type { GuestListItem } from "@/lib/types";

export function ConvertGuestForm({ guests }: { guests: GuestListItem[] }) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setStatus(null);

    try {
      const guestId = formData.get("guestId");
      const response = await fetch(`${API_URL}/members/convert/${guestId}`, {
        method: "POST",
        credentials: "include",
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to convert guest");
      }

      setStatus("Guest converted to member.");
      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to convert guest");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="rounded-[28px] bg-white p-6">
      <h3 className="text-xl font-semibold text-slate-950">Convert guest to member</h3>
      <div className="mt-5">
        <select name="guestId" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none" required>
          <option value="">Select guest</option>
          {guests.map((guest) => (
            <option key={guest._id} value={guest._id}>
              {guest.firstName} {guest.lastName}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={loading} className="mt-5 rounded-2xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white">
        {loading ? "Converting..." : "Convert guest"}
      </button>
      {status ? <p className="mt-4 text-sm text-slate-600">{status}</p> : null}
    </form>
  );
}
