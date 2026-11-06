"use client";
import { savedToastId } from "@/lib/action-feedback";
import { toast } from "sonner";
import { GuestConversionPicker } from "@/components/guest-conversion-picker";

import { useRouter } from "next/navigation";
import { createdHref } from "@/lib/directory";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Field } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";
import type { GuestListItem } from "@/lib/types";

export function ConvertGuestForm({}: { guests: GuestListItem[] }) {
  const router = useRouter();
  const t = useTranslations("people.guests.convert");

  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);

    try {
      const guestId = formData.get("guestId");
      if (!guestId) throw new Error(t("selectGuest"));
      const response = await fetch(`${API_URL}/members/convert/${guestId}`, {
        method: "POST",
        credentials: "include",
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || t("errorConvert"));
      }

      toast.success(t("converted"), { id: savedToastId(result) });
      router.push(
        createdHref(`/members/${result._id}`, result, t("entityName")),
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("errorConvert"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit}>
      <Field label={t("guest")} required>
        <GuestConversionPicker />
      </Field>
      <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button type="submit" variant="flame" disabled={loading}>
          {loading ? t("converting") : t("convertGuest")}
        </Button>
      </div>
    </form>
  );
}
