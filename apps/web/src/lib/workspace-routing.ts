export const ACTIVE_WORKSPACE_COOKIE = "cms_active_workspace";
export const WORKSPACE_TAB_HINT = "cms_workspace_tab_hint";
export const DIRECTORY_COOKIE = "cms_access_token";
export const SHARED_WORKSPACES = process.env.NEXT_PUBLIC_CHUFLOW_SHARED_WORKSPACES === "true";
export const PRIMARY_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.chuflow.com/api";
export const WORKSPACE_PROXY_URL = "/api/workspace-proxy";
export const SHARED_WEB_ORIGIN = process.env.NEXT_PUBLIC_CHUFLOW_WEB_ORIGIN;

export function workspaceId(value?: string | null) {
  return SHARED_WORKSPACES && value && value.length <= 64 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
    ? value : null;
}

export function workspaceApiContext(id?: string | null) {
  const workspace = workspaceId(id);
  return {
    base: workspace ? PRIMARY_API_URL.replace(/\/$/, "") + "/w/" + workspace : PRIMARY_API_URL,
    cookieName: workspace ? "cms_workspace_" + workspace : DIRECTORY_COOKIE,
  };
}

export function workspaceProxyUrl(id?: string | null) {
  const scope = workspaceId(id);
  return WORKSPACE_PROXY_URL + (scope ? "/w/" + scope : "/directory");
}

export function initialWorkspaceProxyUrl() {
  const hint = document.cookie.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(WORKSPACE_TAB_HINT + "="));
  return workspaceProxyUrl(hint?.slice(WORKSPACE_TAB_HINT.length + 1));
}
