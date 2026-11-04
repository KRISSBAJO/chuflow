"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, AuthHeading, Field, PasswordInput, SubmitButton } from "@/components/auth/auth-ui";
import { API_URL } from "@/lib/api";

type LoginFormProps = {
  notice?: string | null;
};

function toFriendlyAuthMessage(error: unknown) {
  if (error instanceof TypeError) {
    return "ChuFlow API is temporarily unavailable. Please try again shortly.";
  }
  if (error instanceof Error && error.message.toLowerCase().includes("fetch failed")) {
    return "ChuFlow API is temporarily unavailable. Please try again shortly.";
  }
  return error instanceof Error ? error.message : "Login failed";
}

export function LoginForm({ notice }: LoginFormProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

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
        throw new Error(text || "Login failed");
      }

      setIsSuccess(true);
      setMessage("Signed in. Redirecting...");
      window.setTimeout(() => {
        window.location.href = "/dashboard";
      }, 600);
    } catch (error) {
      setMessage(toFriendlyAuthMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <AuthHeading title="Welcome back" body="Sign in to your church's ChuFlow workspace." />

      {notice ? (
        <div className="mb-6">
          <Alert tone="info">{notice}</Alert>
        </div>
      ) : null}

      <form action={handleSubmit} className="space-y-5">
        <Field label="Email">
          <input name="email" type="email" placeholder="you@church.org" autoComplete="email" className="lp-input" required />
        </Field>

        <Field
          label="Password"
          aside={
            <Link href="/forgot-password" className="text-[13px] font-medium text-[var(--lp-muted)] transition-colors hover:text-[var(--lp-ink)]">
              Forgot password?
            </Link>
          }
        >
          <PasswordInput name="password" placeholder="Your password" autoComplete="current-password" required />
        </Field>

        <div className="pt-2">
          <SubmitButton loading={loading} disabled={isSuccess} loadingLabel="Signing in...">
            Sign in
          </SubmitButton>
        </div>
      </form>

      {message ? (
        <div className="mt-5">
          <Alert tone={isSuccess ? "success" : "error"}>{message}</Alert>
        </div>
      ) : null}

      <p className="mt-10 text-[14px] text-[var(--lp-muted)]">
        New to ChuFlow?{" "}
        <Link href="/request-workspace" className="font-medium text-[var(--lp-ink)] underline-offset-4 hover:underline">
          Request a workspace
        </Link>
      </p>
    </div>
  );
}
