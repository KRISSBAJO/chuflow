"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AuthHeading, Field, PasswordInput, SubmitButton } from "@/components/auth/auth-ui";
import { errorMessage, OpsApiError, operatorLogin } from "@/lib/ops/client";

export function OpsLoginForm({ notice }: { notice?: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(false);

  async function submit(form: FormData) {
    if (loading) return;
    setLoading(true);
    setMessage(null);
    try {
      await operatorLogin(String(form.get("email") || ""), String(form.get("password") || ""));
      router.replace("/ops");
      router.refresh();
    } catch (error) {
      if (error instanceof OpsApiError && error.code === "platform_disabled") setDisabled(true);
      setMessage(errorMessage(error));
      setLoading(false);
    }
  }

  return (
    <div>
      <AuthHeading title="Operator console" body="Sign in with your platform operator account. Church sign-ins do not work here." />
      {notice ? (
        <div className="mb-6">
          <Alert tone="info">{notice}</Alert>
        </div>
      ) : null}
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(new FormData(event.currentTarget));
        }}
      >
        <Field label="Email">
          <input name="email" type="email" autoComplete="username" className="lp-input" placeholder="you@chuflow.com" required />
        </Field>
        <Field label="Password">
          <PasswordInput name="password" autoComplete="current-password" placeholder="Your operator password" required minLength={8} />
        </Field>
        <div className="pt-2">
          <SubmitButton loading={loading} disabled={disabled} loadingLabel="Signing in…">
            Sign in
          </SubmitButton>
        </div>
      </form>
      {message ? (
        <div className="mt-5">
          <Alert tone="error">
            {message}
            {disabled ? " Set PLATFORM_ENABLED=true with a control database on the API to use the console." : ""}
          </Alert>
        </div>
      ) : null}
    </div>
  );
}
