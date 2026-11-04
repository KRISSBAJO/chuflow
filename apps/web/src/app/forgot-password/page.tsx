import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      switchPrompt={{ text: "Remembered it?", label: "Sign in", href: "/login" }}
      aside={{
        photoId: "1604072424771-7300bc5de457",
        photoAlt: "A mother and son sitting together in the church pews",
        title: "We'll have you back in a moment.",
        body: "Reset links are sent to the email on your account and expire after a short time.",
      }}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
