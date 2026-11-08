import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { FirstPasswordForm } from "@/components/auth/first-password-form";
import { getServerSessionUser } from "@/lib/auth";
import { safeReturnTo } from "@/lib/return-to";
import { unavailableHref } from "@/lib/server-read";

/*
 * The first admin of a provisioned workspace lands here after signing in with the generated
 * password; anyone signed in can also use it to pick a new password.
 */
export default async function ChangePasswordPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const params = await searchParams;
  let user: Awaited<ReturnType<typeof getServerSessionUser>>;
  try {
    user = await getServerSessionUser();
  } catch {
    redirect(await unavailableHref());
  }
  if (!user) redirect("/login?reason=session-expired");
  const t = await getTranslations("auth");

  return (
    <AuthShell
      aside={{
        photoId: "1604072424771-7300bc5de457",
        photoAlt: t("firstPassword.asideAlt"),
        title: t("firstPassword.asideTitle"),
        body: t("firstPassword.asideBody"),
      }}
    >
      <FirstPasswordForm
        required={user.passwordChangeRequired === true}
        email={user.email}
        returnTo={safeReturnTo(params.returnTo)}
      />
    </AuthShell>
  );
}
