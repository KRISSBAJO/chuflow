import { serverRead } from "./server-read";
import { SHARED_WORKSPACES, workspaceApiContext, workspaceId } from "./workspace-routing";

export type SignInWorkspace = { id: string; name: string };

/**
 * The provisioned workspace a sign-in or recovery page should talk to, from its `?workspace=`
 * parameter. `null` means the shared directory (the primary workspace); `"missing"` means the
 * handle names no workspace the gateway serves right now.
 */
export async function resolveSignInWorkspace(param?: string | null): Promise<SignInWorkspace | "missing" | null> {
  if (!param) return null;
  const id = SHARED_WORKSPACES ? workspaceId(param) : null;
  if (!id) return "missing";
  try {
    const response = await serverRead("/auth/workspace", {}, workspaceApiContext(id).base);
    if (!response.ok) return "missing";
    const info = (await response.json()) as { id?: string; name?: string };
    return info.id === id && typeof info.name === "string" ? { id, name: info.name } : "missing";
  } catch {
    return "missing";
  }
}
