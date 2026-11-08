"use client";
import { toast } from "sonner";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";
import { MemberCustomFields, memberFieldPayload, useMemberFields } from "@/components/member-custom-fields";

export function ConvertGuestButton({ guestId }: { guestId: string }) {
  const router = useRouter();
  const t = useTranslations("people.guests.convert");
  const [loading, setLoading] = useState(false);
  const { form, failed } = useMemberFields(guestId);
  const tf = useTranslations("admin.settings.guestFields");

  async function handleConvert(data: FormData) {
    if (!form) return;
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/members/convert/${guestId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(memberFieldPayload(form, data)),
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
      <form className="mt-4 space-y-4" onSubmit={(event) => { event.preventDefault(); void handleConvert(new FormData(event.currentTarget)); }}>
      {failed ? <p role="alert">{tf("memberLoadFailed")}</p> : null}
      {form?.fields.length ? <MemberCustomFields fields={form.fields} values={form.values} /> : null}
      <Button
        variant="flame"
        type="submit"
        disabled={loading || !form}
        className="mt-4"
      >
        {loading ? t("converting") : t("convertToMember")}
      </Button>
      </form>
    </section>
  );
}
