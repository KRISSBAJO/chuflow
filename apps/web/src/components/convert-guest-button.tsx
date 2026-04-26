"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";

export function ConvertGuestButton({ guestId }: { guestId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleConvert() {
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch(`${API_URL}/members/convert/${guestId}`, {
        method: "POST",
        credentials: "include",
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to convert guest");
      }

      setStatus("Guest converted to member.");
      router.push(`/members/${result._id || result.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to convert guest");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="surface rounded-[32px] p-6">
      <p className="eyebrow">Conversion</p>
      <h2 className="mt-3 text-2xl font-semibold text-slate-950">Promote this guest into membership</h2>
      <p className="mt-4 text-sm leading-7 text-slate-600">
        Use this when the guest has returned and is ready to move into the member record flow.
      </p>
      <button onClick={handleConvert} disabled={loading} className="mt-5 rounded-2xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white">
        {loading ? "Converting..." : "Convert guest to member"}
      </button>
      {status ? <p className="mt-3 text-sm text-slate-600">{status}</p> : null}
    </section>
  );
}
