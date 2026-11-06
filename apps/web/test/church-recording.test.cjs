const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, dependencies = {}, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, URL, Headers, AbortSignal, AbortController, ...globals, require(name) { if (name in dependencies) return dependencies[name]; throw new Error('Unexpected dependency: ' + name); } });
  return module.exports;
}
const returns = load('lib/return-to.ts');
test('shared recording return paths survive login without allowing external redirects', () => {
  for (const route of ['/record/aaaaaaaaaaaaaaaaaaaaaaaa/finance', '/record/aaaaaaaaaaaaaaaaaaaaaaaa/attendance?day=sunday']) assert.equal(returns.safeReturnTo(route), route);
  for (const route of ['https://evil.test', '//evil.test', '/\\evil.test', '/login?returnTo=/login', 'javascript:alert(1)', '/\u0000evil']) assert.equal(returns.safeReturnTo(route), '/dashboard');
});
test('login proxy preserves the recording target and overwrites untrusted recovery headers', () => {
  const next = { NextResponse: { redirect: (url) => ({ location: url.href }), next: (options) => options || {} } };
  const { proxy } = load('proxy.ts', { 'next/server': next, './lib/return-to': returns });
  const url = new URL('https://chuflow.test/record/aaaaaaaaaaaaaaaaaaaaaaaa/finance?x=1');
  url.clone = () => new URL(url);
  const req = { nextUrl: url, url: url.href, headers: new Headers({ 'x-chuflow-return-to': 'https://evil.test' }), cookies: { get: () => undefined } };
  const login = new URL(proxy(req).location);
  assert.equal(login.pathname, '/login');
  assert.equal(login.searchParams.get('returnTo'), '/record/aaaaaaaaaaaaaaaaaaaaaaaa/finance?x=1');
  req.cookies.get = () => ({ value: 'test-session' });
  assert.equal(proxy(req).request.headers.get('x-chuflow-return-to'), '/record/aaaaaaaaaaaaaaaaaaaaaaaa/finance?x=1');
});
test('server reads bound backend wait time and distinguish expired sessions from startup responses', async () => {
  let response = new Response('{}', { headers: { 'content-type': 'application/json' } });
  const { serverRead } = load('lib/server-read.ts', { 'next/headers': {}, './api': { API_URL: 'https://api.example.test' }, './return-to': returns }, { fetch: async (_url, options) => { assert.ok(options.signal instanceof AbortSignal); return response; } });
  assert.equal((await serverRead('/auth/me')).status, 200);
  response = new Response('{}', { status: 401, headers: { 'content-type': 'application/json' } });
  assert.equal((await serverRead('/auth/me')).status, 401);
  for (const next of [new Response('{}', { status: 503, headers: { 'content-type': 'application/json' } }), new Response('Starting', { headers: { 'content-type': 'text/html' } })]) {
    response = next;
    await assert.rejects(serverRead('/auth/me'), /temporarily unavailable/);
  }
});
async function sessionState(fetcher) {
  const state = [];
  let cleanup;
  const react = { createContext: () => ({ Provider: 'provider' }), useContext: () => ({}), useState: (initial) => { const index = state.push(initial) - 1; return [initial, (value) => { state[index] = value; }]; }, useEffect: (effect) => { cleanup = effect(); } };
  const { SessionProvider } = load('components/session-context.tsx', { react, 'react/jsx-runtime': { jsx: (_type, props) => props }, '@/lib/api': { API_URL: 'https://api.example.test' } }, { fetch: fetcher, window: { setTimeout: () => 1, clearTimeout() {} } });
  SessionProvider({ children: null });
  await new Promise(setImmediate);
  cleanup();
  return state;
}
test('a waking or unreachable client backend never becomes a false expired-session state', async () => {
  for (const fetcher of [async () => new Response('{}', { status: 503, headers: { 'content-type': 'application/json' } }), async () => new Response('Starting', { headers: { 'content-type': 'text/html' } }), async () => { throw new TypeError('Network unavailable'); }]) {
    const [user, ready, expired, unavailable] = await sessionState(fetcher);
    assert.equal(user, null); assert.equal(ready, true); assert.equal(expired, false); assert.equal(unavailable, true);
  }
});
test('only a confirmed unauthorized session is expired; successful local staff remain signed in', async () => {
  const expired = await sessionState(async () => new Response('{}', { status: 401, headers: { 'content-type': 'application/json' } }));
  assert.equal(expired[2], true); assert.equal(expired[3], false);
  const active = await sessionState(async () => new Response(JSON.stringify({ role: 'branch_admin', branchId: 'aaaaaaaaaaaaaaaaaaaaaaaa' }), { headers: { 'content-type': 'application/json' } }));
  assert.equal(active[0].role, 'branch_admin'); assert.equal(active[2], false); assert.equal(active[3], false);
});
test('all new reporting and service-type controls have matching translations in every interface language', () => {
  const messages = ['en', 'fr', 'es', 'pt'].map((locale) => JSON.parse(fs.readFileSync(path.join(__dirname, '../messages', locale, 'recording.json'), 'utf8')).recording);
  const keys = Object.keys(messages[0]).sort();
  for (const dictionary of messages) {
    assert.deepEqual(Object.keys(dictionary).sort(), keys);
    for (const value of Object.values(dictionary)) assert.ok(typeof value === 'string' && value.trim());
    assert.ok(dictionary.savedBody.includes('{church}'));
  }
});
