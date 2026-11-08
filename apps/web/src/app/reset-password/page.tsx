import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { workspaceSignInHref } from "@/lib/workspace-routing";
import { resolveSignInWorkspace } from "@/lib/workspace-sign-in-server";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const [params, t, tc] = await Promise.all([searchParams, getTranslations("auth"), getTranslations("common")]);
  const resolved = await resolveSignInWorkspace(params.workspace);
  const workspace = resolved === "missing" ? null : resolved;

  return (
    <AuthShell
      switchPrompt={{ text: t("knowYourPassword"), label: tc("signIn"), href: workspaceSignInHref("/login", workspace?.id) }}
      aside={{
        photoId: "1604072424771-7300bc5de457",
        photoAlt: t("reset.asideAlt"),
        title: t("reset.asideTitle"),
        body: t("reset.asideBody"),
      }}
    >
      <Suspense fallback={null}>
        <ResetPasswordForm workspace={workspace} missing={resolved === "missing"} />
      </Suspense>
    </AuthShell>
  );
}
