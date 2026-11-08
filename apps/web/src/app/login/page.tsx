import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert } from "@/components/auth/auth-ui";
import { LoginForm } from "@/components/login-form";
import { resolveSignInWorkspace } from "@/lib/workspace-sign-in-server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; returnTo?: string; workspace?: string }>;
}) {
  const [params, t, tc] = await Promise.all([searchParams, getTranslations("auth"), getTranslations("common")]);
  // A provisioned church signs in at its own workspace; everyone else uses the shared directory.
  const resolved = await resolveSignInWorkspace(params.workspace);
  const workspace = resolved === "missing" ? null : resolved;

  const notice =
    params.reason === "api-unavailable"
        ? t("apiUnavailable")
        : params.reason === "session-expired"
          ? t("sessionExpired")
          : params.reason === "workspace-sign-in"
            ? t("workspacePicker.failed")
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
      <p className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium">
          {resolved === "missing" ? null : (workspace?.name ?? process.env.NEXT_PUBLIC_CHUFLOW_WORKSPACE_NAME?.trim() ?? "Winners Chapel International")}
        </span>
        <Link href="/workspaces" className="text-[var(--lp-muted)] underline underline-offset-4">
          {t("workspacePicker.change")}
        </Link>
      </p>
      {resolved === "missing" ? (
        <Alert tone="error">{t("workspacePicker.notFound")}</Alert>
      ) : (
        <LoginForm notice={notice} returnTo={params.returnTo} workspace={workspace} />
      )}
    </AuthShell>
  );
}
