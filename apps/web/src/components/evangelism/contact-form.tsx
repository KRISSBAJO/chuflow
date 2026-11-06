"use client";
import { toast } from "sonner";
import { useActionToast } from "@/lib/action-feedback";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { validFormColor, formTextColor } from "@/lib/form-colors";
import { apiPost } from "@/lib/api";
import { OUTREACH_INTERESTS, OUTREACH_METHODS } from "@/lib/evangelism";

/** API validation messages that have a translation, keyed by their English text. */
const API_ERROR_KEYS = {
  "Enter a valid phone number, including country code": "phoneInvalid",
  "Permission to follow up is required": "consentRequired",
  "An email address is required when email is the preferred contact method":
    "emailRequired",
} as const;
import type { BranchSummary } from "@/lib/types";
import { Button, Card, Field } from "@/components/ui/ui";

export function OutreachContactForm({
  token,
  branchName,
  branches = [],
  defaultBranchId,
  buttonColor,
  buttonTextColor,
}: {
  token?: string;
  branchName?: string;
  branches?: BranchSummary[];
  defaultBranchId?: string;
  buttonColor?: string;
  buttonTextColor?: string;
}) {
  const actionToast = useActionToast();

  const router = useRouter();
  const t = useTranslations("people.evangelism.contactForm");
  const tLabels = useTranslations("people.evangelism.labels");
  const tc = useTranslations("common");
  const locale = useLocale();
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
        // English keeps the browser's own messages; other languages use translated ones.
        if (locale !== "en") {
          if (field.validity.valueMissing)
            field.setCustomValidity(t("valueMissing"));
          else if (field.validity.typeMismatch)
            field.setCustomValidity(t("typeMismatch"));
          else if (field.validity.tooShort)
            field.setCustomValidity(t("tooShort"));
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

      actionToast.success();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errorSave"));
      setError(e instanceof Error ? e.message : t("errorSave"));
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <Card className="p-8" role="status">
        <h2 className="text-2xl font-semibold">{t("thanks")}</h2>
        <p className="mt-3 text-[#6b6b6b]">
          {t("received", { name: branchName || t("theChurchTeam") })}
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
        <nav aria-label={t("progress")} className="flex gap-3 text-sm">
          <span
            aria-current={step === 1 ? "step" : undefined}
            className={
              step === 1 ? "font-semibold text-[#111111]" : "text-[#8a8780]"
            }
          >
            {t("step1")}
          </span>
          <span aria-hidden="true">/</span>
          <span
            aria-current={step === 2 ? "step" : undefined}
            className={
              step === 2 ? "font-semibold text-[#111111]" : "text-[#8a8780]"
            }
          >
            {t("step2")}
          </span>
        </nav>
        <h2
          ref={heading}
          tabIndex={-1}
          className="text-xl font-semibold outline-none"
        >
          {step === 1 ? t("tellUs") : t("howSupport")}
        </h2>
        <p className="text-xs text-[#8a8780]">
          {t("stepOf", { step, total: 2 })}
        </p>
        <fieldset data-step="1" hidden={step !== 1} className="space-y-5">
          <legend className="sr-only">{t("yourDetails")}</legend>
          {!token && (
            <Field label={tc("branch")} required>
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
            <Field label={tc("firstName")} required>
              <input
                name="firstName"
                autoComplete="given-name"
                className="ui-input"
                required
                maxLength={80}
              />
            </Field>
            <Field label={tc("lastName")} required>
              <input
                name="lastName"
                autoComplete="family-name"
                className="ui-input"
                required
                maxLength={80}
              />
            </Field>
            <Field label={t("phoneLabel")} required hint={t("phoneHint")}>
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
            <Field label={tc("email")} required={method === "email"}>
              <input
                name="email"
                type="email"
                autoComplete="email"
                className="ui-input"
                required={method === "email"}
                maxLength={150}
              />
            </Field>
            <Field label={t("cityArea")}>
              <input
                name="city"
                autoComplete="address-level2"
                className="ui-input"
                maxLength={150}
              />
            </Field>
            <Field label={t("preferredWay")} required>
              <select
                className="ui-input"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                {OUTREACH_METHODS.map(([key]) => (
                  <option key={key} value={key}>
                    {tLabels(key)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </fieldset>
        <fieldset data-step="2" hidden={step !== 2} className="space-y-5">
          <legend className="sr-only">{t("howWeCanHelp")}</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t("helpWith")}>
              <select name="interest" className="ui-input" defaultValue="">
                <option value="">{t("chooseIfWish")}</option>
                {OUTREACH_INTERESTS.map(([key]) => (
                  <option key={key} value={key}>
                    {tLabels(key)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("bestTime")} hint={t("bestTimeHint")}>
              <input
                name="preferredContactTime"
                className="ui-input"
                maxLength={150}
                placeholder={t("bestTimePlaceholder")}
              />
            </Field>
          </div>
          <Field label={t("prayFor")} hint={t("prayHint")}>
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
                ? t("consentPublic", { name: branchName || t("thisChurch") })
                : t("consentStaff")}
            </span>
          </label>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error in API_ERROR_KEYS
              ? t(
                  `apiErrors.${API_ERROR_KEYS[error as keyof typeof API_ERROR_KEYS]}`,
                )
              : error}
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
              {tc("back")}
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
              ? t("continue")
              : busy
                ? t("submitting")
                : token
                  ? t("connect")
                  : t("addContact")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
