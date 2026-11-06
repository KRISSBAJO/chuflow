"use client";
import { toast } from "sonner";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";

export function ConvertGuestButton({ guestId }: { guestId: string }) {
  const router = useRouter();
  const t = useTranslations("people.guests.convert");
  const [loading, setLoading] = useState(false);

  async function handleConvert() {
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/members/convert/${guestId}`, {
        method: "POST",
        credentials: "include",
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || t("errorConvert"));
      }

      toast.success(t("converted"));
      router.push(`/members/${result._id || result.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("errorConvert"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl bg-[#f6f5f1] p-5">
      <p className="text-[13px] font-medium text-[#6b6b6b]">{t("label")}</p>
      <h2 className="lp-heading mt-1 text-[18px] leading-tight">
        {t("title")}
      </h2>
      <p className="mt-1.5 text-[14px] leading-[1.6] text-[#6b6b6b]">
        {t("description")}
      </p>
      <Button
        variant="flame"
        onClick={handleConvert}
        disabled={loading}
        className="mt-4"
      >
        {loading ? t("converting") : t("convertToMember")}
      </Button>
    </section>
  );
}
