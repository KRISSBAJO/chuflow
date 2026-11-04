"use client";

import { useRouter } from "next/navigation";
import { createdHref } from "@/lib/directory";
import { useState } from "react";
import { Button, Field } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";
import type { GuestListItem } from "@/lib/types";

export function ConvertGuestForm({ guests }: { guests: GuestListItem[] }) {
  const router = useRouter();
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
      router.push(createdHref(`/members/${result._id}`, result, "Member"));
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to convert guest");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit}>
      <Field label="Guest" required>
        <select name="guestId" className="ui-input" required>
          <option value="">Select guest</option>
          {guests.map((guest) => (
            <option key={guest._id} value={guest._id}>
              {guest.firstName} {guest.lastName}
            </option>
          ))}
        </select>
      </Field>
      <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        {status ? <p className="text-[13px] text-[#55534e] sm:mr-auto">{status}</p> : null}
        <Button type="submit" variant="flame" disabled={loading}>
          {loading ? "Converting..." : "Convert guest"}
        </Button>
      </div>
    </form>
  );
}
