import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { EntitlementSnapshot } from "./entitlements";
import { canAccessRoute } from "./permissions";
import { safeReturnTo } from "./return-to";
import { workspaceServerContext } from "./workspace-server";
import { serverRead, unavailableHref } from "./server-read";

export type SessionUser = {
  _id?: string;
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  workspace?: { id: string; name: string };
  additionalPermissions?: string[];
  additionalPermissionExpiries?: Record<string, string | null>;
  oversightRegion?: string;
  district?: string;
  branchId?: string;
  hasOversight?: boolean;
  preferences?: {
    interfaceDensity?: string;
    defaultReportDays?: number;
  };
  /** The workspace's plan, when the API enforces one. */
  entitlements?: EntitlementSnapshot;
};

class ApiUnavailableError extends Error {
  constructor() {
    super("ChuFlow API is temporarily unavailable");
    this.name = "ApiUnavailableError";
  }
}

export async function getServerSessionUser(): Promise<SessionUser | null> {
  const { base, token, headers: sessionHeaders } = await workspaceServerContext();

  if (!token) {
    return null;
  }

  let response: Response;

  try {
    response = await serverRead("/auth/me", sessionHeaders, base);
  } catch {
    throw new ApiUnavailableError();
  }

  if (!response.ok) {
    if (response.status >= 500 || response.status === 429) throw new ApiUnavailableError();
    return null;
  }

  const user = (await response.json()) as SessionUser;
  if (user.role === "resident_pastor") {
    try {
      const context = await serverRead("/hierarchy/context", sessionHeaders, base);
      if (context.ok) user.hasOversight = ((await context.json()) as { hasOversight: boolean }).hasOversight;
    } catch { user.hasOversight = false; }
  }
  return user;
}

export async function requireServerSession(returnTo?: string) {
  const destination = returnTo || (await headers()).get("x-chuflow-return-to");
  const returnQuery = destination ? `&returnTo=${encodeURIComponent(safeReturnTo(destination))}` : "";
  let user: SessionUser | null;

  try {
    user = await getServerSessionUser();
  } catch (error) {
    if (error instanceof ApiUnavailableError) {
      redirect(await unavailableHref(returnTo));
    }

    throw error;
  }

  if (!user) {
    // The cookie is still there but no longer valid. The reason tells the proxy not to bounce
    // this visit back to /dashboard, which would loop forever.
    redirect(`/login?reason=session-expired${returnQuery}`);
  }

  return user;
}

export async function requireServerRole(pathname: string) {
  const user = await requireServerSession();

  if (!canAccessRoute(user.role, pathname, user.additionalPermissions)) {
    redirect("/unauthorized");
  }

  return user;
}
