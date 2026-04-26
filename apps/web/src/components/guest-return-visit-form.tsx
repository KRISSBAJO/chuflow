"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";

export function GuestReturnVisitForm({
  guestId,
  branchId,
  followUpId,
}: {
  guestId: string;
  branchId?: string;
  followUpId?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setStatus(null);

    try {
      const payload = {
        branchId,
        guestId,
        serviceDate: formData.get("serviceDate"),
        serviceType: formData.get("serviceType"),
      };

      const [attendanceResponse, visitResponse] = await Promise.all([
        fetch(`${API_URL}/attendance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            ...payload,
            personType: "guest",
          }),
        }),
        fetch(`${API_URL}/visits`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            ...payload,
            visitDate: formData.get("serviceDate"),
            notes: formData.get("notes") || undefined,
          }),
        }),
      ]);

      const attendanceResult = await attendanceResponse.json();
      const visitResult = await visitResponse.json();

      if (!attendanceResponse.ok) {
        throw new Error(attendanceResult.message || "Unable to record attendance");
      }

      if (!visitResponse.ok) {
        throw new Error(visitResult.message || "Unable to record visit");
      }

      await fetch(`${API_URL}/guests/${guestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          visitStatus: "returned",
        }),
      });

      if (followUpId) {
        await fetch(`${API_URL}/follow-ups/${followUpId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            status: "returned",
            contactMethod: "attendance",
            note: formData.get("notes") || "Return visit recorded from guest profile.",
          }),
        });
      }

      setStatus("Attendance and return visit recorded.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to record return visit");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="surface rounded-[32px] p-6">
      <p className="eyebrow">Return Visit</p>
      <h2 className="mt-3 text-2xl font-semibold text-slate-950">Record attendance and mark the guest as returned</h2>
      <div className="mt-5 grid gap-3">
        <input name="serviceDate" type="datetime-local" required className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none" />
        <input name="serviceType" defaultValue="Sunday service" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none" />
        <textarea name="notes" placeholder="Optional note about the return visit" className="min-h-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none" />
      </div>
      <button type="submit" disabled={loading || !branchId} className="mt-4 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white">
        {loading ? "Saving..." : "Record return visit"}
      </button>
      {!branchId ? <p className="mt-3 text-sm text-rose-600">Branch information is required before attendance can be recorded.</p> : null}
      {status ? <p className="mt-3 text-sm text-slate-600">{status}</p> : null}
    </form>
  );
}
