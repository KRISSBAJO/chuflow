import { cookies } from "next/headers";
import { getServerSessionUser } from "@/lib/auth";
import { canAccessRoute } from "@/lib/permissions";
import { API_URL } from "@/lib/api";
import { EXPORTS, type ExportRow } from "@/lib/exporting/catalog";
import { collectExport, ExportError } from "@/lib/exporting/data";
import { exportCsv, exportWorkbook } from "@/lib/exporting/workbook";

export const runtime = "nodejs";
export const maxDuration = 120;
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

async function download(request: Request, resource: string, local: boolean) {
  try {
    const definition = EXPORTS[resource];
    if (!definition) throw new ExportError("Unknown table", 404);
    const user = await getServerSessionUser().catch(() => null);
    if (!user)
      throw new ExportError(
        "Please sign in again to download this table.",
        401,
      );
    if (!canAccessRoute(user.role, definition.permission))
      throw new ExportError("You do not have access to this table.", 403);
    const query = new URL(request.url).searchParams;
    if (resource === "reports" && !query.get("days"))
      query.set("days", String(user.preferences?.defaultReportDays || 30));
    const format = query.get("format") || "xlsx";
    if (!["xlsx", "csv"].includes(format))
      throw new ExportError("Choose Excel or CSV.");
    const token = (await cookies()).get("cms_access_token")?.value;
    const fetchJson = async (path: string) => {
      const response = await fetch(`${API_URL}${path}`, {
        headers: { Cookie: `cms_access_token=${token}` },
        cache: "no-store",
        signal: request.signal,
      });
      if (!response.ok)
        throw new ExportError(
          response.status === 403
            ? "You do not have permission to export this table."
            : "Could not read the table. Please try again.",
          response.status,
        );
      return response.json() as Promise<unknown>;
    };
    let result;
    if (local) {
      if (
        ![
          "attendance",
          "attendance-individual",
          "service-types",
          "service-schedules",
        ].includes(resource)
      )
        throw new ExportError(
          "This table must be exported from its saved records.",
        );
      const raw = await request.text();
      if (Buffer.byteLength(raw) > 8_000_000)
        throw new ExportError(
          "This table is too large for a direct download.",
          413,
        );
      const body = JSON.parse(raw) as { rows?: unknown };
      if (
        !Array.isArray(body.rows) ||
        body.rows.length > 25000 ||
        body.rows.some(
          (row) => !row || typeof row !== "object" || Array.isArray(row),
        )
      )
        throw new ExportError("Invalid table data.");
      result = {
        filters: { selection: "All matching rows from the table controls" },
        sheets: [
          {
            title: definition.title,
            rows: body.rows as ExportRow[],
            columns: definition.columns,
          },
        ],
      };
    } else result = await collectExport(resource, query, fetchJson);
    const filename = `chuflow-${resource}-${new Date().toISOString().slice(0, 10)}.${format}`;
    const content =
      format === "csv"
        ? exportCsv(result.sheets[0])
        : await exportWorkbook(result.sheets, result.filters);
    return new Response(
      typeof content === "string" ? content : (content as unknown as BodyInit),
      {
        headers: {
          ...headers,
          "Content-Type":
            format === "csv"
              ? "text/csv; charset=utf-8"
              : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof ExportError
            ? error.message
            : "The export could not be completed. Please try again.",
      },
      { status: error instanceof ExportError ? error.status : 500, headers },
    );
  }
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  return download(request, (await params).resource, false);
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  return download(request, (await params).resource, true);
}
