import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export default async function ForgotPasswordPage() {
  const [t, tc] = await Promise.all([getTranslations("auth"), getTranslations("common")]);

  return (
    <AuthShell
      switchPrompt={{ text: t("rememberedIt"), label: tc("signIn"), href: "/login" }}
      aside={{
        photoId: "1604072424771-7300bc5de457",
        photoAlt: t("forgot.asideAlt"),
        title: t("forgot.asideTitle"),
        body: t("forgot.asideBody"),
      }}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
