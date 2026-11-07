import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthHeading } from "@/components/auth/auth-ui";
import { workspaceSignInOptions } from "@/lib/workspace-sign-in";

export default async function WorkspacesPage() {
  const [t, tc] = await Promise.all([getTranslations("auth"), getTranslations("common")]);
  const workspaces = workspaceSignInOptions(
    process.env.NEXT_PUBLIC_CHUFLOW_WORKSPACE_NAME,
    process.env.NEXT_PUBLIC_CHUFLOW_WORKSPACES,
  );

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
      <AuthHeading title={t("workspacePicker.title")} body={t("workspacePicker.body")} />
      <ul className="space-y-3">
        {workspaces.map(({ name, href }) => {
          const content = (
            <>
              <span className="min-w-0 flex-1 break-words font-medium">{name}</span>
              <span aria-hidden="true">&rarr;</span>
            </>
          );
          const className = "flex items-center gap-3 rounded-xl border border-black/10 px-4 py-4 hover:bg-[var(--lp-panel)]";
          return (
            <li key={href}>
              {href === "/login" ? (
                <Link href={href} className={className}>{content}</Link>
              ) : (
                <a href={href} className={className}>{content}</a>
              )}
            </li>
          );
        })}
      </ul>
      <Link href="/request-workspace" className="mt-6 inline-block text-sm underline underline-offset-4">
        {tc("requestWorkspace")}
      </Link>
    </AuthShell>
  );
}
