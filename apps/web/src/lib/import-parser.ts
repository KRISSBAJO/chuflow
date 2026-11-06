import { inflateRawSync } from "node:zlib";
export const IMPORT_MAX_FILE = 8 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 10001;
export type ParsedImportRow = { sourceRow: number; cells: string[] };
export type ParsedImportSheet = { name: string; rows: ParsedImportRow[] };
function storedZip(entries: { name: Buffer; data: Buffer }[]) {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const local: Buffer[] = [],
    central: Buffer[] = [];
  let offset = 0;
  for (const { name, data } of entries) {
    let crc = 0xffffffff;
    for (const byte of data) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
    crc = (crc ^ 0xffffffff) >>> 0;
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(0x800, 6);
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(data.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(name.length, 26);
    const index = Buffer.alloc(46);
    index.writeUInt32LE(0x02014b50);
    index.writeUInt16LE(20, 4);
    index.writeUInt16LE(20, 6);
    index.writeUInt16LE(0x800, 8);
    index.writeUInt32LE(crc, 16);
    index.writeUInt32LE(data.length, 20);
    index.writeUInt32LE(data.length, 24);
    index.writeUInt16LE(name.length, 28);
    index.writeUInt32LE(offset, 42);
    local.push(head, name, data);
    central.push(index, name);
    offset += head.length + name.length + data.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
export function guardXlsx(buffer: Buffer) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--)
    if (
      buffer.readUInt32LE(i) === 0x06054b50 &&
      i + 22 + buffer.readUInt16LE(i + 20) === buffer.length
    ) {
      eocd = i;
      break;
    }
  if (
    eocd < 0 ||
    buffer.readUInt16LE(eocd + 4) ||
    buffer.readUInt16LE(eocd + 6)
  )
    throw new Error("Use a standard, unencrypted .xlsx file.");
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16),
    total = 0;
  const entries: { name: Buffer; data: Buffer }[] = [];
  if (!count || count > 1000 || count === 65535)
    throw new Error(
      "This workbook is too complex. Save just the sheet you need.",
    );
  for (let i = 0; i < count; i++) {
    if (
      offset + 46 > buffer.length ||
      buffer.readUInt32LE(offset) !== 0x02014b50
    )
      throw new Error("Invalid Excel workbook.");
    const flags = buffer.readUInt16LE(offset + 8),
      method = buffer.readUInt16LE(offset + 10),
      size = buffer.readUInt32LE(offset + 20),
      expanded = buffer.readUInt32LE(offset + 24),
      nameLength = buffer.readUInt16LE(offset + 28),
      extra = buffer.readUInt16LE(offset + 30),
      comment = buffer.readUInt16LE(offset + 32),
      local = buffer.readUInt32LE(offset + 42);
    if (
      flags & 1 ||
      ![0, 8].includes(method) ||
      expanded > 16 * 1024 * 1024 ||
      local + 30 > buffer.length ||
      buffer.readUInt32LE(local) !== 0x04034b50
    )
      throw new Error("Use a smaller, unencrypted workbook without macros.");
    const name = buffer
      .subarray(offset + 46, offset + 46 + nameLength)
      .toString("utf8");
    if (/vbaProject|activeX|embeddings\//i.test(name))
      throw new Error(
        "Macro-enabled workbooks are not supported. Save as .xlsx or CSV.",
      );
    if (
      buffer.readUInt16LE(local + 8) !== method ||
      buffer.readUInt16LE(local + 6) & 1
    )
      throw new Error("Invalid workbook compression.");
    const start =
      local +
      30 +
      buffer.readUInt16LE(local + 26) +
      buffer.readUInt16LE(local + 28);
    if (start + size > buffer.length || size === 0xffffffff)
      throw new Error("Invalid workbook entry.");
    const packed = buffer.subarray(start, start + size);
    const raw =
      method === 8
        ? inflateRawSync(packed, { maxOutputLength: 16 * 1024 * 1024 })
        : packed;
    total += raw.length;
    if (total > 32 * 1024 * 1024 || raw.length !== expanded)
      throw new Error(
        "Workbook is too large when opened. Split it into smaller files.",
      );
    if (
      /\.xml$/i.test(name) &&
      (/<!DOCTYPE|<!ENTITY/i.test(raw.toString("utf8")) || raw.includes(0))
    )
      throw new Error("Unsupported workbook XML.");
    entries.push({ name: Buffer.from(name, "utf8"), data: raw });
    offset += 46 + nameLength + extra + comment;
  }
  return storedZip(entries);
}
export function parseDelimited(
  text: string,
  separator?: string,
): ParsedImportRow[] {
  const input = text.replace(/^\uFEFF/, "");
  const sep =
    separator ||
    [",", ";", "\t"].sort(
      (a, b) =>
        input.split(/\r?\n/)[0].split(b).length -
        input.split(/\r?\n/)[0].split(a).length,
    )[0];
  const rows: ParsedImportRow[] = [];
  let cells: string[] = [],
    cell = "",
    quoted = false,
    afterQuote = false,
    line = 1,
    startLine = 1;
  const pushCell = () => {
    if (cell.length > 2000)
      throw new Error(
        `Cell on row ${startLine} is longer than 2,000 characters.`,
      );
    cells.push(cell);
    cell = "";
    if (cells.length > 60)
      throw new Error("Use a sheet with no more than 60 columns.");
  };
  const pushRow = () => {
    pushCell();
    if (cells.some((c) => c.trim())) rows.push({ sourceRow: startLine, cells });
    cells = [];
    if (rows.length > IMPORT_MAX_ROWS)
      throw new Error(
        "Import up to 10,000 records at a time. Split this file.",
      );
  };
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else {
        cell += c;
        if (c === "\n") line++;
      }
    } else if (c === sep) {
      pushCell();
      afterQuote = false;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && input[i + 1] === "\n") i++;
      pushRow();
      line++;
      startLine = line;
      afterQuote = false;
    } else if (c === '"' && !cell && !afterQuote) {
      quoted = true;
    } else {
      if (afterQuote && !/\s/.test(c))
        throw new Error(`Malformed quoted cell on row ${startLine}.`);
      if (!afterQuote) cell += c;
    }
    if (cell.length > 2000)
      throw new Error(`Cell on row ${startLine} is too long.`);
  }
  if (quoted) throw new Error("A quoted CSV cell was not closed.");
  if (cell || cells.length) pushRow();
  return rows;
}
export async function parseImportFile(
  buffer: Buffer,
  filename: string,
): Promise<ParsedImportSheet[]> {
  if (!buffer.length || buffer.length > IMPORT_MAX_FILE)
    throw new Error("Choose a file smaller than 8 MB.");
  if (/\.(csv|tsv)$/i.test(filename)) {
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      throw new Error("Save this file as CSV UTF-8, then upload it again.");
    }
    return [
      {
        name: "Spreadsheet",
        rows: parseDelimited(text, /\.tsv$/i.test(filename) ? "\t" : undefined),
      },
    ];
  }
  if (!/\.xlsx$/i.test(filename))
    throw new Error(
      "Choose Excel (.xlsx), CSV or TSV. Save old .xls files as .xlsx first.",
    );
  const safe = guardXlsx(buffer);
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(safe as never);
  if (workbook.worksheets.length > 10)
    throw new Error("Choose a workbook with up to 10 sheets.");
  let total = 0;
  const result: ParsedImportSheet[] = [];
  for (const sheet of workbook.worksheets) {
    const rows: ParsedImportRow[] = [];
    sheet.eachRow((row, number) => {
      if (row.cellCount > 60)
        throw new Error("Use a sheet with no more than 60 columns.");
      const cells: string[] = [];
      for (let n = 1; n <= row.cellCount; n++) {
        const cell = row.getCell(n);
        const value = cell.value;
        let text = "";
        if (value instanceof Date) text = value.toISOString().slice(0, 10);
        else if (
          value &&
          typeof value === "object" &&
          ("formula" in value || "sharedFormula" in value)
        ) {
          const v = value.result;
          if (v === undefined || typeof v === "object")
            throw new Error(
              "Formula cells need saved values. Copy and paste values before importing.",
            );
          text = String(v);
        } else text = cell.text || "";
        if (text.length > 2000)
          throw new Error(`Cell on row ${number} is too long.`);
        cells.push(text);
      }
      if (cells.some((c) => c.trim())) {
        rows.push({ sourceRow: number, cells });
        total++;
      }
      if (total > IMPORT_MAX_ROWS + 10)
        throw new Error(
          "Import up to 10,000 records at a time. Split this workbook.",
        );
    });
    if (rows.length) result.push({ name: sheet.name, rows });
  }
  if (!result.length) throw new Error("This workbook has no data.");
  return result;
}
