/* Run after the API build with a local MongoDB listening on port 27017. */
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongoose').mongo;
const { start } = require('../scripts/workspace-gateway.cjs');

async function run() {
  const suffix = randomBytes(6).toString('hex');
  const origin = 'mongodb://127.0.0.1:27017';
  const primaryDb = 'chuflow_sign_in_qa_primary_' + suffix;
  const tenantDb = 'chuflow_sign_in_qa_tenant_' + suffix;
  const secret = () => randomBytes(32).toString('hex');
  const password = secret();
  const linkedEmail = 'both@example.com';
  const gateway = start({
    PATH: process.env.PATH,
    NODE_PATH: require('node:path').join(__dirname, '..', 'node_modules'),
    SystemRoot: process.env.SystemRoot,
    TEMP: process.env.TEMP,
    PORT: '0',
    API_BIND_HOST: '127.0.0.1',
    MONGODB_URI: origin + '/' + primaryDb,
    JWT_SECRET: secret(),
    ADMIN_EMAIL: linkedEmail,
    ADMIN_PASSWORD: password,
    WEB_URL: 'http://localhost:3000',
    CHUFLOW_WORKSPACE_REGISTRY: JSON.stringify([{
      id: 'test-church',
      name: 'Test Church',
      databaseName: tenantDb,
      jwtSecret: secret(),
      adminEmail: linkedEmail,
      adminPassword: password,
    }]),
  });
  const mongo = new MongoClient(origin, { serverSelectionTimeoutMS: 3000 });

  try {
    await once(gateway.server, 'listening');
    const base = `http://127.0.0.1:${gateway.server.address().port}/api`;
    const login = (email, value = password) => fetch(base + '/auth/workspace-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: value }),
    });

    const both = await login(linkedEmail);
    assert.equal(both.status, 200, await both.clone().text());
    assert.deepEqual((await both.json()).workspaces, ['directory', 'test-church']);
    const cookies = both.headers.getSetCookie();
    assert.equal(cookies.length, 2);
    assert.ok(cookies.some((cookie) => cookie.startsWith('cms_access_token=')));
    assert.ok(cookies.some((cookie) => cookie.startsWith('cms_workspace_test-church=')));

    for (const [database, email] of [[primaryDb, 'primary@example.com'], [tenantDb, 'Tenant+Care@example.com']]) {
      await mongo.db(database).collection('users').insertOne({
        firstName: 'Test', lastName: 'User', email, role: 'super_admin',
        password: await bcrypt.hash(password, 4), isActive: true,
      });
    }
    const tenant = await login('tenant+care@example.com');
    assert.equal(tenant.status, 200);
    assert.equal(tenant.headers.getSetCookie().length, 1);
    const tenantLogin = await tenant.json();
    assert.equal(tenantLogin.activeWorkspace, 'test-church');
    assert.deepEqual(tenantLogin.workspaces, ['test-church']);
    const sessionCookie = tenant.headers.getSetCookie()[0].split(';')[0];
    const tenantSession = await fetch(base + '/w/test-church/auth/me', { headers: { Cookie: sessionCookie } });
    assert.equal(tenantSession.status, 200);
    assert.equal((await tenantSession.json()).workspace.id, 'test-church');
    const wrongScope = await fetch(base + '/auth/me', { headers: { Cookie: sessionCookie } });
    assert.equal(wrongScope.status, 401);

    const primary = await login('primary@example.com');
    assert.equal(primary.status, 200);
    assert.deepEqual((await primary.json()).workspaces, ['directory']);
    const invalid = await login(linkedEmail, secret());
    assert.equal(invalid.status, 401);
    assert.equal(invalid.headers.has('Set-Cookie'), false);
    const unknown = await login('unknown@example.com');
    assert.equal(unknown.status, 401);
    assert.deepEqual(await unknown.json(), await invalid.json());
    console.log('Gateway sign-in verified for zero, one and multiple workspaces.');
  } finally {
    gateway.close();
    await Promise.all([primaryDb, tenantDb].map((database) => mongo.db(database).dropDatabase()));
    await mongo.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
