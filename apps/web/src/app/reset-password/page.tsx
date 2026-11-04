import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      switchPrompt={{ text: "Know your password?", label: "Sign in", href: "/login" }}
      aside={{
        photoId: "1604072424771-7300bc5de457",
        photoAlt: "A mother and son sitting together in the church pews",
        title: "A fresh start for your account.",
        body: "Choose a new password and you'll be straight back to ministry work.",
      }}
    >
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
