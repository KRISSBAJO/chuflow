const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  ts = require("typescript");
function load(name) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, "../src/lib", name + ".ts"), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      module,
      exports: module.exports,
      require,
      Buffer,
      TextDecoder,
      Date,
      Uint8Array,
    },
  );
  return module.exports;
}
const { parseImportFile, parseDelimited, guardXlsx } = load("import-parser");
const { loginErrorKey } = load("auth-errors");
test("login failures map to safe messages, never server response text", () => {
  for (const [status, key] of [
    [401, "incorrect"],
    [403, "restricted"],
    [429, "tooManyAttempts"],
    [503, "unavailable"],
    [422, "checkDetails"],
    [418, "failed"],
  ])
    assert.equal(loginErrorKey(status), key);
});
test("CSV retains phone zeros, escaped quotes, multiline values and source rows", async () => {
  const [sheet] = await parseImportFile(
    Buffer.from(
      '\ufeffName,Phone,Notes\r\nTest,00123456789,"One, two\n""three"""\r\n',
    ),
    "people.csv",
  );
  assert.equal(sheet.rows[1].cells[1], "00123456789");
  assert.equal(sheet.rows[1].cells[2], 'One, two\n"three"');
  assert.equal(sheet.rows[1].sourceRow, 2);
});
test("CSV rejects malformed quoting, oversized cells and invalid UTF-8", async () => {
  assert.throws(() => parseDelimited('Name\n"unclosed'));
  assert.throws(() => parseDelimited("Name\n" + "a".repeat(2001)));
  await assert.rejects(
    () => parseImportFile(Buffer.from([255, 254]), "x.csv"),
    /UTF-8/,
  );
});
test("XLSX preserves dates and text phones without evaluating formulas", async () => {
  const ExcelJS = require("exceljs");
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Members");
  sheet.addRow(["Name", "Phone", "Date", "Count"]);
  sheet.addRow([
    "Sample",
    "00123456789",
    new Date("2020-02-29T00:00:00Z"),
    { formula: "1+1", result: 2 },
  ]);
  const [parsed] = await parseImportFile(
    Buffer.from(await book.xlsx.writeBuffer()),
    "x.xlsx",
  );
  assert.equal(parsed.rows[1].cells[1], "00123456789");
  assert.equal(parsed.rows[1].cells[2], "2020-02-29");
  assert.equal(parsed.rows[1].cells[3], "2");
});
test("XLSX rejects formulas without cached values and malformed archives", async () => {
  const ExcelJS = require("exceljs");
  const book = new ExcelJS.Workbook();
  book.addWorksheet("Members").addRow([{ formula: "1+1" }]);
  const bytes = Buffer.from(await book.xlsx.writeBuffer());
  await assert.rejects(() => parseImportFile(bytes, "x.xlsx"), /saved values/);
  assert.throws(() => guardXlsx(Buffer.from("not zip")));
  await assert.rejects(
    () => parseImportFile(Buffer.from("x"), "x.xls"),
    /xlsx/,
  );
});
