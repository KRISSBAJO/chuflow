/* Run after the API build with a local MongoDB replica set listening on port 27129. */
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const { randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongoose').mongo;
const { start } = require('../scripts/workspace-gateway.cjs');

async function run() {
  const suffix = randomBytes(6).toString('hex');
  const origin = 'mongodb://127.0.0.1:27129';
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
    for (const path of ['/health', '/w/test-church/health']) {
      let healthy = false;
      for (let attempt = 0; attempt < 5 && !healthy; attempt++) {
        const response = await fetch(base + path);
        healthy = response.ok;
        await response.text();
        if (!healthy) await delay(500);
      }
      assert.ok(healthy, `Local workspace did not start at ${path}`);
    }
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

    const linkedTenantCookie = cookies.find((cookie) => cookie.startsWith('cms_workspace_test-church=')).split(';')[0];
    const mobileLogin = await fetch(base + '/w/test-church/auth/mobile/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: linkedEmail, password }),
    });
    assert.equal(mobileLogin.status, 200);
    const { accessToken } = await mobileLogin.json();
    const requestDeletion = (value, cookie = linkedTenantCookie) => fetch(base + '/w/test-church/auth/account-deletion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ password: value }),
    });
    assert.equal((await requestDeletion(password, '')).status, 401);
    assert.equal((await requestDeletion(secret())).status, 403);
    const tenantUsers = mongo.db(tenantDb).collection('users');
    const deletedUser = await tenantUsers.findOne({ email: linkedEmail });
    await mongo.db(tenantDb).collection('pushsubscriptions').insertOne({ userId: deletedUser._id, endpoint: 'test-token' });
    const submitted = await requestDeletion(password);
    assert.equal(submitted.status, 200, await submitted.clone().text());
    const receipt = await submitted.json();
    assert.ok(Number.isFinite(Date.parse(receipt.deletedAt)));
    assert.equal((await requestDeletion(password)).status, 401);
    assert.equal((await fetch(base + '/w/test-church/auth/me', { headers: { Cookie: linkedTenantCookie } })).status, 401);
    assert.equal((await fetch(base + '/w/test-church/auth/me', { headers: { Authorization: 'Bearer ' + accessToken } })).status, 401);
    assert.equal(await tenantUsers.findOne({ email: linkedEmail }), null);
    const retired = await tenantUsers.findOne({ _id: deletedUser._id });
    assert.equal(retired.isActive, false);
    assert.equal(retired.firstName, 'Deleted');
    assert.equal(await mongo.db(tenantDb).collection('pushsubscriptions').countDocuments({ userId: deletedUser._id }), 0);
    assert.deepEqual((await (await login(linkedEmail)).json()).workspaces, ['directory']);

    const queuePath = base + '/w/test-church/users/account-deletion-requests';
    const queue = await fetch(queuePath, { headers: { Cookie: sessionCookie } });
    assert.equal(queue.status, 200, await queue.clone().text());
    assert.deepEqual(await queue.json(), []);
    const primaryUser = await mongo.db(primaryDb).collection('users').findOne({ email: linkedEmail });
    assert.equal(primaryUser.deletionRequestedAt, undefined);
    await mongo.db(tenantDb).collection('users').updateOne({ email: 'Tenant+Care@example.com' }, { $set: { role: 'branch_admin' } });
    assert.equal((await fetch(queuePath, { headers: { Cookie: sessionCookie } })).status, 403);
    console.log('Gateway sign-in verified for zero, one and multiple workspaces.');
    console.log('Account deletion verified for identity, session revocation, anonymization and workspace isolation.');
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
