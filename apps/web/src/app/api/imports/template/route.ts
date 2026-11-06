import { getServerSessionUser } from "@/lib/auth";
import { LEADERSHIP_ROLES } from "@/lib/permissions";
import {
  IMPORT_CONFIG,
  importFieldLabel,
  type ImportKind,
} from "@/lib/import-fields";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const user = await getServerSessionUser().catch(() => null);
  if (!user || !LEADERSHIP_ROLES.includes(user.role as never))
    return new Response("Church leadership access is required.", {
      status: 403,
    });
  const q = new URL(request.url).searchParams;
  const kind = q.get("kind") as ImportKind;
  if (!Object.hasOwn(IMPORT_CONFIG, kind))
    return new Response("Choose an import type.", { status: 400 });
  const fields = IMPORT_CONFIG[kind].fields;
  const format = q.get("format") === "csv" ? "csv" : "xlsx";
  const headers = {
    "Cache-Control": "private, no-store",
    "Content-Disposition": `attachment; filename="chuflow-${kind}-template.${format}"`,
  };
  if (format === "csv")
    return new Response(
      "\uFEFF" + fields.map(importFieldLabel).join(",") + "\r\n",
      { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } },
    );
  const ExcelJS = await import("exceljs");
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet(IMPORT_CONFIG[kind].label);
  sheet.columns = fields.map((key) => ({
    header: importFieldLabel(key),
    key,
    width: 25,
  }));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  for (const field of ["phone", "zipCode"])
    if ((fields as readonly string[]).includes(field))
      sheet.getColumn(field).numFmt = "@";
  const help = book.addWorksheet("Instructions");
  for (const text of [
    "Add records below the header on the first sheet. Do not import this Instructions sheet.",
    "Select the destination church in ChuFlow. Spreadsheet columns cannot grant access or change the church.",
    "Use First name and Last name, or Full name. Full name splits at the first space; review compound names.",
    "Store phone numbers as text to preserve leading zeros and country codes.",
    "Dates: YYYY-MM-DD, or select the matching date format during import.",
    "Yes/No for course and baptism status. Membership status: Active, Inactive, New member or Worker.",
    "Service groups: separate existing group names using a semicolon. Import groups first if needed.",
    "Existing or repeated records are skipped, never overwritten. No visits or welcome messages are created.",
    "Children need guardian and pickup details; use the Children registration workspace.",
  ])
    help.addRow([text]);
  help.getColumn(1).width = 110;
  return new Response(new Uint8Array(await book.xlsx.writeBuffer()), {
    headers: {
      ...headers,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
