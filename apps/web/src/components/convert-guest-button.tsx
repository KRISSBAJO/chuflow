"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/ui";
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
    <section className="rounded-2xl bg-[#f6f5f1] p-5">
      <p className="text-[13px] font-medium text-[#6b6b6b]">Conversion</p>
      <h2 className="lp-heading mt-1 text-[18px] leading-tight">Welcome this guest into membership</h2>
      <p className="mt-1.5 text-[14px] leading-[1.6] text-[#6b6b6b]">
        Use this when the guest has returned and is ready to become a member.
      </p>
      <Button variant="flame" onClick={handleConvert} disabled={loading} className="mt-4">
        {loading ? "Converting..." : "Convert guest to member"}
      </Button>
      {status ? <p className="mt-3 text-[13px] text-[#55534e]">{status}</p> : null}
    </section>
  );
}
