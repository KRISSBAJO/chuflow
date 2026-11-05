"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, AuthHeading, Field, PasswordInput, SubmitButton } from "@/components/auth/auth-ui";
import { API_URL } from "@/lib/api";
import { roleHomeHref } from "@/lib/permissions";

type LoginFormProps = {
  notice?: string | null;
};

export function LoginForm({ notice }: LoginFormProps) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  function toFriendlyAuthMessage(error: unknown) {
    if (error instanceof TypeError) {
      return t("apiUnavailable");
    }
    if (error instanceof Error && error.message.toLowerCase().includes("fetch failed")) {
      return t("apiUnavailable");
    }
    return error instanceof Error ? error.message : t("login.failed");
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setMessage(null);
    setIsSuccess(false);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || t("login.failed"));
      }

      const result = (await response.json()) as { user?: { role?: string } };
      const homeHref = result.user?.role ? roleHomeHref(result.user.role) : "/dashboard";
      setIsSuccess(true);
      setMessage(t("login.success"));
      window.setTimeout(() => {
        window.location.href = homeHref;
      }, 600);
    } catch (error) {
      setMessage(toFriendlyAuthMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <AuthHeading title={t("login.title")} body={t("login.body")} />

      {notice ? (
        <div className="mb-6">
          <Alert tone="info">{notice}</Alert>
        </div>
      ) : null}

      <form action={handleSubmit} className="space-y-5">
        <Field label={tc("email")}>
          <input name="email" type="email" placeholder={tc("emailPlaceholder")} autoComplete="email" className="lp-input" required />
        </Field>

        <Field
          label={t("password")}
          aside={
            <Link href="/forgot-password" className="text-[13px] font-medium text-[var(--lp-muted)] transition-colors hover:text-[var(--lp-ink)]">
              {t("login.forgotPassword")}
            </Link>
          }
        >
          <PasswordInput name="password" placeholder={t("login.passwordPlaceholder")} autoComplete="current-password" required />
        </Field>

        <div className="pt-2">
          <SubmitButton loading={loading} disabled={isSuccess} loadingLabel={t("login.signingIn")}>
            {tc("signIn")}
          </SubmitButton>
        </div>
      </form>

      {message ? (
        <div className="mt-5">
          <Alert tone={isSuccess ? "success" : "error"}>{message}</Alert>
        </div>
      ) : null}

      <p className="mt-10 text-[14px] text-[var(--lp-muted)]">
        {t("newToChuFlow")}{" "}
        <Link href="/request-workspace" className="font-medium text-[var(--lp-ink)] underline-offset-4 hover:underline">
          {tc("requestWorkspace")}
        </Link>
      </p>
    </div>
  );
}
