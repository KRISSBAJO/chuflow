const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  ts = require("typescript");
function load(file, deps, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src", file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    URL,
    URLSearchParams,
    FormData,
    ...globals,
    require(name) {
      if (name in deps) return deps[name];
      throw Error("Unexpected dependency " + name);
    },
  });
  return module.exports;
}
const jsx = {
  jsx: (type, props) => ({ type, props }),
  jsxs: (type, props) => ({ type, props }),
};
const translator = () => (key, values) =>
  key + (values?.name ? ":" + values.name : "");
function bridge(href) {
  const effects = [],
    success = [],
    replaced = [];
  const window = {
    location: { href },
    history: {
      state: { __NA: true, tree: { retained: true } },
      replaceState(state, _title, url) {
        replaced.push({ state, url });
        window.location.href = new URL(url, window.location.href).href;
      },
    },
  };
  const deps = {
    react: { Suspense: "suspense", useEffect: (fn) => effects.push(fn) },
    "react/jsx-runtime": jsx,
    "next/navigation": {
      usePathname: () => new URL(window.location.href).pathname,
      useSearchParams: () => new URL(window.location.href).searchParams,
    },
    sonner: {
      toast: {
        success: (message, options) => success.push({ message, options }),
      },
    },
    "next-intl": { useTranslations: translator },
  };
  const feedback = load("lib/action-feedback.ts", deps);
  const { ActionNotice } = load("components/action-notice.tsx", deps, {
    window,
  });
  function render(node) {
    if (!node) return;
    if (node.type === "suspense") render(node.props.children);
    else if (typeof node.type === "function") render(node.type(node.props));
  }
  return {
    window,
    effects,
    success,
    replaced,
    feedback,
    ActionNotice,
    render,
    deps,
  };
}
test("redirect confirmations toast once and consume only transient flags", () => {
  const b = bridge(
    "https://chuflow.test/users?search=someone&page=3&created=record-1&createdName=User#record-record-1",
  );
  const state = b.window.history.state;
  b.render(
    b.ActionNotice({
      message: "User saved",
      param: "created",
      cleanup: ["createdName"],
    }),
  );
  for (const effect of b.effects) effect();
  for (const effect of b.effects) effect();
  assert.equal(b.success.length, 1);
  assert.equal(b.replaced.length, 1);
  assert.equal(b.replaced[0].state, state);
  const url = new URL(b.window.location.href);
  assert.equal(url.searchParams.get("created"), null);
  assert.equal(url.searchParams.get("createdName"), null);
  assert.equal(url.searchParams.get("search"), "someone");
  assert.equal(url.searchParams.get("page"), "3");
  assert.equal(url.hash, "#record-record-1");
  const reloaded = bridge(b.window.location.href);
  reloaded.render(
    reloaded.ActionNotice({ message: "User saved", param: "created" }),
  );
  reloaded.effects.forEach((fn) => fn());
  assert.equal(reloaded.success.length, 0);
});
test("a delayed confirmation never alters a page the user has navigated to", () => {
  const b = bridge("https://chuflow.test/users?saved=1");
  b.render(b.ActionNotice({ message: "Saved" }));
  b.window.location.href = "https://chuflow.test/members?saved=1";
  b.effects.forEach((fn) => fn());
  assert.equal(b.success.length, 0);
  assert.equal(b.replaced.length, 0);
});
test("create forms and destination confirmation share a toast ID instead of stacking duplicates", () => {
  const b = bridge(
    "https://chuflow.test/users?created=user-123&createdName=User",
  );
  const { CreationNotice } = load(
    "components/creation-notice.tsx",
    {
      ...b.deps,
      "./action-notice": { ActionNotice: b.ActionNotice },
      "@/lib/action-feedback": b.feedback,
    },
    { window: b.window },
  );
  b.render(CreationNotice());
  b.effects.forEach((fn) => fn());
  assert.equal(
    b.success[0].options.id,
    b.feedback.savedToastId({ _id: "user-123" }),
  );
  assert.equal(b.success[0].message, "savedSuccessfully:User");
});
test("approval and children route messages use their existing specific wording", () => {
  for (const [route, param] of [
    ["approvals/requests/id", "submitted"],
    ["approvals/routes", "saved"],
    ["children/families/id", "saved"],
  ]) {
    const b = bridge(`https://chuflow.test/${route}?${param}=1&tab=details`);
    b.render(b.ActionNotice({ param, message: "Specific action completed" }));
    b.effects.forEach((fn) => fn());
    assert.equal(b.success[0].message, "Specific action completed");
    assert.equal(
      new URL(b.window.location.href).searchParams.get("tab"),
      "details",
    );
  }
});
async function saveGuest(ok) {
  const success = [],
    errors = [],
    requests = [],
    state = [];
  let refreshed = 0;
  const { GuestProfileForm } = load(
    "components/guest-profile-form.tsx",
    {
      react: { useState: (initial) => [initial, (value) => state.push(value)] },
      "react/jsx-runtime": jsx,
      "next/navigation": {
        useRouter: () => ({
          refresh() {
            refreshed++;
          },
        }),
      },
      "next-intl": { useTranslations: translator },
      sonner: {
        toast: {
          success: (message) => success.push(message),
          error: (message) => errors.push(message),
        },
      },
      "@/components/ui/ui": {},
      "@/lib/api": { API_URL: "https://api.example.test" },
    },
    {
      fetch: async (url, options) => {
        requests.push({ url, options });
        return {
          ok,
          json: async () =>
            ok
              ? { _id: "guest-1" }
              : { message: "Check the phone number and try again" },
        };
      },
    },
  );
  const form = GuestProfileForm({
    guest: {
      _id: "guest-1",
      firstName: "Guest",
      lastName: "Person",
      phone: "123",
      visitStatus: "first_time",
      branchId: { _id: "church-1" },
    },
  });
  const data = new FormData();
  data.set("firstName", "Updated");
  data.set("lastName", "Person");
  data.set("phone", "123");
  await form.props.action(data);
  return { success, errors, requests, refreshed, state };
}
test("successful profile updates use the shared success toast without changing the write scope", async () => {
  const result = await saveGuest(true);
  assert.equal(result.success.length, 1);
  assert.equal(result.errors.length, 0);
  assert.equal(result.refreshed, 1);
  assert.equal(result.requests[0].options.method, "PATCH");
  assert.equal(
    JSON.parse(result.requests[0].options.body).branchId,
    "church-1",
  );
  assert.equal(result.state.at(-1), false);
});
test("failed profile updates show an error toast and never a success confirmation", async () => {
  const result = await saveGuest(false);
  assert.equal(result.success.length, 0);
  assert.deepEqual(result.errors, ["Check the phone number and try again"]);
  assert.equal(result.refreshed, 0);
  assert.equal(result.state.at(-1), false);
});
