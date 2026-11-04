export type DirectoryParams = Record<string, string | undefined>;
export type DirectoryFilter = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
};

export function directoryHref(
  path: string,
  params: DirectoryParams,
  page: number,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value && !["page", "created", "createdName"].includes(key))
      query.set(key, value);
  query.set("page", String(page));
  return `${path}?${query}`;
}

export function browseDirectory<T extends { _id: string }>(
  items: T[],
  params: DirectoryParams,
  text: (item: T) => string,
  name: (item: T) => string,
  filters: Record<string, (item: T) => string> = {},
) {
  const terms = (params.search || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const filtered = items.filter(
    (item) =>
      terms.every((term) => text(item).toLowerCase().includes(term)) &&
      Object.entries(filters).every(
        ([key, value]) => !params[key] || value(item) === params[key],
      ),
  );
  const direction =
    params.sort === "name_desc" || !params.sort || params.sort === "newest"
      ? -1
      : 1;
  filtered.sort((a, b) =>
    params.sort?.startsWith("name_")
      ? direction *
          name(a).localeCompare(name(b), undefined, {
            sensitivity: "base",
            numeric: true,
          }) || a._id.localeCompare(b._id)
      : direction * a._id.localeCompare(b._id),
  );
  const pageSize = [25, 50, 100].includes(Number(params.pageSize))
    ? Number(params.pageSize)
    : 25;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(1, Number(params.page) || 1), totalPages);
  return {
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageSize,
    totalPages,
  };
}

export function createdHref(path: string, result: unknown, name = "Record") {
  const record = result as { _id?: string; id?: string } | null;
  const [pathname, existing] = path.split("?");
  const query = new URLSearchParams(existing);
  query.set("created", record?._id || record?.id || "saved");
  query.set("createdName", name);
  return `${pathname}?${query}`;
}
