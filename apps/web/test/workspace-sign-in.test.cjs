const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

/** Loads a src/lib module with its sibling imports, in shared-workspace mode. */
function load(name, env, cache = {}) {
  if (cache[name]) return cache[name].exports;
  const file = path.join(__dirname, "../src/lib", name + ".ts");
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  cache[name] = module;
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    process: { env },
    URL,
    URLSearchParams,
    require: (request) => load(request.replace(/^\.\//, ""), env, cache),
  });
  return module.exports;
}

const env = {
  NEXT_PUBLIC_CHUFLOW_SHARED_WORKSPACES: "true",
  NEXT_PUBLIC_API_URL: "https://api.chuflow.com/api",
};
const { proxyTarget } = load("workspace-proxy", env);
const { workspaceSignInHref } = load("workspace-routing", env);

test("a provisioned workspace signs in and recovers passwords at its own API", () => {
  for (const endpoint of ["auth/login", "auth/forgot-password", "auth/reset-password", "auth/reset-password/verify", "auth/workspace"]) {
    const target = proxyTarget(["w", "grace-chapel", ...endpoint.split("/")], "POST", undefined);
    assert.equal(target.status, 200, endpoint);
    assert.equal(target.base, "https://api.chuflow.com/api/w/grace-chapel");
    assert.equal(target.cookieName, "cms_workspace_grace-chapel");
    assert.equal(target.endpoint, "/" + endpoint);
  }
  assert.equal(proxyTarget(["w", "grace-chapel", "auth", "login"], "POST", null).signInWorkspace, "grace-chapel");
  assert.equal(proxyTarget(["w", "grace-chapel", "auth", "forgot-password"], "POST", null).signInWorkspace, null);
});

test("the shared directory still signs in at the primary API", () => {
  const target = proxyTarget(["directory", "auth", "login"], "POST", "grace-chapel");
  assert.equal(target.status, 200);
  assert.equal(target.base, "https://api.chuflow.com/api");
  assert.equal(target.cookieName, "cms_access_token");
  assert.equal(target.signInWorkspace, null);
  assert.equal(target.directory, true);
});

test("Winners Chapel uses the same session cookie through its explicit workspace route", () => {
  const id = "winners-chapel-international";
  const signIn = proxyTarget(["w", id, "auth", "login"], "POST", "test-church");
  const settings = proxyTarget(["w", id, "settings", "overview"], "GET", id);
  assert.equal(signIn.status, 200);
  assert.equal(signIn.cookieName, "cms_access_token");
  assert.equal(settings.cookieName, signIn.cookieName);
  assert.equal(proxyTarget(["w", id, "settings", "overview"], "GET", "test-church").status, 409);
});

test("signed-in traffic stays pinned to the active workspace", () => {
  assert.equal(proxyTarget(["w", "grace-chapel", "guests"], "GET", "grace-chapel").base, "https://api.chuflow.com/api/w/grace-chapel");
  assert.equal(proxyTarget(["w", "grace-chapel", "guests"], "GET", "other-church").status, 409);
  assert.equal(proxyTarget(["w", "grace-chapel", "auth", "change-password"], "POST", null).status, 409);
  assert.equal(proxyTarget(["w", "grace-chapel", "auth", "me"], "GET", "grace-chapel").status, 200);
  assert.equal(proxyTarget(["w", "Bad Handle", "auth", "login"], "POST", null).status, 404);
  assert.equal(proxyTarget(["w", "grace-chapel", "..", "auth"], "GET", "grace-chapel").status, 404);
});

test("sign-in links carry the workspace only when there is one", () => {
  assert.equal(workspaceSignInHref("/login", "grace-chapel"), "/login?workspace=grace-chapel");
  assert.equal(workspaceSignInHref("/reset-password", "grace-chapel", { token: "abc" }), "/reset-password?workspace=grace-chapel&token=abc");
  assert.equal(workspaceSignInHref("/forgot-password", null), "/forgot-password");
  assert.equal(workspaceSignInHref("/login", "Not A Handle"), "/login");
});

test("operator POSTs trust the configured public origin behind the hosting proxy", async () => {
  function route(relativePath) {
    const source = fs.readFileSync(path.join(__dirname, "../src/app/api/ops", relativePath), "utf8");
    const code = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    vm.runInNewContext(code, {
      module,
      exports: module.exports,
      Response,
      require: (name) => name === "@/lib/workspace-routing"
        ? { SHARED_WEB_ORIGIN: "https://chuflow.com" }
        : {},
    });
    return module.exports.POST;
  }
  const request = (origin) => ({
    method: "POST",
    headers: new Headers(origin ? { origin } : {}),
    nextUrl: new URL("http://internal-host:3000/api/ops/session"),
    cookies: { get: () => undefined },
    json: async () => ({}),
  });
  const signIn = route("session/route.ts");
  const proxy = route("proxy/[...path]/route.ts");
  const context = { params: Promise.resolve({ path: ["workspaces"] }) };
  assert.equal((await signIn(request("https://chuflow.com"))).status, 400);
  assert.equal((await proxy(request("https://chuflow.com"), context)).status, 401);
  for (const origin of [undefined, "https://untrusted.example", "http://internal-host:3000"]) {
    assert.equal((await signIn(request(origin))).status, 403);
    assert.equal((await proxy(request(origin), context)).status, 403);
  }
});
