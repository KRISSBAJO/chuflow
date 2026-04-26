import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { API_URL } from "./api";
import { canAccessRoute } from "./permissions";

export type SessionUser = {
  _id?: string;
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  oversightRegion?: string;
  district?: string;
  branchId?: string;
  preferences?: {
    interfaceDensity?: string;
    defaultReportDays?: number;
  };
};

const AUTH_COOKIE_NAME = "cms_access_token";

class ApiUnavailableError extends Error {
  constructor() {
    super("Backend API is not reachable");
    this.name = "ApiUnavailableError";
  }
}

export async function getServerSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  let response: Response;

  try {
    response = await fetch(`${API_URL}/auth/me`, {
      method: "GET",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${token}`,
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiUnavailableError();
  }

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as SessionUser;
}

export async function requireServerSession() {
  let user: SessionUser | null;

  try {
    user = await getServerSessionUser();
  } catch (error) {
    if (error instanceof ApiUnavailableError) {
      redirect("/login?reason=api-unavailable");
    }

    throw error;
  }

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireServerRole(pathname: string) {
  const user = await requireServerSession();

  if (!canAccessRoute(user.role, pathname)) {
    redirect("/unauthorized");
  }

  return user;
}
