"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Alert, Field, PasswordInput, SubmitButton } from "@/components/auth/auth-ui";
import { apiPost } from "@/lib/api";

export function DeletionForm() {
  const t = useTranslations("auth.accountDeletion");
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    setPending(true);
    setState("idle");
    try {
      await apiPost("/auth/account-deletion", { password: new FormData(form).get("password") });
      setState("sent");
    } catch {
      setState("error");
    } finally {
      form.reset();
      setPending(false);
    }
  }

  if (state === "sent") return <p role="status">{t("received")}</p>;

  return (
    <form method="post" className="space-y-4" onSubmit={submit}>
      <Field label={t("password")}>
        <PasswordInput name="password" autoComplete="current-password" maxLength={128} required />
      </Field>
      {state === "error" ? <Alert tone="error">{t("error")}</Alert> : null}
      <SubmitButton loading={pending} loadingLabel={t("submit")}>{t("submit")}</SubmitButton>
    </form>
  );
}
