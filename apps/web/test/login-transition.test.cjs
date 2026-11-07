const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const compile = (file) =>
  ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src", file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
function fixture(response) {
  const state = [],
    navigations = [],
    errors = [];
  let cursor = 0;
  const jsx = (type, props) => ({ type, props });
  function WorkspaceLoader() {}
  const module = { exports: {} };
  const returnModule = { exports: {} };
  vm.runInNewContext(compile("lib/return-to.ts"), {
    module: returnModule,
    exports: returnModule.exports,
    URL,
  });
  const stubs = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: {
      useState: (initial) => {
        const i = cursor++;
        if (!(i in state)) state[i] = initial;
        return [
          state[i],
          (value) => {
            state[i] = value;
          },
        ];
      },
    },
    "next/link": { default: "link" },
    "next/navigation": {
      useRouter: () => ({ replace: (href) => navigations.push(href) }),
    },
    "next-intl": { useTranslations: () => (key) => key },
    sonner: {
      toast: { dismiss() {}, error: (message) => errors.push(message) },
    },
    "@/components/brand/workspace-loader": { WorkspaceLoader },
    "@/components/auth/auth-ui": {
      Alert: "alert",
      AuthHeading: "heading",
      Field: "field",
      PasswordInput: "password",
      SubmitButton: "submit",
    },
    "@/lib/api": { API_URL: "https://synthetic.invalid/api" },
    "@/lib/auth-errors": { loginErrorKey: () => "incorrect" },
    "@/lib/permissions": {
      roleHomeHref: (role) =>
        role === "children_worker" ? "/children" : "/dashboard",
    },
    "@/lib/return-to": returnModule.exports,
    "@/lib/workspace-sign-in": { hasLinkedWorkspaceDirectory: () => false, linkedWorkspaceOptions: () => [] },
  };
  vm.runInNewContext(compile("components/login-form.tsx"), {
    module,
    exports: module.exports,
    require: (name) => {
      if (!(name in stubs)) throw Error(name);
      return stubs[name];
    },
    AbortController,
    Error,
    TypeError,
    window: { setTimeout: () => 1, clearTimeout() {} },
    fetch: async () => {
      if (response instanceof Error) throw response;
      return response;
    },
    FormData: class {
      get(key) {
        return key === "email" ? "test@example.com" : "synthetic-invalid";
      }
    },
  });
  const render = (props) => {
    cursor = 0;
    return module.exports.LoginForm(props || {});
  };
  function findForm(node) {
    if (!node) return null;
    if (Array.isArray(node)) {
      for (const n of node) {
        const found = findForm(n);
        if (found) return found;
      }
    } else if (node.type === "form") return node;
    else if (node.props) return findForm(node.props.children);
    return null;
  }
  async function submit(props) {
    const form = findForm(render(props));
    form.props.onSubmit({ preventDefault() {}, currentTarget: {} });
    await new Promise(setImmediate);
    return render(props);
  }
  return { submit, navigations, errors, WorkspaceLoader };
}
test("successful login shows the branded loader and opens the role workspace without a timed pause", async () => {
  const f = fixture({
    ok: true,
    json: async () => ({ user: { role: "children_worker" } }),
  });
  const view = await f.submit();
  assert.equal(view.type, f.WorkspaceLoader);
  assert.deepEqual(f.navigations, ["/children"]);
  assert.deepEqual(f.errors, []);
});
test("successful login preserves a valid requested destination", async () => {
  const f = fixture({
    ok: true,
    json: async () => ({ user: { role: "branch_admin" } }),
  });
  await f.submit({ returnTo: "/members?page=2" });
  assert.deepEqual(f.navigations, ["/members?page=2"]);
});
test("unsafe redirect falls back to the role workspace", async () => {
  const f = fixture({
    ok: true,
    json: async () => ({ user: { role: "children_worker" } }),
  });
  await f.submit({ returnTo: "https://outside.invalid" });
  assert.deepEqual(f.navigations, ["/children"]);
});
test("incorrect credentials keep the login form available and never open the success loader", async () => {
  const f = fixture({ ok: false, status: 401 });
  const view = await f.submit();
  assert.notEqual(view.type, f.WorkspaceLoader);
  assert.deepEqual(f.navigations, []);
  assert.deepEqual(f.errors, ["login.incorrect"]);
});
test("connection failure stays on the login form with a retry message", async () => {
  const f = fixture(new TypeError("fetch failed"));
  const view = await f.submit();
  assert.notEqual(view.type, f.WorkspaceLoader);
  assert.deepEqual(f.navigations, []);
  assert.deepEqual(f.errors, ["login.connection"]);
});
