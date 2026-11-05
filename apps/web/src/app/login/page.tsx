import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const [params, t, tc] = await Promise.all([searchParams, getTranslations("auth"), getTranslations("common")]);

  const notice =
    params.reason === "api-unavailable"
      ? t("apiUnavailable")
      : params.reason === "session-expired"
        ? t("sessionExpired")
        : null;

  return (
    <AuthShell
      switchPrompt={{ text: t("newToChuFlow"), label: tc("requestWorkspace"), href: "/request-workspace" }}
      aside={{
        photoId: "1791357775814-24088f555824",
        photoAlt: t("login.asideAlt"),
        title: t("login.asideTitle"),
        body: t("login.asideBody"),
      }}
    >
      <LoginForm notice={notice} />
    </AuthShell>
  );
}
