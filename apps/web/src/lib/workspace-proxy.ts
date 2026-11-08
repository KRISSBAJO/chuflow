import { DIRECTORY_COOKIE, SHARED_WORKSPACES, workspaceApiContext, workspaceId } from "./workspace-routing";

/*
 * Where a browser request to /api/workspace-proxy/... goes. Signed-in traffic is pinned to the
 * workspace the session cookie selected, so a tab cannot drift into another church's data. The
 * shared sign-in directory lives at the primary API, while a provisioned workspace signs in and
 * recovers passwords at its own API, where its accounts live.
 */

/** Endpoints a workspace serves to people who are not signed in to it yet. */
export const SIGN_IN_ENDPOINT = /^\/auth\/(?:workspace|login|forgot-password|reset-password(?:\/verify)?)$/;

const DIRECTORY_ENDPOINT = /^\/auth\/(?:login|forgot-password|reset-password|workspaces)(?:\/|$)/;

export type ProxyTarget =
  | { status: 404 | 409 }
  | {
      status: 200;
      base: string;
      cookieName: string;
      endpoint: string;
      /** The workspace a successful sign-in on this endpoint opens, when it is not the directory. */
      signInWorkspace: string | null;
      directory: boolean;
    };

export function proxyTarget(path: string[], method: string, activeCookie?: string | null): ProxyTarget {
  if (!SHARED_WORKSPACES) return { status: 404 };
  if (!path.length || path.some((part) => !part || part === "." || part === ".." || /[/%\\]/.test(part))) {
    return { status: 404 };
  }
  const expected = path[0] === "directory" ? null : path[0] === "w" ? workspaceId(path[1]) : undefined;
  if (expected === undefined || (path[0] === "w" && !expected)) return { status: 404 };
  const endpoint = "/" + path.slice(path[0] === "w" ? 2 : 1).map(encodeURIComponent).join("/");
  if (endpoint === "/") return { status: 404 };

  if (expected && SIGN_IN_ENDPOINT.test(endpoint)) {
    const { base, cookieName } = workspaceApiContext(expected);
    return { status: 200, base, cookieName, endpoint, signInWorkspace: endpoint === "/auth/login" ? expected : null, directory: false };
  }

  const active = workspaceId(activeCookie);
  const directory =
    DIRECTORY_ENDPOINT.test(endpoint) ||
    endpoint.includes("/public/") ||
    (endpoint === "/workspace-requests" && method === "POST");
  if (!directory && expected !== active) return { status: 409 };
  const { base, cookieName } = workspaceApiContext(directory ? null : active);
  return { status: 200, base, cookieName, endpoint, signInWorkspace: null, directory: cookieName === DIRECTORY_COOKIE };
}
