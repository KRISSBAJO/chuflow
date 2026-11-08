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
import { MemberCustomFields, memberFieldPayload, useMemberFields } from "@/components/member-custom-fields";

export function ConvertGuestForm({}: { guests: GuestListItem[] }) {
  const router = useRouter();
  const t = useTranslations("people.guests.convert");

  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string>();
  const { form, failed } = useMemberFields(selected, Boolean(selected));
  const tf = useTranslations("admin.settings.guestFields");

  async function handleSubmit(formData: FormData) {
    if (!form) return;
    setLoading(true);

    try {
      const guestId = formData.get("guestId");
      if (!guestId) throw new Error(t("selectGuest"));
      const response = await fetch(`${API_URL}/members/convert/${guestId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(memberFieldPayload(form, formData)),
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
        <GuestConversionPicker onSelect={setSelected} />
      </Field>
      {failed ? <p role="alert">{tf("memberLoadFailed")}</p> : null}
      {form?.fields.length ? <MemberCustomFields key={selected} fields={form.fields} values={form.values} /> : null}
      <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button type="submit" variant="flame" disabled={loading || !selected || !form}>
          {loading ? t("converting") : t("convertGuest")}
        </Button>
      </div>
    </form>
  );
}
