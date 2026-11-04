import ExcelJS from "exceljs";
import type { ExportCell } from "./catalog";
import type { ExportSheet } from "./data";

function safeCell(value: ExportCell): ExportCell {
  return typeof value === "string"
    ? value
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
        .slice(0, 32767)
    : value;
}
export async function exportWorkbook(
  sheets: ExportSheet[],
  filters: Record<string, string> = {},
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ChuFlow";
  workbook.created = new Date();
  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.title.slice(0, 31), {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    worksheet.columns = sheet.columns.map((column) => ({
      header: column.header,
      width: Math.min(42, Math.max(18, column.header.length + 4)),
    }));
    for (const row of sheet.rows)
      worksheet.addRow(
        sheet.columns.map((column) => safeCell(column.value(row))),
      );
    worksheet.getRow(1).height = 28;
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF111111" },
      };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: {
        row: Math.max(1, worksheet.rowCount),
        column: sheet.columns.length,
      },
    };
    sheet.columns.forEach((column, index) => {
      if (column.kind)
        worksheet.getColumn(index + 1).numFmt =
          column.kind === "date"
            ? 'yyyy-mm-dd hh:mm:ss "UTC"'
            : "#,##0.00;[Red](#,##0.00)";
    });
  }
  const info = workbook.addWorksheet("Export info");
  info.columns = [
    { header: "Setting", width: 28 },
    { header: "Value", width: 75 },
  ];
  info.addRow(["Generated (UTC)", new Date().toISOString()]);
  info.addRow(["Main table rows", sheets[0]?.rows.length || 0]);
  info.addRow(["Scope", "Only records available to the signed-in user"]);
  for (const [key, value] of Object.entries(filters)) info.addRow([key, value]);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

export function exportCsv(sheet: ExportSheet) {
  const quote = (value: ExportCell) => {
    let content =
      value instanceof Date
        ? value.toISOString()
        : value === null
          ? ""
          : String(value);
    // Text beginning with spreadsheet operators must remain text after import.
    if (typeof value === "string" && /^[\s]*[=+\-@\t\r]/.test(content))
      content = "'" + content;
    return '"' + content.replace(/"/g, '""') + '"';
  };
  return (
    "\uFEFF" +
    [
      sheet.columns.map((column) => quote(column.header)).join(","),
      ...sheet.rows.map((row) =>
        sheet.columns
          .map((column) => quote(safeCell(column.value(row))))
          .join(","),
      ),
    ].join("\r\n")
  );
}
