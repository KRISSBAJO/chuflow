const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "../../..");
function load(file) {
  const module = { exports: {} };
  const code = ts.transpileModule(
    fs.readFileSync(path.join(root, file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  vm.runInNewContext(code, {
    module,
    URLSearchParams,
    exports: module.exports,
    require: (name) => {
      if (name === "./catalog")
        return load("apps/web/src/lib/exporting/catalog.ts");
      if (name === "./capabilities")
        return load("apps/web/src/lib/capabilities.ts");
      throw Error(name);
    },
  });
  return module.exports;
}
const cap = load("apps/web/src/lib/capabilities.ts");
const routes = load("apps/web/src/lib/permissions.ts");
test("delegated feature routes remain action-specific and never unlock permission management", () => {
  assert.equal(
    routes.canAccessRoute("follow_up", "/members", ["members.view"]),
    true,
  );
  assert.equal(
    routes.canAccessRoute("follow_up", "/members/new", ["members.view"]),
    false,
  );
  assert.equal(
    routes.canAccessRoute("follow_up", "/members/new", ["members.create"]),
    true,
  );
  assert.equal(
    routes.canAccessRoute("children_worker", "/members", ["members.view"]),
    true,
  );
  assert.equal(
    routes.canAccessRoute("children_worker", "/users", ["members.edit"]),
    false,
  );
  assert.equal(
    routes.canAccessRoute("follow_up", "/permissions", ["users.admin"]),
    false,
  );
  assert.equal(routes.canAccessRoute("resident_pastor", "/permissions"), true);
  assert.equal(
    routes.canAccessRoute("associate_pastor", "/permissions"),
    false,
  );
  assert.equal(
    routes.canAccessRoute("follow_up", "/finance/new", ["finance.view"]),
    false,
  );
  assert.equal(
    routes.canAccessRoute("follow_up", "/finance/new", ["finance.expenses"]),
    true,
  );
});
test("timed and unknown capability names fail closed", () => {
  assert.equal(
    cap.hasAdditionalPermission(
      {
        additionalPermissions: ["members.edit"],
        additionalPermissionExpiries: {
          "members.edit": "2020-01-01T00:00:00Z",
        },
      },
      "members.view",
    ),
    false,
  );
  assert.equal(
    cap.hasAdditionalPermission(
      { additionalPermissions: ["users.admin"] },
      "users.admin",
    ),
    false,
  );
});
test("API and web capability catalogs stay identical", () => {
  const backend = load("apps/api/src/common/permissions.ts");
  assert.equal(
    JSON.stringify(cap.PERMISSION_CATALOG),
    JSON.stringify(backend.PERMISSION_CATALOG),
  );
});
test("all supported interface languages contain the complete permission manager and capability labels", () => {
  const messages = ["en", "fr", "es", "pt"].map(
    (locale) =>
      JSON.parse(
        fs.readFileSync(
          path.join(root, `apps/web/messages/${locale}/permissions.json`),
          "utf8",
        ),
      ).permissionManager,
  );
  for (const message of messages) {
    assert.deepEqual(
      Object.keys(message).sort(),
      Object.keys(messages[0]).sort(),
    );
    for (const permission of cap.PERMISSION_CATALOG)
      assert.equal(
        typeof message.names[permission.key.replace(".", "_")],
        "string",
      );
  }
});

test("permission exports retain filters and collect every matching page", async () => {
  const { collectExport } = load("apps/web/src/lib/exporting/data.ts");
  const calls = [];
  const result = await collectExport(
    "permission-grants",
    new URLSearchParams({
      recipientId: "test-user",
      status: "active",
      byMe: "true",
      search: "member",
    }),
    async (path) => {
      const query = new URL(path, "https://example.test").searchParams;
      calls.push(query);
      return {
        items:
          query.get("page") === "1"
            ? [{ _id: "one" }, { _id: "two" }]
            : [{ _id: "three" }],
        totalPages: 2,
        total: 3,
      };
    },
  );
  assert.equal(result.sheets[0].rows.length, 3);
  assert.equal(calls.length, 2);
  for (const query of calls) {
    assert.equal(query.get("recipientId"), "test-user");
    assert.equal(query.get("status"), "active");
    assert.equal(query.get("byMe"), "true");
    assert.equal(query.get("limit"), "100");
  }
});
