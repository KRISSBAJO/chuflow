import Link from "next/link";
import { cookies } from "next/headers";
import { WorkspaceHandoffButton } from "@/components/auth/workspace-handoff-button";
import { getServerSessionUser } from "@/lib/auth";
import { roleHomeHref } from "@/lib/permissions";
import { safeReturnTo } from "@/lib/return-to";
import { ACTIVE_WORKSPACE_COOKIE, DIRECTORY_COOKIE, SHARED_WORKSPACES, VERIFIED_WORKSPACES_COOKIE, verifiedWorkspaceIds, workspaceApiContext } from "@/lib/workspace-routing";
import { serverRead } from "@/lib/server-read";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthHeading } from "@/components/auth/auth-ui";
import { linkedWorkspaceOptions, workspaceSignInOptions, type WorkspaceMembership } from "@/lib/workspace-sign-in";
import { redirect } from "next/navigation";

export default async function WorkspacesPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const store = await cookies();
  const token = store.get(DIRECTORY_COOKIE)?.value;
  const selected = SHARED_WORKSPACES ? store.get(ACTIVE_WORKSPACE_COOKIE)?.value : undefined;
  const [params, user] = await Promise.all([searchParams, getServerSessionUser().catch(() => null)]);
  const verified = await Promise.all(verifiedWorkspaceIds(store.get(VERIFIED_WORKSPACES_COOKIE)?.value).map(async (id) => {
    const { base, cookieName } = workspaceApiContext(id === "directory" ? null : id);
    const session = store.get(cookieName)?.value;
    if (!session) return null;
    try {
      const response = await serverRead("/auth/me", { Cookie: `${cookieName}=${session}` }, base);
      if (!response.ok) return null;
      const { workspace } = await response.json() as { workspace?: { id: string; name: string } };
      return workspace && (id === "directory" || workspace.id === id) ? { ...workspace, selection: id } : null;
    } catch {
      return null;
    }
  }));
  const direct = verified.filter((workspace) => workspace !== null);
  let linked: ReturnType<typeof linkedWorkspaceOptions> = [];
  if (token) {
    try {
      const response = await serverRead("/auth/workspaces", { Cookie: `cms_access_token=${token}` });
      if (response.ok) linked = linkedWorkspaceOptions((await response.json()) as WorkspaceMembership[]);
    } catch {
      // The current workspace remains available if the directory cannot be reached.
    }
    if (linked.length === 0 && !selected && user?.workspace) linked = [{ ...user.workspace, current: true, destination: null }];
  }
  if (SHARED_WORKSPACES && !user && !direct.length && !linked.length) redirect("/login?reason=session-expired");
  linked = linked.filter(({ id }) => !direct.some((workspace) => workspace.id === id));
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
      <AuthHeading title={t("workspacePicker.title")} body={t(user || direct.length || linked.length ? "workspacePicker.linkedBody" : "workspacePicker.body")} />
      <ul className="space-y-3">
        {direct.map(({ id, name, selection }) => (
          <li key={id}>
            <form action="/api/workspace-session" method="post">
              <input type="hidden" name="workspace" value={selection} />
              {params.returnTo ? <input type="hidden" name="returnTo" value={params.returnTo} /> : null}
              <button className="w-full rounded-xl border border-black/10 px-4 py-4 text-left font-medium hover:bg-[var(--lp-panel)]">{name}</button>
            </form>
          </li>
        ))}
        {linked.length ? linked.map(({ id, name, destination }) => (
          <li key={id}>
            {destination && id !== selected ? <WorkspaceHandoffButton id={id} name={name} destination={destination} returnTo={params.returnTo} /> :
             !destination && selected && id !== selected ? (
              <form action="/api/workspace-session" method="post">
                <input type="hidden" name="workspace" value="directory" />
                {params.returnTo ? <input type="hidden" name="returnTo" value={params.returnTo} /> : null}
                <button className="w-full rounded-xl border border-black/10 px-4 py-4 text-left font-medium hover:bg-[var(--lp-panel)]">{name}</button>
              </form>
            ) : (
              <Link href={currentHref} className="flex items-center justify-between gap-3 rounded-xl border border-black/10 px-4 py-4 font-medium hover:bg-[var(--lp-panel)]">
                {name}<span className="text-sm font-normal text-[var(--lp-muted)]">{t("workspacePicker.current")}</span>
              </Link>
            )}
          </li>
        )) : !user && !SHARED_WORKSPACES && workspaces.map(({ name, href }) => {
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
