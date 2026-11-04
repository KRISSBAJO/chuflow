"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, AuthHeading, Field, PasswordInput, Spinner, SubmitButton } from "@/components/auth/auth-ui";
import { API_URL } from "@/lib/api";

function formatExpiry(value: unknown) {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function ResetPasswordForm() {
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
      if (!token) {
        setStatus("This reset link is missing its token. Request a new link to continue.");
        setChecking(false);
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/auth/reset-password/verify?token=${encodeURIComponent(token)}`,
        );
        const result = await response.json();

        if (!mounted) {
          return;
        }

        if (!response.ok || result.valid === false) {
          setStatus(result.message || "This reset link is invalid or has expired.");
          setValid(false);
        } else {
          setValid(true);
          setExpiresAt(formatExpiry(result.expiresAt));
        }
      } catch {
        if (mounted) {
          setStatus("We couldn't verify this reset link. Please try again.");
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
  }, [token]);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setStatus(null);

    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      setStatus("The two passwords don't match.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to reset password");
      }

      setSucceeded(true);
      setStatus("Your password has been reset. You can now sign in.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to reset password");
    } finally {
      setLoading(false);
    }
  }

  if (succeeded) {
    return (
      <div>
        <AuthHeading title="You're all set" body="Your password has been reset. Sign in with your new password." />
        <Link href="/login" className="lp-pill-dark inline-flex h-12 w-full items-center justify-center rounded-full text-[15px] font-medium">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <AuthHeading title="Choose a new password" body="Pick something you haven't used before for this account." />

      {checking ? (
        <div className="mb-6 flex items-center gap-2.5 rounded-2xl bg-[var(--lp-panel)] px-4 py-3.5 text-[14px] text-[var(--lp-muted)]">
          <Spinner />
          Checking your reset link...
        </div>
      ) : valid ? (
        <div className="mb-6">
          <Alert tone="success">Reset link verified{expiresAt ? `. It expires ${expiresAt}.` : "."}</Alert>
        </div>
      ) : null}

      <form action={handleSubmit} className="space-y-5">
        <Field label="New password">
          <PasswordInput name="newPassword" placeholder="New password" autoComplete="new-password" required />
        </Field>
        <Field label="Confirm new password">
          <PasswordInput name="confirmPassword" placeholder="Repeat new password" autoComplete="new-password" required />
        </Field>
        <div className="pt-2">
          <SubmitButton loading={loading} disabled={!token || !valid || checking} loadingLabel="Saving...">
            Reset password
          </SubmitButton>
        </div>
      </form>

      {status ? (
        <div className="mt-5">
          <Alert tone="error">{status}</Alert>
        </div>
      ) : null}

      <p className="mt-10 text-[14px] text-[var(--lp-muted)]">
        Link expired?{" "}
        <Link href="/forgot-password" className="font-medium text-[var(--lp-ink)] underline-offset-4 hover:underline">
          Request a new one
        </Link>
      </p>
    </div>
  );
}
