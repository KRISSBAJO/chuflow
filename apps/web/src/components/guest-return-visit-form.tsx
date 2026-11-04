"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field } from "@/components/ui/ui";
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
    <form action={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Service date and time" required>
          <input name="serviceDate" type="datetime-local" required className="ui-input" />
        </Field>
        <Field label="Service type">
          <input name="serviceType" defaultValue="Sunday service" className="ui-input" />
        </Field>
        <Field label="Note" className="md:col-span-2">
          <textarea name="notes" placeholder="Optional note about the return visit" className="ui-input" />
        </Field>
      </div>
      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        <div className="space-y-1 sm:mr-auto">
          {!branchId ? (
            <p className="text-[13px] text-red-700">Branch information is required before attendance can be recorded.</p>
          ) : null}
          {status ? <p className="text-[13px] text-[#55534e]">{status}</p> : null}
        </div>
        <Button type="submit" disabled={loading || !branchId}>
          {loading ? "Saving..." : "Record return visit"}
        </Button>
      </div>
    </form>
  );
}
