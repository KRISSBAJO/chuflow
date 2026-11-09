"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MemberCustomFields, memberFieldPayload } from "@/components/member-custom-fields";
import { Button, Field } from "@/components/ui/ui";
import type { GuestStaffForm } from "@/lib/guest-fields";
import { campMajorUnit } from "@/lib/youth-camp-money";

type Registration = { name: string; program: string; minAge: number; maxAge: number; guardianUnderAge: number; eventDate?: string; venue?: string; consentVersion: number; form: GuestStaffForm;
  campEndDate?: string; currency?: string; feeMinor?: number; depositMinor?: number; branchName?: string };

export function YouthRegistrationForm({ token, apiBase }: { token: string; apiBase: string }) {
  const t = useTranslations("youth");
  const locale = useLocale();
  const [form, setForm] = useState<Registration | null>();
  const [birthDate, setBirthDate] = useState("");
  const [contact, setContact] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [received, setReceived] = useState(false);
  const [error, setError] = useState<"failed" | "unavailable" | "checkDetails">();
  const [busy, setBusy] = useState(false);
  const endpoint = apiBase + "/youth-registration";
  useEffect(() => {
    const abort = new AbortController();
    void fetch(endpoint, { headers: { "x-youth-registration": token }, signal: abort.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error();
        setForm(await response.json() as Registration);
      }).catch(() => { if (!abort.signal.aborted) setForm(null); });
    return () => abort.abort();
  }, [endpoint, token]);

  if (received) return <section className="app-card space-y-2 p-6"><h1 className="text-2xl font-semibold">{t("received")}</h1><p>{t("receivedHint")}</p></section>;
  if (!form) return <p role="status">{t(form === null ? "unavailable" : "loading")}</p>;
  const today = new Date().toISOString().slice(0, 10);
  const ageAt = (date: string) => birthDate ? Number(date.slice(0, 4)) - Number(birthDate.slice(0, 4)) - (date.slice(5) < birthDate.slice(5) ? 1 : 0) : null;
  const age = ageAt(today);
  const eventAge = ageAt(form.eventDate ?? today);
  const guardian = age !== null && age < form.guardianUnderAge;
  const offersReminders = guardian && Boolean(form.eventDate) && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(contact.trim());
  const ageValid = eventAge !== null && birthDate <= today && eventAge >= form.minAge && eventAge <= form.maxAge;
  const dateLabel = (date: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(date));
  const currency = form.currency;
  const money = currency ? new Intl.NumberFormat(locale, { style: "currency", currency }) : undefined;
  return <section className="app-card space-y-5 p-5 sm:p-8">
    <header><p className="text-sm font-semibold text-orange-800">{form.program}</p><h1 className="text-3xl font-semibold">{form.name}</h1>
      {form.eventDate ? <p className="mt-2 text-sm">{dateLabel(form.eventDate)}{form.campEndDate && form.campEndDate !== form.eventDate ? ` – ${dateLabel(form.campEndDate)}` : ""} · {form.venue}</p> : null}
      {form.branchName ? <p className="mt-2 text-sm">{t("branch")} · {form.branchName}</p> : null}
      {money && currency && form.feeMinor ? <p className="mt-2 text-sm">{t("campPublicFees", {
        fee: money.format(form.feeMinor / campMajorUnit(currency)), deposit: money.format((form.depositMinor ?? 0) / campMajorUnit(currency)),
      })}</p> : null}
      <p className="mt-2 text-sm text-neutral-600">{t("ages", { from: form.minAge, to: form.maxAge })}</p></header>
    <form className="space-y-4" onSubmit={async event => {
      event.preventDefault();
      if (busy || !accepted || !ageValid) return;
      const data = new FormData(event.currentTarget);
      setBusy(true);
      setError(undefined);
      try {
        const response = await fetch(endpoint, {
          method: "POST", headers: { "x-youth-registration": token, "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: data.get("firstName"), lastName: data.get("lastName"), birthDate,
            contact: data.get("contact"), ...(guardian ? { guardianName: data.get("guardianName") } : {}),
            consent: true, consentVersion: form.consentVersion, locale, ...memberFieldPayload(form.form, data),
            ...(offersReminders ? { guardianEmailOptIn: data.has("guardianEmailOptIn") } : {}),
            ...(form.campEndDate ? { transportConsent: data.has("transportConsent") } : {}),
          }),
        });
        if (response.ok) setReceived(true);
        else setError(response.status === 400 ? "checkDetails" : response.status === 404 ? "unavailable" : "failed");
      } catch {
        setError("failed");
      } finally {
        setBusy(false);
      }
    }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("firstName")}><input name="firstName" className="ui-input" maxLength={80} required /></Field>
        <Field label={t("lastName")}><input name="lastName" className="ui-input" maxLength={80} required /></Field>
      </div>
      <Field label={t("birthDate")}><input type="date" max={today} className="ui-input" required value={birthDate} onChange={event => {
        setBirthDate(event.target.value);
        setAccepted(false);
      }} /></Field>
      {age !== null && !ageValid ? <p role="alert" className="text-sm text-red-800">{t("outsideRange")}</p> : null}
      {ageValid ? <>
        {guardian ? <Field label={t("guardianName")}><input name="guardianName" className="ui-input" maxLength={160} required /></Field> : null}
        <Field label={t(guardian ? "guardianContact" : "contact")}><input name="contact" className="ui-input" maxLength={120} required value={contact} onChange={event => setContact(event.target.value)} /></Field>
        {offersReminders ? <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="guardianEmailOptIn" />{t("guardianMessaging.optIn")}
        </label> : null}
        {form.form.fields.length ? <MemberCustomFields fields={form.form.fields} /> : null}
        {form.campEndDate ? <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="transportConsent" />{t(guardian ? "campGuardianTransport" : "campAdultTransport")}
        </label> : null}
        <label className="flex items-start gap-2 rounded-xl bg-orange-50 p-4 text-sm text-orange-950">
          <input type="checkbox" required checked={accepted} onChange={event => setAccepted(event.target.checked)} />
          {form.eventDate ? t(guardian ? "eventGuardianConsent" : "eventAdultConsent") : t(guardian ? "guardianConsent" : "adultConsent")}
        </label>
      </> : null}
      {error ? <p role="alert" className="text-sm text-red-800">{t(error)}</p> : null}
      <Button type="submit" disabled={busy || !ageValid || !accepted}>{t("submit")}</Button>
    </form>
  </section>;
}
