"use client";
import { toast } from "sonner";
import { useActionToast } from "@/lib/action-feedback";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  Alert,
  AuthHeading,
  Field,
  PasswordInput,
  Spinner,
  SubmitButton,
} from "@/components/auth/auth-ui";
import { API_URL } from "@/lib/api";
import { SHARED_WORKSPACES, workspaceProxyUrl, workspaceSignInHref } from "@/lib/workspace-routing";

function formatExpiry(value: unknown, locale: string) {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ResetPasswordForm({
  workspace,
  missing,
}: {
  /** A provisioned church: the token was issued by, and is redeemed at, its own API. */
  workspace?: { id: string; name: string } | null;
  missing?: boolean;
}) {
  const actionToast = useActionToast();
  const tw = useTranslations("auth.workspacePicker");
  const apiBase = SHARED_WORKSPACES ? workspaceProxyUrl(workspace?.id) : API_URL;

  const t = useTranslations("auth.reset");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function verifyToken() {
      if (!token || missing) {
        setStatus(missing ? tw("notFound") : t("missingToken"));
        setChecking(false);
        return;
      }

      try {
        const response = await fetch(
          `${apiBase}/auth/reset-password/verify?token=${encodeURIComponent(token)}`,
        );
        const result = await response.json();

        if (!mounted) {
          return;
        }

        if (!response.ok || result.valid === false) {
          setStatus(result.message || t("invalidLink"));
          setValid(false);
        } else {
          setValid(true);
          setExpiresAt(formatExpiry(result.expiresAt, locale));
        }
      } catch {
        if (mounted) {
          setStatus(t("verifyFailed"));
          setValid(false);
        }
      } finally {
        if (mounted) {
          setChecking(false);
        }
      }
    }

    void verifyToken();

    return () => {
      mounted = false;
    };
  }, [token, locale, t, tw, apiBase, missing]);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setStatus(null);

    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      setStatus(t("mismatch"));
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${apiBase}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || t("failed"));
      }

      setSucceeded(true);
      setStatus(null);

      actionToast.success(t("doneTitle"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("failed"));
      setStatus(error instanceof Error ? error.message : t("failed"));
    } finally {
      setLoading(false);
    }
  }

  if (succeeded) {
    return (
      <div>
        <AuthHeading title={t("doneTitle")} body={t("doneBody")} />
        <Link
          href={workspaceSignInHref("/login", workspace?.id)}
          className="lp-pill-dark inline-flex h-12 w-full items-center justify-center rounded-full text-[15px] font-medium"
        >
          {t("goToSignIn")}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <AuthHeading title={t("title")} body={t("body")} />

      {checking ? (
        <div className="mb-6 flex items-center gap-2.5 rounded-2xl bg-[var(--lp-panel)] px-4 py-3.5 text-[14px] text-[var(--lp-muted)]">
          <Spinner />
          {t("checking")}
        </div>
      ) : valid ? (
        <div className="mb-6">
          <Alert tone="success">
            {expiresAt ? t("verifiedExpires", { expiresAt }) : t("verified")}
          </Alert>
        </div>
      ) : null}

      <form action={handleSubmit} className="space-y-5">
        <Field label={t("newPassword")}>
          <PasswordInput
            name="newPassword"
            placeholder={t("newPassword")}
            autoComplete="new-password"
            required
          />
        </Field>
        <Field label={t("confirmPassword")}>
          <PasswordInput
            name="confirmPassword"
            placeholder={t("repeatPlaceholder")}
            autoComplete="new-password"
            required
          />
        </Field>
        <div className="pt-2">
          <SubmitButton
            loading={loading}
            disabled={!token || !valid || checking}
            loadingLabel={t("saving")}
          >
            {t("submit")}
          </SubmitButton>
        </div>
      </form>

      {status ? (
        <div className="mt-5">
          <Alert tone="error">{status}</Alert>
        </div>
      ) : null}

      <p className="mt-10 text-[14px] text-[var(--lp-muted)]">
        {t("linkExpired")}{" "}
        <Link
          href={workspaceSignInHref("/forgot-password", workspace?.id)}
          className="font-medium text-[var(--lp-ink)] underline-offset-4 hover:underline"
        >
          {t("requestNew")}
        </Link>
      </p>
    </div>
  );
}
