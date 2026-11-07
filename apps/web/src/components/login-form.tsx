"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { WorkspaceLoader } from "@/components/brand/workspace-loader";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { loginErrorKey } from "@/lib/auth-errors";
import { useState } from "react";
import {
  Alert,
  AuthHeading,
  Field,
  PasswordInput,
  SubmitButton,
} from "@/components/auth/auth-ui";
import { API_URL } from "@/lib/api";
import { roleHomeHref } from "@/lib/permissions";
import { hasLinkedWorkspaceDirectory, linkedWorkspaceOptions, type WorkspaceMembership } from "@/lib/workspace-sign-in";
import { safeReturnTo } from "@/lib/return-to";

type LoginFormProps = {
  notice?: string | null;
  returnTo?: string;
};

export function LoginForm({ notice, returnTo }: LoginFormProps) {
  const router = useRouter();
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(formData: FormData) {
    if (loading || isSuccess) return;
    setLoading(true);
    setMessage(null);
    setIsSuccess(false);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: String(formData.get("email") || "")
            .trim()
            .toLowerCase(),
          password: formData.get("password"),
        }),
      });

      if (!response.ok) {
        const friendly = t(`login.${loginErrorKey(response.status)}`);
        setMessage(friendly);
        toast.error(friendly, { id: "login-feedback" });
        return;
      }

      const result = (await response.json()) as { user?: { role?: string } };
      const homeHref = result.user?.role
        ? roleHomeHref(result.user.role)
        : "/dashboard";
      setIsSuccess(true);
      toast.dismiss("login-feedback");
      const destination = safeReturnTo(returnTo, homeHref);
      if (hasLinkedWorkspaceDirectory()) {
        try {
          const workspaces = await fetch(`${API_URL}/auth/workspaces`, {
            credentials: "include",
            cache: "no-store",
            signal: AbortSignal.timeout(3000),
          });
          if (workspaces.ok) {
            const memberships = (await workspaces.json()) as WorkspaceMembership[];
            if (linkedWorkspaceOptions(memberships).some((workspace) => workspace.destination)) {
              router.replace(`/workspaces?returnTo=${encodeURIComponent(destination)}`);
              return;
            }
          }
        } catch {
          // A directory outage should leave the current workspace usable.
        }
      }
      router.replace(destination);
    } catch (error) {
      const key =
        error instanceof Error && error.name === "AbortError"
          ? "timeout"
          : error instanceof TypeError
            ? "connection"
            : "failed";
      const friendly = t(`login.${key}`);
      setMessage(friendly);
      toast.error(friendly, { id: "login-feedback" });
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }

  if (isSuccess) return <WorkspaceLoader />;

  return (
    <div>
      <AuthHeading title={t("login.title")} body={t("login.body")} />

      {notice ? (
        <div className="mb-6">
          <Alert tone="info">{notice}</Alert>
        </div>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit(new FormData(event.currentTarget));
        }}
        className="space-y-5"
      >
        <Field label={tc("email")}>
          <input
            name="email"
            type="email"
            placeholder={tc("emailPlaceholder")}
            autoComplete="email"
            aria-describedby={message ? "login-feedback" : undefined}
            className="lp-input"
            required
          />
        </Field>

        <Field
          label={t("password")}
          aside={
            <Link
              href="/forgot-password"
              className="text-[13px] font-medium text-[var(--lp-muted)] transition-colors hover:text-[var(--lp-ink)]"
            >
              {t("login.forgotPassword")}
            </Link>
          }
        >
          <PasswordInput
            name="password"
            placeholder={t("login.passwordPlaceholder")}
            autoComplete="current-password"
            aria-describedby={message ? "login-feedback" : undefined}
            required
          />
        </Field>

        <div className="pt-2">
          <SubmitButton
            loading={loading}
            disabled={isSuccess}
            loadingLabel={t("login.signingIn")}
          >
            {tc("signIn")}
          </SubmitButton>
        </div>
      </form>

      {message ? (
        <div id="login-feedback" className="mt-5">
          <Alert tone="error">{message}</Alert>
        </div>
      ) : null}

      <p className="mt-10 text-[14px] text-[var(--lp-muted)]">
        {t("newToChuFlow")}{" "}
        <Link
          href="/request-workspace"
          className="font-medium text-[var(--lp-ink)] underline-offset-4 hover:underline"
        >
          {tc("requestWorkspace")}
        </Link>
      </p>
    </div>
  );
}
