const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "../../..");

function load(file, mocks = {}, globals = {}) {
  const code = ts.transpileModule(
    fs.readFileSync(path.join(root, file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  const module = { exports: {} };
  vm.runInNewContext(
    code,
    {
      module,
      exports: module.exports,
      URLSearchParams,
      ...globals,
      require: (name) => {
        if (name in mocks) return mocks[name];
        if (name === "sonner") return {toast:{success(){},error(){},info(){}}};
        if (name === "@/lib/action-feedback") return load("apps/web/src/lib/action-feedback.ts");
        if (name === "./capabilities" || name === "@/lib/capabilities") return load("apps/web/src/lib/capabilities.ts");
        const t = (key) => key;
        t.has = () => false;
        t.rich = t;
        if (name === "next-intl")
          return {
            useTranslations: () => t,
            useLocale: () => "en",
            useFormatter: () => ({
              number: String,
              dateTime: String,
              relativeTime: String,
            }),
          };
        if (name === "next-intl/server")
          return {
            getTranslations: async () => t,
            getLocale: async () => "en",
            getFormatter: async () => ({
              number: String,
              dateTime: String,
              relativeTime: String,
            }),
          };
        if (name === "@/i18n/labels")
          return {
            useRoleLabel: () => permissions.formatRoleLabel,
            useScopeLabel: () => permissions.getUserScopeLabel,
            useStatusLabel: () => (value) => value,
            useAppFormat: () => ({
              number: String,
              date: String,
              dateTime: String,
              relative: String,
            }),
          };

        if (name.startsWith("@/components/") || name === "next/link") return {};
        throw new Error("Unexpected dependency: " + name);
      },
    },
    { filename: file },
  );
  return module.exports;
}
const permissions = load("apps/web/src/lib/permissions.ts");
const constants = load("apps/api/src/common/constants/roles.constants.ts");
const allRoles = constants.APP_ROLES;
function initialCreateRole(role, allowedRoles) {
  const jsx = (type, props) => ({ type, props });
  const { UserCreateForm } = load(
    "apps/web/src/components/user-create-form.tsx",
    {
      react: { useState: (value) => [value, () => {}], useMemo: (fn) => fn() },
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "next/navigation": { useRouter: () => ({}) },
      "@/lib/directory": {},
      "@/lib/api": {},
      "@/lib/permissions": permissions,
    },
  );
  let selected;
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (node.type === "select" && node.props.name === "role")
      selected = node.props;
    visit(node.props?.children);
  }
  visit(
    UserCreateForm({
      branches: [],
      currentUserRole: role,
      oversightRegions: [],
      districts: [],
      allowedRoles,
    }),
  );
  return selected;
}
for (const role of [
  "super_admin",
  "national_admin",
  "district_admin",
  "branch_admin",
]) {
  test(role + ": general and branch staff creation default to Usher", () => {
    assert.equal(initialCreateRole(role).value, "usher");
    assert.equal(
      initialCreateRole(role, [
        "branch_admin",
        "resident_pastor",
        "associate_pastor",
        "follow_up",
        "usher",
      ]).value,
      "usher",
    );
  });
}
test("leadership-only creation requires an explicit role choice", () => {
  const role = initialCreateRole("super_admin", [
    "branch_admin",
    "resident_pastor",
  ]);
  assert.equal(role.value, "");
  assert.equal(role.required, true);
});
test("filter panels start closed and expose a native keyboard-accessible toggle", () => {
  const jsx = (type, props) => ({ type, props });
  const { FilterPanel } = load("apps/web/src/components/filter-panel.tsx", {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@/components/app/icons": {},
  });
  const panel = FilterPanel({ children: "Existing filter fields" });
  assert.equal(panel.type, "details");
  assert.equal(panel.props.open, undefined);
  assert.equal(panel.props.children[0].type, "summary");
  assert.equal(
    panel.props.children[1].props.children,
    "Existing filter fields",
  );
});
test("advanced directory and report filters stay inside collapsible panels", () => {
  const files = [
    "users",
    "guests",
    "follow-up",
    "approvals",
    "communications",
    "evangelism",
    "care",
    "maag-reports",
    "reports",
    "weekly-reports",
    "structure",
    "search",
    "hierarchy",
  ]
    .map((page) => `apps/web/src/app/${page}/page.tsx`)
    .concat(
      [
        "directory-controls",
        "dashboard-scope-filter-bar",
        "finance-scope-filter-bar",
        "follow-up-scope-filter-bar",
      ].map((component) => `apps/web/src/components/${component}.tsx`),
    );
  for (const file of files) {
    const ast = ts.createSourceFile(
      file,
      fs.readFileSync(path.join(root, file), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    let count = 0;
    function visit(node) {
      if (
        ts.isJsxElement(node) &&
        ([
          "apps/web/src/app/weekly-reports/page.tsx",
          "apps/web/src/components/directory-controls.tsx",
        ].includes(file)
          ? node.openingElement.tagName.getText(ast) === "select"
          : node.openingElement.tagName.getText(ast) === "form")
      ) {
        count++;
        let ancestor = node.parent;
        while (
          ancestor &&
          !(
            ts.isJsxElement(ancestor) &&
            ancestor.openingElement.tagName.getText(ast) === "FilterPanel"
          )
        )
          ancestor = ancestor.parent;
        assert.ok(ancestor, `${file} exposes its filters by default`);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
    if (!file.endsWith("dashboard-scope-filter-bar.tsx"))
      assert.ok(count, `${file} has no covered filter form`);
  }
});

// Read the real controller decorators, including method overrides of class roles.
const endpoints = new Map();
const writeRoles = new Map();
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
for (const file of walk(path.join(root, "apps/api/src")).filter((f) =>
  f.endsWith(".controller.ts"),
)) {
  const ast = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const decorators = (node) =>
    ts.canHaveDecorators(node) ? ts.getDecorators(node) || [] : [];
  const call = (node, name) =>
    decorators(node)
      .map((d) => d.expression)
      .find(
        (e) => ts.isCallExpression(e) && e.expression.getText(ast) === name,
      );
  const value = (expression) => vm.runInNewContext(expression, constants);
  const roles = (node) => {
    const r = call(node, "Roles");
    return r
      ? value("[" + r.arguments.map((a) => a.getText(ast)).join(",") + "]")
      : null;
  };
  for (const cls of ast.statements.filter(ts.isClassDeclaration)) {
    const controller = call(cls, "Controller");
    if (!controller) continue;
    const prefix = controller.arguments[0]
      ? value(controller.arguments[0].getText(ast))
      : "";
    for (const method of cls.members) {
      for (const verb of ["Post", "Patch", "Delete"]) {
        const mutation = call(method, verb);
        if (!mutation) continue;
        const suffix = mutation.arguments[0]
          ? value(mutation.arguments[0].getText(ast))
          : "";
        writeRoles.set(
          verb.toUpperCase() +
            " /" +
            [prefix, suffix].filter(Boolean).join("/"),
          roles(method) ?? roles(cls) ?? allRoles,
        );
      }
      const get = call(method, "Get");
      if (!get) continue;
      const suffix = get.arguments[0]
        ? value(get.arguments[0].getText(ast))
        : "";
      endpoints.set(
        "/" + [prefix, suffix].filter(Boolean).join("/"),
        roles(method) ?? roles(cls) ?? allRoles,
      );
    }
  }
}
const pages = {
  "/approvals": ["/alerts/summary"],
  "/communications": [
    "/communications",
    "/communications/templates",
    "/communications/history",
  ],
  "/guests": ["/guests"],
  "/evangelism": ["/evangelism/contacts", "/evangelism/branches"],
  "/care": ["/care/options", "/care/overview", "/care/cases"],
  "/follow-up": ["/follow-ups"],
  "/members": ["/members"],
  "/service-units": ["/service-units"],
  "/meetings": ["/meetings", "/meetings/options"],
  "/attendance": ["/attendance"],
  "/weekly-reports": ["/intake-templates/weekly-reports"],
  "/maag-reports": ["/intake-templates/maag-reports"],
  "/finance": ["/finance/ledger"],
  "/branches": ["/branches/overview"],
  "/structure": ["/branches/structure"],
  "/hierarchy": ["/hierarchy"],
  "/users": ["/users/directory"],
  "/templates": ["/intake-templates"],
  "/reports": ["/reports/summary"],
  "/search": ["/search/global"],
  "/settings": ["/settings/overview", "/settings/branches/:branchId"],
  "/guests/new": [
    "/branches/options",
    "/users/assignment-options",
    "/service-types",
  ],
};
for (const role of allRoles) {
  test(
    role + ": visible pages agree with their primary API permissions",
    () => {
      for (const [page, apis] of Object.entries(pages)) {
        if (!permissions.canAccessRoute(role, page)) continue;
        for (const api of apis) {
          assert.ok(endpoints.has(api), "Audit endpoint not found: " + api);
          assert.ok(
            endpoints.get(api).includes(role),
            `${role} can open ${page} but cannot GET ${api}`,
          );
        }
      }
    },
  );
  test(role + ": dashboard uses an authorized workspace", async () => {
    const requests = [];
    const redirect = (destination) => {
      throw new Error("REDIRECT:" + destination);
    };
    const jsx = (type, props) => ({ type, props });
    const page = load("apps/web/src/app/dashboard/page.tsx", {
      "next/navigation": { redirect },
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "@/lib/auth": {
        requireServerRole: async () => ({ role, branchId: "branch-1" }),
      },
      "@/lib/permissions": permissions,
      "@/lib/server-api": {
        serverGet: async (api) => {
          requests.push(api);
          if (api.startsWith("/reports/dashboard"))
            return { scope: { days: 30 } };
          return [];
        },
      },
      "@/components/dashboard-scope-filter-bar": {},
      "@/components/dashboard/dashboard-view": {},
      "@/components/shell": {},
    }).default;
    if (
      ["follow_up", "usher", "children_worker", "children_supervisor"].includes(
        role,
      )
    ) {
      const destination = permissions.roleHomeHref(role);
      await assert.rejects(page({ searchParams: Promise.resolve({}) }), {
        message: "REDIRECT:" + destination,
      });
      assert.equal(requests.length, 0);
      assert.ok(permissions.canAccessRoute(role, destination));
    } else {
      await page({ searchParams: Promise.resolve({}) });
      assert.ok(requests.some((api) => api.startsWith("/reports/dashboard")));
      assert.ok(endpoints.get("/reports/dashboard").includes(role));
    }
  });
}
for (const role of allRoles) {
  test(
    role + ": guest forms and details only load authorized data",
    async () => {
      if (role.startsWith("children_")) {
        assert.equal(permissions.canAccessRoute(role, "/guests/new"), false);
        return;
      }
      const requests = [];
      const jsx = (type, props) => ({ type, props });
      const mocks = {
        "react/jsx-runtime": { jsx, jsxs: jsx },
        "@/components/ui/ui": { statusTone: () => "", formatStatus: () => "" },
        "@/lib/auth": {
          requireServerRole: async () => ({ role, branchId: "branch-1" }),
        },
        "@/lib/permissions": permissions,
        "@/lib/server-api": {
          serverGet: async (api) => {
            requests.push(api);
            if (api === "/guests/test-id")
              return {
                _id: "test-id",
                firstName: "Guest",
                lastName: "Test",
                branchId: "branch-1",
              };
            if (api.startsWith("/follow-ups?")) return { items: [] };
            return [];
          },
        },
      };
      const create = load(
        "apps/web/src/app/guests/new/page.tsx",
        mocks,
      ).default;
      await create({ searchParams: Promise.resolve({}) });
      const detail = load(
        "apps/web/src/app/guests/[id]/page.tsx",
        mocks,
      ).default;
      await detail({ params: Promise.resolve({ id: "test-id" }) });
      for (const api of requests) {
        const actual = api.split("?")[0];
        const pattern = actual === "/guests/test-id" ? "/guests/:id" : actual;
        assert.ok(
          endpoints.has(pattern),
          "Audit endpoint not found: " + pattern,
        );
        assert.ok(
          endpoints.get(pattern).includes(role),
          `${role} guest page requested restricted ${api}`,
        );
      }
      if (role === "usher")
        assert.equal(
          requests.some((api) => api.startsWith("/follow-ups")),
          false,
        );
    },
  );
}
test("support staff get limited lookup options without gaining directory access", () => {
  for (const role of ["follow_up", "usher"]) {
    assert.equal(endpoints.get("/users").includes(role), false);
    assert.equal(endpoints.get("/branches").includes(role), false);
    assert.equal(
      endpoints.get("/users/assignment-options").includes(role),
      true,
    );
    assert.equal(endpoints.get("/branches/options").includes(role), true);
    assert.equal(writeRoles.get("POST /users").includes(role), false);
    assert.equal(writeRoles.get("POST /branches").includes(role), false);
    assert.equal(writeRoles.get("POST /meetings/groups").includes(role), false);
  }
  assert.equal(
    writeRoles.get("POST /service-types").includes("follow_up"),
    false,
  );
});
test("restricted nested routes cannot inherit a broader parent permission", () => {
  assert.equal(permissions.canAccessRoute("follow_up", "/care"), true);
  assert.equal(
    permissions.canAccessRoute("follow_up", "/care/settings"),
    false,
  );
  assert.equal(
    permissions.canAccessRoute("usher", "/meetings/groups/new"),
    false,
  );
  assert.equal(
    permissions.canAccessRoute("branch_admin", "/branches/new"),
    false,
  );
  assert.equal(
    permissions.canAccessRoute("super_admin", "/branches/new"),
    true,
  );
});
test("oversight expands church filtering only for an appointed resident pastor", () => {
  assert.equal(permissions.canFilterAcrossBranches("resident_pastor"), false);
  assert.equal(
    permissions.canFilterAcrossBranches("resident_pastor", true),
    true,
  );
  assert.equal(permissions.canFilterAcrossBranches("follow_up", true), false);
  assert.equal(permissions.canFilterAcrossBranches("usher", true), false);
  assert.equal(
    writeRoles.get("POST /hierarchy").includes("resident_pastor"),
    false,
  );
  assert.equal(
    writeRoles.get("PATCH /hierarchy/units/:id").includes("resident_pastor"),
    false,
  );
});
test("hierarchy creation, placement and appointment forms have working submit controls", () => {
  const jsx = (type, props) => ({ type, props });
  const ui = {
    Card: (props) => jsx("section", props),
    Field: (props) => jsx("label", props),
    Button: ({ type = "button", ...props }) =>
      jsx("button", { ...props, type }),
  };
  const { HierarchyWorkspace } = load(
    "apps/web/src/components/hierarchy/workspace.tsx",
    {
      react: {
        useState: (initial) => [initial, () => {}],
        useRef: (value) => ({ current: value }),
      },
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "next/navigation": { useRouter: () => ({ refresh() {} }) },
      "@/lib/api": {},
      "@/components/ui/ui": ui,
    },
  );
  const data = {
    selectedDistrictId: "district",
    canManage: true,
    context: { assignments: [] },
    branches: [
      {
        _id: "church",
        name: "Local church",
        status: "active",
        zoneId: "zone",
        areaId: "area",
      },
    ],
    units: [
      { _id: "district", kind: "district", name: "District", isActive: true },
      {
        _id: "zone",
        parentId: "district",
        kind: "zone",
        name: "Zone",
        isActive: true,
      },
      {
        _id: "area",
        parentId: "zone",
        kind: "area",
        name: "Area",
        isActive: true,
      },
    ],
  };
  const forms = [];
  function visit(node, action) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node))
      return node.forEach((child) => visit(child, action));
    if (typeof node.type === "function")
      return visit(node.type(node.props), action);
    action(node);
    visit(node.props?.children, action);
  }
  visit(HierarchyWorkspace({ data, unitId: "district" }), (node) => {
    if (node.type === "form") forms.push(node);
  });
  assert.ok(forms.length >= 3);
  for (const form of forms) {
    const submits = [];
    visit(form.props.children, (node) => {
      if (node.type === "button" && node.props.type === "submit")
        submits.push(node);
    });
    assert.ok(submits.length, "A hierarchy form has no submit button");
  }
});
for (const [status, destination] of [
  [401, "/login?reason=session-expired"],
  [403, "/unauthorized"],
]) {
  test(`server API ${status} opens a useful page instead of throwing a 500`, async () => {
    const api = load(
      "apps/web/src/lib/server-api.ts",
      {
        "./workspace-server": { workspaceServerContext: async () => ({ base: "https://example.test", headers: {} }) },
        "next/navigation": {
          redirect: (destination) => {
            throw new Error("REDIRECT:" + destination);
          },
        },
        "./api": { API_URL: "https://example.test" },
        "./server-read": {
          serverRead: async () => ({ ok: false, status }),
          unavailableHref: async () => "/service-unavailable",
        },
      },
      { fetch: async () => ({ ok: false, status }) },
    );
    await assert.rejects(api.serverGet("/restricted"), {
      message: "REDIRECT:" + destination,
    });
  });
}

test("hierarchy pages show only immediate levels and paginate 120 churches", () => {
  const jsx = (type, props) => ({ type, props });
  const { HierarchyWorkspace } = load(
    "apps/web/src/components/hierarchy/workspace.tsx",
    {
      react: {
        useState: (value) => [value, () => {}],
        useRef: (value) => ({ current: value }),
      },
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "next/navigation": { useRouter: () => ({}) },
      "@/lib/api": {},
    },
  );
  const data = {
    selectedDistrictId: "district-record",
    canManage: false,
    context: { assignments: [] },
    units: [
      { _id: "d", kind: "district", name: "Atlanta" },
      { _id: "z", parentId: "d", kind: "zone", name: "Orlando" },
      { _id: "a", parentId: "z", kind: "area", name: "Nashville" },
    ],
    branches: Array.from({ length: 120 }, (_, i) => ({
      _id: String(i),
      name: `Church ${i}`,
      zoneId: i < 30 ? "z" : undefined,
      areaId: i < 3 ? "a" : undefined,
    })),
  };
  function propsFor(unitId) {
    const result = [];
    function visit(node) {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach(visit);
      if (node.props) result.push(node.props);
      visit(node.props?.children);
    }
    visit(HierarchyWorkspace({ data, unitId }));
    return result;
  }
  const hrefs = (id) =>
    propsFor(id)
      .map((p) => p.href)
      .filter(Boolean);
  assert.deepEqual(hrefs(undefined), [
    "/hierarchy/d?districtId=district-record",
  ]);
  assert.ok(hrefs("d").includes("/hierarchy/z?districtId=district-record"));
  assert.ok(!hrefs("d").includes("/hierarchy/a?districtId=district-record"));
  assert.equal(
    hrefs("d").filter((h) => h.startsWith("/dashboard?")).length,
    20,
  );
  assert.equal(
    hrefs("z").filter((h) => h.startsWith("/dashboard?")).length,
    20,
  );
  assert.equal(hrefs("a").filter((h) => h.startsWith("/dashboard?")).length, 3);
  assert.ok(hrefs("a").includes("/hierarchy/z?districtId=district-record"));
});

for (const role of ["children_worker", "children_supervisor"]) {
  test(role + ": login opens only the children workspace", () => {
    assert.equal(permissions.roleHomeHref(role), "/children");
    for (const path of [
      "/children",
      "/children/sessions/test",
      "/children/families/new",
    ])
      assert.equal(permissions.canAccessRoute(role, path), true);
    for (const path of [
      "/dashboard",
      "/finance",
      "/members",
      "/users",
      "/approvals",
      "/settings",
    ])
      assert.equal(permissions.canAccessRoute(role, path), false);
  });
}
