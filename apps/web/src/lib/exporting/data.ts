import {
  EXPORTS,
  field,
  type ExportDefinition,
  type ExportRow,
} from "./catalog";

export const MAX_EXPORT_ROWS = 100_000;
export class ExportError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}
export type ExportSheet = {
  title: string;
  rows: ExportRow[];
  columns: ExportDefinition["columns"];
};

export async function collectExport(
  resource: string,
  input: URLSearchParams,
  fetchJson: (path: string) => Promise<unknown>,
) {
  const definition = EXPORTS[resource];
  if (!definition) throw new ExportError("Unknown table", 404);
  const query = new URLSearchParams(definition.fixed);
  for (const key of definition.filters)
    if (input.get(key)) query.set(key, input.get(key)!);
  if (resource === "workspace-requests") {
    if (input.get("workspaceSearch"))
      query.set("search", input.get("workspaceSearch")!);
    if (input.get("workspaceStatus"))
      query.set("status", input.get("workspaceStatus")!);
  }
  if (resource === "audit-logs") {
    if (input.get("auditSearch"))
      query.set("search", input.get("auditSearch")!);
    if (input.get("auditEntityType"))
      query.set("entityType", input.get("auditEntityType")!);
  }
  const appliedFilters = Object.fromEntries(query);
  const rows: ExportRow[] = [];
  let firstPayload: unknown;
  let page = 1;
  let totalPages = 1;
  let expectedTotal: number | undefined;
  const seen = new Set<string>();
  do {
    const request = new URLSearchParams(query);
    if (definition.paginated) {
      request.set("page", String(page));
      if (resource === "members") request.set("pageSize", "100");
      else if (resource !== "evangelism") request.set("limit", "100");
    }
    const payload = await fetchJson(
      `${definition.endpoint}${definition.endpoint.includes("?") ? "&" : "?"}${request}`,
    );
    if (page === 1) firstPayload = payload;
    const items = Array.isArray(payload)
      ? payload
      : field(payload, definition.rowsPath || "items");
    if (!Array.isArray(items))
      throw new ExportError(
        "This table did not return an exportable list.",
        502,
      );
    const reportedTotal =
      field(payload, "pagination.total") ?? field(payload, "total");
    if (typeof reportedTotal === "number") {
      if (reportedTotal > MAX_EXPORT_ROWS)
        throw new ExportError(
          "More than 100,000 rows match. Narrow the filters and try again.",
          413,
        );
      if (expectedTotal !== undefined && expectedTotal !== reportedTotal)
        throw new ExportError(
          "The table changed during export. Please retry.",
          409,
        );
      expectedTotal = reportedTotal;
    }
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const id = field(item, "_id");
      if (definition.paginated && typeof id === "string") {
        if (seen.has(id))
          throw new ExportError(
            "The table changed during export. Please retry.",
            409,
          );
        seen.add(id);
      }
      rows.push(item as ExportRow);
    }
    if (rows.length > MAX_EXPORT_ROWS)
      throw new ExportError(
        "More than 100,000 rows match. Narrow the filters and try again.",
        413,
      );
    const reportedPages =
      field(payload, "pagination.totalPages") ?? field(payload, "totalPages");
    totalPages =
      definition.paginated && typeof reportedPages === "number"
        ? reportedPages
        : 1;
    if (
      totalPages > MAX_EXPORT_ROWS ||
      (items.length === 0 && page < totalPages)
    )
      throw new ExportError(
        "The table changed during export. Please retry.",
        409,
      );
    page++;
  } while (page <= totalPages);
  if (
    definition.paginated &&
    expectedTotal !== undefined &&
    rows.length !== expectedTotal
  )
    throw new ExportError(
      "The table changed during export. Please retry.",
      409,
    );
  if (definition.branchLookup) {
    const branches = await fetchJson("/branches");
    if (Array.isArray(branches)) {
      const names = new Map(
        branches.map((branch) => [field(branch, "_id"), field(branch, "name")]),
      );
      for (const row of rows)
        if (typeof row.branchId === "string")
          row.branchId = {
            _id: row.branchId,
            name: names.get(row.branchId) || "",
          };
    }
  }
  const filtered = definition.filterRows
    ? definition.filterRows(rows, appliedFilters)
    : rows;
  const sheets: ExportSheet[] = [
    { title: definition.title, rows: filtered, columns: definition.columns },
  ];
  for (const extra of definition.extraSheets || []) {
    const extraRows = field(firstPayload, extra.path);
    if (Array.isArray(extraRows))
      sheets.push({
        title: extra.title,
        rows: extraRows as ExportRow[],
        columns: extra.columns,
      });
    else if (extraRows && typeof extraRows === "object")
      sheets.push({
        title: extra.title,
        rows: [extraRows as ExportRow],
        columns: extra.columns,
      });
  }
  return { definition, filters: appliedFilters, sheets };
}
