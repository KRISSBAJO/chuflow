const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');

function load(file, mocks = {}, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, URLSearchParams, ...globals,
    require: (name) => {
      if (name in mocks) return mocks[name];
      if (name.startsWith('@/components/') || name === 'next/link') return {};
      throw new Error('Unexpected dependency: ' + name);
    },
  }, { filename: file });
  return module.exports;
}
const permissions = load('apps/web/src/lib/permissions.ts');
const constants = load('apps/api/src/common/constants/roles.constants.ts');
const allRoles = constants.APP_ROLES;

// Read the real controller decorators, including method overrides of class roles.
const endpoints = new Map();
const writeRoles = new Map();
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
for (const file of walk(path.join(root, 'apps/api/src')).filter(f => f.endsWith('.controller.ts'))) {
  const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const decorators = node => ts.canHaveDecorators(node) ? ts.getDecorators(node) || [] : [];
  const call = (node, name) => decorators(node).map(d => d.expression).find(e => ts.isCallExpression(e) && e.expression.getText(ast) === name);
  const value = expression => vm.runInNewContext(expression, constants);
  const roles = node => {
    const r = call(node, 'Roles');
    return r ? value('[' + r.arguments.map(a => a.getText(ast)).join(',') + ']') : null;
  };
  for (const cls of ast.statements.filter(ts.isClassDeclaration)) {
    const controller = call(cls, 'Controller');
    if (!controller) continue;
    const prefix = controller.arguments[0] ? value(controller.arguments[0].getText(ast)) : '';
    for (const method of cls.members) {
      for (const verb of ['Post', 'Patch', 'Delete']) {
        const mutation = call(method, verb);
        if (!mutation) continue;
        const suffix = mutation.arguments[0] ? value(mutation.arguments[0].getText(ast)) : '';
        writeRoles.set(verb.toUpperCase() + ' /' + [prefix, suffix].filter(Boolean).join('/'), roles(method) ?? roles(cls) ?? allRoles);
      }
      const get = call(method, 'Get');
      if (!get) continue;
      const suffix = get.arguments[0] ? value(get.arguments[0].getText(ast)) : '';
      endpoints.set('/' + [prefix, suffix].filter(Boolean).join('/'), roles(method) ?? roles(cls) ?? allRoles);
    }
  }
}
const pages = {
  '/approvals': ['/alerts/summary'],
  '/communications': ['/communications', '/communications/templates', '/communications/history'],
  '/guests': ['/guests'],
  '/evangelism': ['/evangelism/contacts', '/evangelism/branches'],
  '/care': ['/care/options', '/care/overview', '/care/cases'],
  '/follow-up': ['/follow-ups'],
  '/members': ['/members'],
  '/service-units': ['/service-units'],
  '/meetings': ['/meetings', '/meetings/options'],
  '/attendance': ['/attendance'],
  '/weekly-reports': ['/intake-templates/weekly-reports'],
  '/maag-reports': ['/intake-templates/maag-reports'],
  '/finance': ['/finance/ledger'],
  '/branches': ['/branches/overview'],
  '/structure': ['/branches/structure'],
  '/users': ['/users/directory'],
  '/templates': ['/intake-templates'],
  '/reports': ['/reports/summary'],
  '/search': ['/search/global'],
  '/settings': ['/settings/overview', '/settings/branches/:branchId'],
  '/guests/new': ['/branches/options', '/users/assignment-options', '/service-types'],
};
for (const role of allRoles) {
  test(role + ': visible pages agree with their primary API permissions', () => {
    for (const [page, apis] of Object.entries(pages)) {
      if (!permissions.canAccessRoute(role, page)) continue;
      for (const api of apis) {
        assert.ok(endpoints.has(api), 'Audit endpoint not found: ' + api);
        assert.ok(endpoints.get(api).includes(role), `${role} can open ${page} but cannot GET ${api}`);
      }
    }
  });
  test(role + ': dashboard uses an authorized workspace', async () => {
    const requests = [];
    const redirect = destination => { throw new Error('REDIRECT:' + destination); };
    const jsx = (type, props) => ({ type, props });
    const page = load('apps/web/src/app/dashboard/page.tsx', {
      'next/navigation': { redirect },
      'react/jsx-runtime': { jsx, jsxs: jsx },
      '@/lib/auth': { requireServerRole: async () => ({ role, branchId: 'branch-1' }) },
      '@/lib/permissions': permissions,
      '@/lib/server-api': { serverGet: async api => {
        requests.push(api);
        if (api.startsWith('/reports/dashboard')) return { scope: { days: 30 } };
        return [];
      } },
      '@/components/dashboard-scope-filter-bar': {},
      '@/components/dashboard/dashboard-view': {},
      '@/components/shell': {},
    }).default;
    if (role === 'follow_up' || role === 'usher') {
      const destination = role === 'follow_up' ? '/care' : '/attendance';
      await assert.rejects(page({ searchParams: Promise.resolve({}) }), { message: 'REDIRECT:' + destination });
      assert.equal(requests.length, 0);
      assert.ok(permissions.canAccessRoute(role, destination));
    } else {
      await page({ searchParams: Promise.resolve({}) });
      assert.ok(requests.some(api => api.startsWith('/reports/dashboard')));
      assert.ok(endpoints.get('/reports/dashboard').includes(role));
    }
  });
}
for (const role of allRoles) {
  test(role + ': guest forms and details only load authorized data', async () => {
    const requests = [];
    const jsx = (type, props) => ({ type, props });
    const mocks = {
      'react/jsx-runtime': { jsx, jsxs: jsx },
      '@/components/ui/ui': { statusTone: () => '', formatStatus: () => '' },
      '@/lib/auth': { requireServerRole: async () => ({ role, branchId: 'branch-1' }) },
      '@/lib/permissions': permissions,
      '@/lib/server-api': { serverGet: async api => {
        requests.push(api);
        if (api === '/guests/test-id') return { _id: 'test-id', firstName: 'Guest', lastName: 'Test', branchId: 'branch-1' };
        if (api.startsWith('/follow-ups?')) return { items: [] };
        return [];
      } },
    };
    const create = load('apps/web/src/app/guests/new/page.tsx', mocks).default;
    await create({ searchParams: Promise.resolve({}) });
    const detail = load('apps/web/src/app/guests/[id]/page.tsx', mocks).default;
    await detail({ params: Promise.resolve({ id: 'test-id' }) });
    for (const api of requests) {
      const actual = api.split('?')[0];
      const pattern = actual === '/guests/test-id' ? '/guests/:id' : actual;
      assert.ok(endpoints.has(pattern), 'Audit endpoint not found: ' + pattern);
      assert.ok(endpoints.get(pattern).includes(role), `${role} guest page requested restricted ${api}`);
    }
    if (role === 'usher') assert.equal(requests.some(api => api.startsWith('/follow-ups')), false);
  });
}
test('support staff get limited lookup options without gaining directory access', () => {
  for (const role of ['follow_up', 'usher']) {
    assert.equal(endpoints.get('/users').includes(role), false);
    assert.equal(endpoints.get('/branches').includes(role), false);
    assert.equal(endpoints.get('/users/assignment-options').includes(role), true);
    assert.equal(endpoints.get('/branches/options').includes(role), true);
    assert.equal(writeRoles.get('POST /users').includes(role), false);
    assert.equal(writeRoles.get('POST /branches').includes(role), false);
    assert.equal(writeRoles.get('POST /meetings/groups').includes(role), false);
  }
  assert.equal(writeRoles.get('POST /service-types').includes('follow_up'), false);
});
test('restricted nested routes cannot inherit a broader parent permission', () => {
  assert.equal(permissions.canAccessRoute('follow_up', '/care'), true);
  assert.equal(permissions.canAccessRoute('follow_up', '/care/settings'), false);
  assert.equal(permissions.canAccessRoute('usher', '/meetings/groups/new'), false);
  assert.equal(permissions.canAccessRoute('branch_admin', '/branches/new'), false);
  assert.equal(permissions.canAccessRoute('super_admin', '/branches/new'), true);
});
for (const [status, destination] of [[401, '/login?reason=session-expired'], [403, '/unauthorized']]) {
  test(`server API ${status} opens a useful page instead of throwing a 500`, async () => {
    const api = load('apps/web/src/lib/server-api.ts', {
      'next/headers': { cookies: async () => ({ get: () => undefined }) },
      'next/navigation': { redirect: destination => { throw new Error('REDIRECT:' + destination); } },
      './api': { API_URL: 'https://example.test' },
    }, { fetch: async () => ({ ok: false, status }) });
    await assert.rejects(api.serverGet('/restricted'), { message: 'REDIRECT:' + destination });
  });
}
