/** API base URL. Set EXPO_PUBLIC_API_URL to point the app at a local or staging API. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://api.chuflow.com/api').replace(/\/$/, '');

/** The full website, for the screens that only exist there. */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://chuflow.com').replace(/\/$/, '');

export type WorkspaceDestination = { id: string; apiUrl: string; webUrl: string };

function httpsOrigin(raw: unknown) {
  if (typeof raw !== 'string') return;
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:' && url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password) {
      return url.origin;
    }
  } catch {}
}

function workspaceDestinations(raw?: string): WorkspaceDestination[] {
  try {
    const entries: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(entries)) return [];
    return entries.flatMap((entry) => {
      const apiOrigin = httpsOrigin(entry?.apiOrigin);
      const webUrl = httpsOrigin(entry?.webOrigin);
      if (!apiOrigin || !webUrl || typeof entry.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)) return [];
      return [{ id: entry.id, apiUrl: apiOrigin + '/api', webUrl }];
    });
  } catch {
    return [];
  }
}

export const WORKSPACE_DESTINATIONS = workspaceDestinations(process.env.EXPO_PUBLIC_CHUFLOW_WORKSPACES);

export const SHARED_WORKSPACES = process.env.EXPO_PUBLIC_CHUFLOW_SHARED_WORKSPACES === 'true';

export function workspaceDestination(id: string): WorkspaceDestination | undefined {
  if (SHARED_WORKSPACES && id.length <= 64 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    return { id, apiUrl: `${API_URL}/w/${id}`, webUrl: WEB_URL };
  }
  return WORKSPACE_DESTINATIONS.find((site) => site.id === id);
}
