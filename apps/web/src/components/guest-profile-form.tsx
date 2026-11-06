"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Field } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";

export function GuestProfileForm({
  guest,
  defaultBranchId,
}: {
  guest: {
    _id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    title?: string;
    gender?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    maritalStatus?: string;
    invitedBy?: string;
    heardAboutChurch?: string;
    prayerRequest?: string;
    salvationResponse?: string;
    visitStatus: string;
    branchId?: { _id?: string; name?: string };
  };
  defaultBranchId?: string;
}) {
  const router = useRouter();
  const t = useTranslations("people.guests.profile");
  const tc = useTranslations("common");
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch(`${API_URL}/guests/${guest._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          branchId: guest.branchId?._id || defaultBranchId,
          firstName: formData.get("firstName"),
          lastName: formData.get("lastName"),
          phone: formData.get("phone"),
          email: formData.get("email") || undefined,
          title: formData.get("title") || undefined,
          gender: formData.get("gender") || undefined,
          address: formData.get("address") || undefined,
          city: formData.get("city") || undefined,
          state: formData.get("state") || undefined,
          zipCode: formData.get("zipCode") || undefined,
          maritalStatus: formData.get("maritalStatus") || undefined,
          invitedBy: formData.get("invitedBy") || undefined,
          heardAboutChurch: formData.get("heardAboutChurch") || undefined,
          prayerRequest: formData.get("prayerRequest") || undefined,
          salvationResponse: formData.get("salvationResponse") || undefined,
          visitStatus: formData.get("visitStatus") || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || t("errorUpdate"));
      }

      setStatus({ text: t("updated"), ok: true });
      router.refresh();
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : t("errorUpdate"), ok: false });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <FormGroup title={t("basicInfo")}>
        <Field label={t("title")}>
          <input name="title" defaultValue={guest.title || ""} placeholder={t("titlePlaceholder")} className="ui-input" />
        </Field>
        <Field label={t("gender")}>
          <input name="gender" defaultValue={guest.gender || ""} placeholder={t("gender")} className="ui-input" />
        </Field>
        <Field label={tc("firstName")} required>
          <input name="firstName" defaultValue={guest.firstName} required placeholder={tc("firstName")} className="ui-input" />
        </Field>
        <Field label={tc("lastName")} required>
          <input name="lastName" defaultValue={guest.lastName} required placeholder={tc("lastName")} className="ui-input" />
        </Field>
      </FormGroup>

      <FormGroup title={t("contactInfo")}>
        <Field label={t("phoneNumber")} required>
          <input name="phone" defaultValue={guest.phone} required placeholder={t("phoneNumber")} className="ui-input" />
        </Field>
        <Field label={tc("email")}>
          <input name="email" defaultValue={guest.email || ""} placeholder="name@example.com" type="email" className="ui-input" />
        </Field>
      </FormGroup>

      <FormGroup title={t("additional")}>
        <Field label={t("maritalStatus")}>
          <input name="maritalStatus" defaultValue={guest.maritalStatus || ""} placeholder={t("maritalStatus")} className="ui-input" />
        </Field>
        <Field label={t("visitStatus")}>
          <input name="visitStatus" defaultValue={guest.visitStatus} placeholder={t("visitStatus")} className="ui-input" />
        </Field>
        <Field label={t("invitedBy")}>
          <input name="invitedBy" defaultValue={guest.invitedBy || ""} placeholder={t("invitedByPlaceholder")} className="ui-input" />
        </Field>
        <Field label={t("heardAbout")}>
          <input
            name="heardAboutChurch"
            defaultValue={guest.heardAboutChurch || ""}
            placeholder={t("heardAboutPlaceholder")}
            className="ui-input"
          />
        </Field>
        <Field label={t("streetAddress")} className="md:col-span-2">
          <input name="address" defaultValue={guest.address || ""} placeholder={t("streetAddress")} className="ui-input" />
        </Field>
        <Field label={t("city")}>
          <input name="city" defaultValue={guest.city || ""} placeholder={t("city")} className="ui-input" />
        </Field>
        <Field label={t("state")}>
          <input name="state" defaultValue={guest.state || ""} placeholder={t("state")} className="ui-input" />
        </Field>
        <Field label={t("zipCode")}>
          <input name="zipCode" defaultValue={guest.zipCode || ""} placeholder={t("zipCode")} className="ui-input" />
        </Field>
      </FormGroup>

      <FormGroup title={t("spiritual")}>
        <Field label={t("salvationResponse")} className="md:col-span-2">
          <input
            name="salvationResponse"
            defaultValue={guest.salvationResponse || ""}
            placeholder={t("salvationResponse")}
            className="ui-input"
          />
        </Field>
        <Field label={t("prayerRequest")} className="md:col-span-2">
          <textarea name="prayerRequest" defaultValue={guest.prayerRequest || ""} placeholder={t("prayerRequest")} className="ui-input" />
        </Field>
      </FormGroup>

      <div className="flex flex-col-reverse gap-3 border-t border-black/[0.06] pt-5 sm:flex-row sm:items-center sm:justify-end">
        {status ? (
          <p
            className={`text-[13px] sm:mr-auto ${
              status.ok ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {status.text}
          </p>
        ) : null}
        <Button type="submit" disabled={loading}>
          {loading ? t("savingChanges") : t("saveProfile")}
        </Button>
      </div>
    </form>
  );
}

function FormGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-3 text-[13px] font-medium text-[#6b6b6b]">{title}</legend>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </fieldset>
  );
}
