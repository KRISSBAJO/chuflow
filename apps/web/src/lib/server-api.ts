import { cookies } from "next/headers";
import { API_URL } from "./api";

const AUTH_COOKIE_NAME = "cms_access_token";

async function getAuthHeaders() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const headers: Record<string, string> = {};

  if (token) {
    headers.Cookie = `${AUTH_COOKIE_NAME}=${token}`;
  }

  return headers;
}

export async function serverGet<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      headers,
      cache: "no-store",
    });
  } catch {
    throw new Error("Backend API is not reachable. Start `npm run dev:api` and refresh.");
  }

  if (!response.ok) {
    throw new Error(`GET ${path} failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function publicServerGet<T>(path: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      cache: "no-store",
    });
  } catch {
    throw new Error("Backend API is not reachable. Start `npm run dev:api` and refresh.");
  }

  if (!response.ok) {
    throw new Error(`GET ${path} failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}
