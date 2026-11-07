import Link from "next/link";
import { cookies } from "next/headers";
import { WorkspaceHandoffButton } from "@/components/auth/workspace-handoff-button";
import { getServerSessionUser } from "@/lib/auth";
import { roleHomeHref } from "@/lib/permissions";
import { safeReturnTo } from "@/lib/return-to";
import { ACTIVE_WORKSPACE_COOKIE, DIRECTORY_COOKIE, SHARED_WORKSPACES } from "@/lib/workspace-routing";
import { serverRead } from "@/lib/server-read";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthHeading } from "@/components/auth/auth-ui";
import { linkedWorkspaceOptions, workspaceSignInOptions, type WorkspaceMembership } from "@/lib/workspace-sign-in";

export default async function WorkspacesPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const store = await cookies();
  const token = store.get(DIRECTORY_COOKIE)?.value;
  const selected = SHARED_WORKSPACES ? store.get(ACTIVE_WORKSPACE_COOKIE)?.value : undefined;
  const [params, user] = await Promise.all([searchParams, getServerSessionUser().catch(() => null)]);
  let linked: ReturnType<typeof linkedWorkspaceOptions> = [];
  if (user && token) {
    try {
      const response = await serverRead("/auth/workspaces", { Cookie: `cms_access_token=${token}` });
      if (response.ok) linked = linkedWorkspaceOptions((await response.json()) as WorkspaceMembership[]);
    } catch {
      // The current workspace remains available if the directory cannot be reached.
    }
    if (linked.length === 0 && user.workspace) linked = [{ ...user.workspace, current: true, destination: null }];
  }
  const currentHref = safeReturnTo(params.returnTo, roleHomeHref(user?.role));
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
      <AuthHeading title={t("workspacePicker.title")} body={t(user ? "workspacePicker.linkedBody" : "workspacePicker.body")} />
      <ul className="space-y-3">
        {user ? linked.map(({ id, name, destination }) => (
          <li key={id}>
            {destination && id !== selected ? <WorkspaceHandoffButton id={id} name={name} destination={destination} /> :
             !destination && selected && id !== selected ? (
              <form action="/api/workspace-session" method="post">
                <input type="hidden" name="workspace" value="directory" />
                <button className="w-full rounded-xl border border-black/10 px-4 py-4 text-left font-medium hover:bg-[var(--lp-panel)]">{name}</button>
              </form>
            ) : (
              <Link href={currentHref} className="flex items-center justify-between gap-3 rounded-xl border border-black/10 px-4 py-4 font-medium hover:bg-[var(--lp-panel)]">
                {name}<span className="text-sm font-normal text-[var(--lp-muted)]">{t("workspacePicker.current")}</span>
              </Link>
            )}
          </li>
        )) : workspaces.map(({ name, href }) => {
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
