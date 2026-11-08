import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { workspaceSignInHref } from "@/lib/workspace-routing";
import { resolveSignInWorkspace } from "@/lib/workspace-sign-in-server";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const [params, t, tc] = await Promise.all([searchParams, getTranslations("auth"), getTranslations("common")]);
  const resolved = await resolveSignInWorkspace(params.workspace);
  const workspace = resolved === "missing" ? null : resolved;

  return (
    <AuthShell
      switchPrompt={{ text: t("rememberedIt"), label: tc("signIn"), href: workspaceSignInHref("/login", workspace?.id) }}
      aside={{
        photoId: "1604072424771-7300bc5de457",
        photoAlt: t("forgot.asideAlt"),
        title: t("forgot.asideTitle"),
        body: t("forgot.asideBody"),
      }}
    >
      <ForgotPasswordForm workspace={workspace} missing={resolved === "missing"} />
    </AuthShell>
  );
}
