const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
function load(name) {
  const file = path.join(__dirname, "../src/lib", name + ".ts");
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    URL,
    URLSearchParams,
  });
  return module.exports;
}
const { safeReturnTo, detailHref } = load("workspace-navigation");
const { memberSectionPayload } = load("member-section");
test("return links preserve directory filters, pagination and record anchor", () => {
  const href = detailHref("/members", "abc", {
    search: "Sample & Family",
    page: "3",
    tab: "members",
  });
  const url = new URL(href, "https://chuflow.local");
  assert.equal(url.pathname, "/members/abc");
  assert.equal(
    safeReturnTo(url.searchParams.get("returnTo"), "/members"),
    "/members?search=Sample+%26+Family&page=3&tab=members#record-abc",
  );
});
test("return links reject outside sites and unrelated internal pages", () => {
  for (const bad of [
    "https://evil.test",
    "//evil.test",
    "/members-old",
    "/members/abc",
    "/users",
    "/members/../users",
  ])
    assert.equal(safeReturnTo(bad, "/members"), "/members");
});
test("profile edits do not send or clear spiritual growth and group membership", () => {
  const d = new FormData();
  d.set("firstName", "Sample");
  d.set("serviceUnitIds", "group1");
  d.set("bccStatus", "yes");
  const p = memberSectionPayload(d, "profile");
  assert.deepEqual(Object.keys(p), ["firstName"]);
});
test("spiritual edits preserve group assignments and profile values", () => {
  const d = new FormData();
  d.set("bccStatus", "yes");
  d.set("firstName", "Sample");
  assert.deepEqual(Object.keys(memberSectionPayload(d, "growth")), [
    "bccStatus",
  ]);
});
test("explicitly removing every group sends an empty assignment only for group edits", () => {
  const d = new FormData();
  const p = memberSectionPayload(d, "groups");
  assert.ok(Array.isArray(p.serviceUnitIds));
  assert.equal(p.serviceUnitIds.length, 0);
  assert.equal("serviceUnitIds" in memberSectionPayload(d, "growth"), false);
});
test("a cleared email is explicitly cleared while omitted fields remain untouched", () => {
  const d = new FormData();
  d.set("email", "");
  const p = memberSectionPayload(d, "profile");
  assert.equal(p.email, null);
  assert.equal("phone" in p, false);
});
