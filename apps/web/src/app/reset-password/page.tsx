import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/reset-password-form";

export default async function ResetPasswordPage() {
  const [t, tc] = await Promise.all([getTranslations("auth"), getTranslations("common")]);

  return (
    <AuthShell
      switchPrompt={{ text: t("knowYourPassword"), label: tc("signIn"), href: "/login" }}
      aside={{
        photoId: "1604072424771-7300bc5de457",
        photoAlt: t("reset.asideAlt"),
        title: t("reset.asideTitle"),
        body: t("reset.asideBody"),
      }}
    >
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
