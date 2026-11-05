"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, AuthHeading, Field, SubmitButton } from "@/components/auth/auth-ui";
import { API_URL } from "@/lib/api";

export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgot");
  const ta = useTranslations("auth");
  const tc = useTranslations("common");
  const [status, setStatus] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setStatus(null);
    setFailed(false);
    setResetUrl(null);

    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.get("email") }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || t("failed"));
      }

      setStatus(result.delivery === "email" ? t("emailSent") : result.message);
      setResetUrl(result.resetUrl ?? null);
    } catch (error) {
      setFailed(true);
      setStatus(error instanceof Error ? error.message : t("failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <AuthHeading title={t("title")} body={t("body")} />

      <form action={handleSubmit} className="space-y-5">
        <Field label={tc("email")}>
          <input name="email" type="email" placeholder={tc("emailPlaceholder")} autoComplete="email" className="lp-input" required />
        </Field>
        <div className="pt-2">
          <SubmitButton loading={loading} loadingLabel={t("sending")}>
            {t("submit")}
          </SubmitButton>
        </div>
      </form>

      {status ? (
        <div className="mt-5">
          <Alert tone={failed ? "error" : "success"}>{status}</Alert>
        </div>
      ) : null}

      {resetUrl ? (
        <div className="mt-3 rounded-2xl bg-[var(--lp-panel)] px-4 py-4 text-[14px]">
          <p className="text-[var(--lp-muted)]">{t("previewNote")}</p>
          <a href={resetUrl} className="mt-2 inline-flex font-medium text-[var(--lp-ink)] underline underline-offset-4">
            {t("openResetPage")}
          </a>
        </div>
      ) : null}

      <p className="mt-10 text-[14px] text-[var(--lp-muted)]">
        {ta("rememberedIt")}{" "}
        <Link href="/login" className="font-medium text-[var(--lp-ink)] underline-offset-4 hover:underline">
          {t("backToSignIn")}
        </Link>
      </p>
    </div>
  );
}
