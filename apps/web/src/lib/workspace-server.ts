import { cookies } from "next/headers";
import { ACTIVE_WORKSPACE_COOKIE, workspaceApiContext, workspaceProxyUrl } from "./workspace-routing";

export async function workspaceServerContext() {
  const store = await cookies();
  const id = store.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const { base, cookieName } = workspaceApiContext(id);
  const token = store.get(cookieName)?.value;
  const headers: Record<string, string> = token ? { Cookie: `${cookieName}=${token}` } : {};
  return { base, token, headers, proxyUrl: workspaceProxyUrl(id) };
}
