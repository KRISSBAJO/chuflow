export function workspaceSignInOptions(
  currentName: string | undefined,
  configured: string | undefined,
) {
  const options = [
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
    options.push({ name, href: url.origin + "/login" });
  }
  return options;
}
