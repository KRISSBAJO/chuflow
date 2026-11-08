"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, AuthHeading, Field, PasswordInput, SubmitButton } from "@/components/auth/auth-ui";
import { WorkspaceLoader } from "@/components/brand/workspace-loader";
import { API_URL } from "@/lib/api";

export function FirstPasswordForm({ required, email, returnTo }: { required: boolean; email: string; returnTo: string }) {
  const t = useTranslations("auth.firstPassword");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    if (loading || done) return;
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    if (newPassword !== confirmPassword) return setMessage(t("mismatch"));
    if (newPassword === currentPassword) return setMessage(t("sameAsCurrent"));

    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${API_URL}/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!response.ok) {
        setMessage(t(response.status === 401 ? "wrongCurrent" : "failed"));
        return;
      }
      setDone(true);
      // A full load so the session, and the API scope of this tab, are read afresh.
      window.location.replace(returnTo);
    } catch {
      setMessage(t("failed"));
    } finally {
      setLoading(false);
    }
  }

  if (done) return <WorkspaceLoader />;

  return (
    <div>
      <AuthHeading title={t("title")} body={required ? t("body") : t("optionalBody")} />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit(new FormData(event.currentTarget));
        }}
        className="space-y-5"
      >
        <input type="hidden" name="username" value={email} autoComplete="username" />
        <Field label={required ? t("current") : t("currentExisting")}>
          <PasswordInput name="currentPassword" autoComplete="current-password" required />
        </Field>
        <Field label={t("new")} hint={t("hint")}>
          <PasswordInput name="newPassword" autoComplete="new-password" minLength={8} required />
        </Field>
        <Field label={t("confirm")}>
          <PasswordInput name="confirmPassword" autoComplete="new-password" minLength={8} required />
        </Field>
        <div className="pt-2">
          <SubmitButton loading={loading} loadingLabel={t("saving")}>
            {t("submit")}
          </SubmitButton>
        </div>
      </form>
      {message ? (
        <div className="mt-5">
          <Alert tone="error">{message}</Alert>
        </div>
      ) : null}
    </div>
  );
}
