"use client";
import { toast } from "sonner";
import { useActionToast } from "@/lib/action-feedback";
import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { apiPost } from "@/lib/api";
import { Wordmark } from "@/components/brand/wordmark";
import { LanguagePicker } from "@/components/i18n/language-picker";
import { Button, Field } from "@/components/ui/ui";

const RESPONSES = [
  "well",
  "away",
  "request_call",
  "prayer",
  "moved",
  "other",
] as const;
export function CareCheckIn({
  token,
  info,
}: {
  token: string;
  info: { churchName: string; kind: string };
}) {
  const actionToast = useActionToast();

  const t = useTranslations("people.care.checkIn");
  const tsh = useTranslations("people.shared");
  const locale = useLocale();
  // The care API stores the person's preferred language as en/es only.
  const language = locale === "es" ? "es" : "en";
  const [response, setResponse] = useState("well");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const stop = info.kind === "unsubscribe";
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const d = new FormData(e.currentTarget);
    try {
      await apiPost("/care/public/" + token, {
        language,
        response: stop ? "other" : response,
        contactRequested: !stop && d.get("contactRequested") === "on",
        emailAllowed: !stop && d.get("emailAllowed") === "on",
        stopContact: stop,
        note: String(d.get("note") || ""),
        ...(d.get("until")
          ? { until: new Date(String(d.get("until"))).toISOString() }
          : {}),
      });
      setDone(true);

      actionToast.success();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errorSave"));
      setError(e instanceof Error ? e.message : t("errorSave"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen bg-[#f4f3f0] px-4 py-10 sm:py-16">
      <section className="mx-auto max-w-lg rounded-3xl bg-white p-6 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <Wordmark />
          <LanguagePicker />
        </div>
        <p className="lp-label mt-8">{info.churchName}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          {done ? t("thanks") : stop ? t("stopTitle") : t("supportTitle")}
        </h1>
        {done ? (
          <p className="mt-4 text-sm leading-7 text-[#6b6b6b]">
            {stop ? t("doneStop") : t("doneShared")}
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-5">
            {stop ? (
              <p className="text-sm leading-7 text-[#6b6b6b]">
                {t("confirmStop")}
              </p>
            ) : (
              <>
                <Field label={t("shareLabel")}>
                  <select
                    className="ui-input"
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                  >
                    {RESPONSES.map((value) => (
                      <option key={value} value={value}>
                        {t(`responses.${value}`)}
                      </option>
                    ))}
                  </select>
                </Field>
                {response === "away" && (
                  <Field label={t("availableAgain")}>
                    <input
                      className="ui-input"
                      name="until"
                      type="date"
                      required
                    />
                  </Field>
                )}
                <Field label={t("optionalMessage")}>
                  <textarea
                    className="ui-input min-h-32"
                    name="note"
                    maxLength={2000}
                    placeholder={t("messagePlaceholder")}
                  />
                </Field>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="contactRequested" />
                  {t("contactRequested")}
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="emailAllowed" />
                  {t("emailAllowed")}
                </label>
                <p className="text-xs leading-6 text-[#8a8780]">
                  {t("privacyNote")}
                </p>
              </>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <Button type="submit" variant="flame" disabled={busy}>
              {busy
                ? tsh("savingEllipsis")
                : stop
                  ? t("confirmAndStop")
                  : t("send")}
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}
