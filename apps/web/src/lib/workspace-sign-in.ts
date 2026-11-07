import { SHARED_WORKSPACES, workspaceId } from "./workspace-routing";

export function workspaceSignInOptions(
  currentName: string | undefined,
  configured: string | undefined,
) {
  const options: { name: string; href: string; id?: string }[] = [
    { name: currentName?.trim() || "Winners Chapel International", href: "/login" },
  ];
  if (!configured) return options;

  let entries: unknown;
  try {
    entries = JSON.parse(configured);
  } catch {
    return options;
  }
  if (!Array.isArray(entries)) return options;

  const origins = new Set<string>();
  for (const entry of entries) {
    if (typeof entry?.name !== "string" || typeof entry.origin !== "string") continue;
    const name = entry.name.trim();
    if (!name || name.length > 120) continue;
    let url: URL;
    try {
      url = new URL(entry.origin);
    } catch {
      continue;
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      origins.has(url.origin)
    ) continue;
    origins.add(url.origin);
    const id = typeof entry.id === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)
      ? entry.id
      : undefined;
    options.push({ name, href: url.origin + "/login", ...(id ? { id } : {}) });
  }
  return options;
}


export type WorkspaceMembership = { id: string; name: string; current: boolean };

export function linkedWorkspaceOptions(memberships: WorkspaceMembership[]) {
  const destinations = workspaceSignInOptions(undefined, process.env.NEXT_PUBLIC_CHUFLOW_WORKSPACES);
  return memberships.flatMap<WorkspaceMembership & { destination: string | null }>((membership) => {
    if (membership.current) return [{ ...membership, destination: null }];
    if (SHARED_WORKSPACES) return workspaceId(membership.id)
      ? [{ ...membership, destination: "/api/workspace-session" }]
      : [];
    const site = destinations.find((option) => option.id === membership.id);
    return site ? [{ ...membership, destination: new URL("/api/workspace-session", site.href).href }] : [];
  });
}

export function workspaceDirectoryHref() {
  if (SHARED_WORKSPACES) return "/workspaces";
  const origin = process.env.NEXT_PUBLIC_CHUFLOW_DIRECTORY_ORIGIN;
  return origin && /^https:\/\/[a-z0-9.-]+(?::[0-9]+)?$/i.test(origin)
    ? origin + "/workspaces"
    : "/workspaces";
}


export function hasLinkedWorkspaceDirectory() {
  return SHARED_WORKSPACES || workspaceSignInOptions(undefined, process.env.NEXT_PUBLIC_CHUFLOW_WORKSPACES).some((option) => option.id);
}
