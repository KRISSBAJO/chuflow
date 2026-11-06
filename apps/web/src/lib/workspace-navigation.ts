export function safeReturnTo(value: string | undefined, directory: string) {
  if (!value || !value.startsWith(directory) || value.startsWith("//"))
    return directory;
  try {
    const url = new URL(value, "https://chuflow.local");
    return url.origin === "https://chuflow.local" && url.pathname === directory
      ? `${url.pathname}${url.search}${url.hash}`
      : directory;
  } catch {
    return directory;
  }
}

export function detailHref(
  directory: string,
  id: string,
  params: Record<string, string | undefined>,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value) query.set(key, value);
  const returnTo = `${directory}${query.size ? `?${query}` : ""}#record-${id}`;
  return `${directory}/${id}?returnTo=${encodeURIComponent(returnTo)}`;
}
