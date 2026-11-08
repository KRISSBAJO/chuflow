"use client";
import { toast } from "sonner";
import { useActionToast } from "@/lib/action-feedback";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  Alert,
  AuthHeading,
  Field,
  SubmitButton,
} from "@/components/auth/auth-ui";
import { API_URL } from "@/lib/api";
import { SHARED_WORKSPACES, workspaceProxyUrl, workspaceSignInHref } from "@/lib/workspace-routing";

export function ForgotPasswordForm({
  workspace,
  missing,
}: {
  /** A provisioned church: the reset is requested from its own API. */
  workspace?: { id: string; name: string } | null;
  missing?: boolean;
}) {
  const actionToast = useActionToast();
  const tw = useTranslations("auth.workspacePicker");

  const t = useTranslations("auth.forgot");
  const ta = useTranslations("auth");
  const tc = useTranslations("common");
  const [status, setStatus] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setStatus(null);
    setFailed(false);

    try {
      const authBase = SHARED_WORKSPACES ? workspaceProxyUrl(workspace?.id) : API_URL;
      const response = await fetch(`${authBase}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.get("email") }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || t("failed"));
      }

      setStatus(t("resetRequested"));

      actionToast.success(t("resetRequested"));
    } catch (error) {
      setFailed(true);
      toast.error(error instanceof Error ? error.message : t("failed"));
      setStatus(error instanceof Error ? error.message : t("failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <AuthHeading title={t("title")} body={workspace ? t("bodyWorkspace", { name: workspace.name }) : t("body")} />

      {missing ? (
        <div className="mb-6">
          <Alert tone="error">{tw("notFound")}</Alert>
        </div>
      ) : null}

      <form action={handleSubmit} className="space-y-5">
        <Field label={tc("email")}>
          <input
            name="email"
            type="email"
            placeholder={tc("emailPlaceholder")}
            autoComplete="email"
            className="lp-input"
            required
          />
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

      <p className="mt-10 text-[14px] text-[var(--lp-muted)]">
        {ta("rememberedIt")}{" "}
        <Link
          href={workspaceSignInHref("/login", workspace?.id)}
          className="font-medium text-[var(--lp-ink)] underline-offset-4 hover:underline"
        >
          {t("backToSignIn")}
        </Link>
      </p>
    </div>
  );
}
