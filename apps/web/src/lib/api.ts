export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = (await response.json()) as { message?: string | string[] };
      const message = Array.isArray(json.message) ? json.message.join(", ") : json.message;
      throw new Error(message || `Request failed with status ${response.status}`);
    }

    const body = await response.text();
    throw new Error(body || `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function apiGet<T>(path: string) {
  const response = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    credentials: "include",
  });
  return parseResponse<T>(response);
}

export async function apiPost<T>(path: string, body: unknown) {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(body),
  });
  return parseResponse<T>(response);
}

export async function apiPatch<T>(path: string, body: unknown) {
  const response = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(body),
  });
  return parseResponse<T>(response);
}
