"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { validFormColor, formTextColor } from "@/lib/form-colors";
import { formText, type FormLanguage } from "@/lib/form-language";
import { apiPost } from "@/lib/api";
import { OUTREACH_INTERESTS, OUTREACH_METHODS } from "@/lib/evangelism";
import type { BranchSummary } from "@/lib/types";
import { Button, Card, Field } from "@/components/ui/ui";

export function OutreachContactForm({
  language = "en",
  token,
  branchName,
  branches = [],
  defaultBranchId,
  buttonColor,
  buttonTextColor,
}: {
  language?: FormLanguage;
  token?: string;
  branchName?: string;
  branches?: BranchSummary[];
  defaultBranchId?: string;
  buttonColor?: string;
  buttonTextColor?: string;
}) {
  const router = useRouter();
  const t = (value: string) => formText(value, language);
  const accent = validFormColor(buttonColor);
  const buttonText = validFormColor(buttonTextColor);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  const [method, setMethod] = useState("phone_call");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const activeFields = form.querySelector<HTMLFieldSetElement>(
      `fieldset[data-step="${step}"]`,
    );
    if (activeFields)
      for (const field of activeFields.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("input, select, textarea")) {
        field.setCustomValidity("");
        if (language === "es") {
          if (field.validity.valueMissing)
            field.setCustomValidity("Complete este campo obligatorio.");
          else if (field.validity.typeMismatch)
            field.setCustomValidity("Ingrese un valor válido para este campo.");
          else if (field.validity.tooShort)
            field.setCustomValidity("El valor ingresado es demasiado corto.");
        }
      }
    if (
      activeFields &&
      !Array.from(
        activeFields.querySelectorAll<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >("input, select, textarea"),
      ).every((field) => field.reportValidity())
    )
      return;
    if (step === 1) {
      setError("");
      setStep(2);
      return;
    }
    const data = new FormData(form);
    setBusy(true);
    setError("");
    const optional = (key: string) =>
      String(data.get(key) || "").trim() || undefined;
    try {
      const body = {
        firstName: data.get("firstName"),
        lastName: data.get("lastName"),
        phone: data.get("phone"),
        email: optional("email"),
        city: optional("city"),
        prayerRequest: optional("prayerRequest"),
        interest: optional("interest"),
        preferredContactTime: optional("preferredContactTime"),
        preferredContactMethod: method,
        consentToContact: data.get("consent") === "on",
        website: optional("website"),
        ...(!token ? { branchId: data.get("branchId") } : {}),
      };
      const result = await apiPost<{ id?: string }>(
        token ? `/evangelism/public/${token}` : "/evangelism/contacts",
        body,
      );
      if (token) setDone(true);
      else {
        router.push(`/evangelism/${result.id}`);
        router.refresh();
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <Card className="p-8" role="status">
        <h2 className="text-2xl font-semibold">
          {t("Thank you for connecting.")}
        </h2>
        <p className="mt-3 text-[#6b6b6b]">
          {language === "es"
            ? `${branchName || "La iglesia"} ha recibido sus datos. Esperamos poder acompañarle pronto.`
            : `Your details have been received by ${branchName || "the church team"}. We look forward to connecting with you.`}
        </p>
      </Card>
    );
  return (
    <Card className="p-6 sm:p-8">
      <form
        onSubmit={submit}
        onInput={(event) => {
          const field = event.target;
          if (
            field instanceof HTMLInputElement ||
            field instanceof HTMLSelectElement ||
            field instanceof HTMLTextAreaElement
          )
            field.setCustomValidity("");
        }}
        noValidate
        className="space-y-5"
      >
        <nav aria-label={t("Form progress")} className="flex gap-3 text-sm">
          <span
            aria-current={step === 1 ? "step" : undefined}
            className={
              step === 1 ? "font-semibold text-[#111111]" : "text-[#8a8780]"
            }
          >
            1. {t("Your details")}
          </span>
          <span aria-hidden="true">/</span>
          <span
            aria-current={step === 2 ? "step" : undefined}
            className={
              step === 2 ? "font-semibold text-[#111111]" : "text-[#8a8780]"
            }
          >
            2. {t("How we can help")}
          </span>
        </nav>
        <h2
          ref={heading}
          tabIndex={-1}
          className="text-xl font-semibold outline-none"
        >
          {step === 1
            ? t("Tell us about yourself")
            : t("How can we support you?")}
        </h2>
        <p className="text-xs text-[#8a8780]">
          {language === "es" ? "Paso" : "Step"} {step}{" "}
          {language === "es" ? "de" : "of"} 2
        </p>
        <fieldset data-step="1" hidden={step !== 1} className="space-y-5">
          <legend className="sr-only">Your details</legend>
          {!token && (
            <Field label={t("Branch")} required>
              <select
                name="branchId"
                defaultValue={defaultBranchId || branches[0]?._id}
                className="ui-input"
                required
              >
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t("First name")} required>
              <input
                name="firstName"
                autoComplete="given-name"
                className="ui-input"
                required
                maxLength={80}
              />
            </Field>
            <Field label={t("Last name")} required>
              <input
                name="lastName"
                autoComplete="family-name"
                className="ui-input"
                required
                maxLength={80}
              />
            </Field>
            <Field
              label={t("Phone, including country code")}
              required
              hint={t("For example, +1 615 555 0123")}
            >
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                className="ui-input"
                required
                minLength={7}
                maxLength={30}
              />
            </Field>
            <Field label={t("Email")} required={method === "email"}>
              <input
                name="email"
                type="email"
                autoComplete="email"
                className="ui-input"
                required={method === "email"}
                maxLength={150}
              />
            </Field>
            <Field label={t("City or area")}>
              <input
                name="city"
                autoComplete="address-level2"
                className="ui-input"
                maxLength={150}
              />
            </Field>
            <Field label={t("Preferred way to connect")} required>
              <select
                className="ui-input"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                {OUTREACH_METHODS.map(([key, label]) => (
                  <option key={key} value={key}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </fieldset>
        <fieldset data-step="2" hidden={step !== 2} className="space-y-5">
          <legend className="sr-only">How we can help</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t("What would you like help with?")}>
              <select name="interest" className="ui-input" defaultValue="">
                <option value="">{t("Choose if you wish")}</option>
                {OUTREACH_INTERESTS.map(([key, label]) => (
                  <option key={key} value={key}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={t("Best time to contact you")}
              hint={t("Include your time zone if helpful.")}
            >
              <input
                name="preferredContactTime"
                className="ui-input"
                maxLength={150}
                placeholder={t("For example, weekday evenings")}
              />
            </Field>
          </div>
          <Field
            label={t("How can we pray for you?")}
            hint={t(
              "Optional. Only share what you’re comfortable sharing with the church care team.",
            )}
          >
            <textarea
              name="prayerRequest"
              rows={3}
              className="ui-input"
              maxLength={1000}
            />
          </Field>
          <div className="hidden" aria-hidden="true">
            <label>
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <label className="flex items-start gap-3 text-sm leading-6">
            <input type="checkbox" name="consent" required className="mt-1" />
            <span>
              {token
                ? language === "es"
                  ? `Acepto que ${branchName || "esta iglesia"} use estos datos para contactarme sobre mi solicitud y las actividades de la iglesia. Puedo pedir al equipo que deje de contactarme en cualquier momento.`
                  : `I agree that ${branchName || "this church"} may use these details to contact me about my request and church activities. I can ask the team to stop contacting me at any time.`
                : "The person has given permission for this church to record these details and contact them. They understand they can ask us to stop."}
            </span>
          </label>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {t(error)}
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          {step === 2 && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setError("");
                setStep(1);
              }}
            >
              {t("Back")}
            </Button>
          )}
          <Button
            type="submit"
            disabled={busy || (!token && !branches.length)}
            style={
              accent || buttonText
                ? {
                    backgroundColor: accent,
                    color: buttonText || formTextColor(accent || "#111111"),
                  }
                : undefined
            }
          >
            {step === 1
              ? t("Continue")
              : busy
                ? t("Submitting…")
                : token
                  ? t("Connect with us")
                  : t("Add outreach contact")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
