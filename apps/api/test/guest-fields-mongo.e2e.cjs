/* Build the API first. Uses disposable databases on local MongoDB only. */
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { MongoClient, ObjectId } = require('mongoose').mongo;
const { start } = require('../scripts/workspace-gateway.cjs');

async function run() {
  const uri = 'mongodb://127.0.0.1:27017';
  const id = randomBytes(6).toString('hex');
  const database = 'chuflow_guest_qa_' + id;
  const tenantDb = database + '_tenant';
  const secret = () => randomBytes(32).toString('hex');
  const adminPassword = secret();
  const adminEmail = 'guest-admin@example.com';
  const mongo = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
  const gateway = start({
    PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP,
    NODE_PATH: require('node:path').join(__dirname, '..', 'node_modules'),
    PORT: '0', API_BIND_HOST: '127.0.0.1', MONGODB_URI: uri + '/' + database,
    JWT_SECRET: secret(), ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword,
    WEB_URL: 'http://localhost:3000',
    CHUFLOW_WORKSPACE_REGISTRY: JSON.stringify([{
      id: 'test-church', name: 'Test Church', databaseName: tenantDb, jwtSecret: secret(),
      adminEmail, adminPassword,
    }]),
  });

  try {
    await once(gateway.server, 'listening');
    const base = `http://127.0.0.1:${gateway.server.address().port}/api`;
    const request = (path, method = 'GET', body, token) => fetch(base + path, {
      method, headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    async function expect(response, status) {
      assert.equal(response.status, status, await response.clone().text());
      return response.json();
    }

    const login = await expect(await request('/auth/mobile/login', 'POST', { email: adminEmail, password: adminPassword }), 200);
    const token = login.accessToken;
    const settings = '/guests/form-settings';
    await expect(await request(settings), 401);
    const original = await expect(await request(settings, 'GET', undefined, token), 200);
    assert.equal(original.revision, 0);
    assert.deepEqual(original.hiddenPublic, []);

    const branch = new ObjectId();
    await mongo.db(database).collection('branches').insertOne({
      _id: branch, name: 'QA Station', oversightRegion: 'United States', district: 'QA', address: '1 Main',
      city: 'QA', state: 'TX', country: 'US', contactInfo: 'QA', serviceTimes: 'Sunday', status: 'active',
    });
    const link = '/intake-templates/public/winners-first-timer';
    const publicForm = () => request(link + '?branchId=' + branch);
    const submit = (answers, formRevision) => request(link + '/submit?branchId=' + branch, 'POST', { answers, formRevision });
    const before = await expect(await publicForm(), 200);
    assert.ok(before.fields.some((field) => field.key === 'city'));

    const field = { label: 'Ethnicity', type: 'text', public: true, staff: true, required: true, options: [] };
    const publish = (body) => request(settings, 'PATCH', body, token);
    const change = { revision: 0, hiddenPublic: ['email', 'city'], hiddenStaff: ['prayerRequest'], fields: [field] };
    await expect(await publish({ ...change, fields: Array.from({ length: 21 }, () => field) }), 400);
    await expect(await publish({ ...change, hiddenPublic: ['firstName'] }), 400);
    const published = await expect(await publish(change), 200);
    const key = published.fields[0].key;
    assert.match(key, /^custom_/);
    await expect(await publish(change), 409);

    const visible = await expect(await publicForm(), 200);
    assert.equal(visible.slug, before.slug);
    assert.equal(visible.formRevision, 1);
    assert.ok(visible.fields.some((field) => field.key === key));
    assert.ok(!visible.fields.some((field) => field.key === 'email'));
    const other = await expect(await request('/w/test-church' + link), 200);
    assert.ok(other.fields.some((field) => field.key === 'email'));
    assert.ok(!other.fields.some((field) => field.key === key));
    assert.match(other.shareUrl, /workspace=test-church/);

    const core = {
      firstName: 'Public', lastName: 'Guest', phone: '555-111-1212', visitDate: '2025-01-05',
      address: '1 Main', state: 'TX', gender: 'Male', cameWithFamily: 'No', heardAboutChurch: 'Other',
    };
    await expect(await submit(core, 0), 409);
    await expect(await submit(core, 1), 400);
    await expect(await submit({ ...core, [key]: 'a'.repeat(251) }, 1), 400);
    const answers = { ...core, [key]: 'Guest answer', email: 'ignored@example.com' };
    const received = await expect(await submit(answers, 1), 201);
    assert.deepEqual(await expect(await submit(answers, 1), 201), received);
    assert.ok(!received.guestId && !received.submissionId);
    const stored = await mongo.db(database).collection('guests').findOne({ phone: core.phone });
    assert.ok(stored);
    assert.equal(stored.city, undefined);
    assert.equal(stored.email, undefined);
    assert.equal(await mongo.db(database).collection('guests').countDocuments({ phone: core.phone }), 1);
    const profile = '/guests/' + stored._id;
    const detail = await expect(await request(profile, 'GET', undefined, token), 200);
    assert.deepEqual(detail.customAnswers, [{ key, label: 'Ethnicity', value: 'Guest answer' }]);

    const staffForm = await expect(await request('/guests/staff-form', 'GET', undefined, token), 200);
    assert.ok(staffForm.hiddenStaff.includes('prayerRequest'));
    const staff = await expect(await request('/guests', 'POST', {
      branchId: String(branch), firstName: 'Staff', lastName: 'Guest', phone: '555-111-1313',
      prayerRequest: 'Should not save', customFields: { [key]: 'Staff answer' }, formRevision: 1,
    }, token), 201);
    assert.equal(staff.prayerRequest, undefined);
    assert.equal(staff.customAnswers[0].value, 'Staff answer');

    await expect(await publish({
      ...change, revision: 1, fields: [{ ...published.fields[0], public: false, staff: false }],
    }), 200);
    assert.ok(!(await expect(await publicForm(), 200)).fields.some((item) => item.key === key));
    assert.deepEqual((await expect(await request(profile, 'GET', undefined, token), 200)).customAnswers, detail.customAnswers);

    const otherBranch = new ObjectId();
    const branchDocument = await mongo.db(database).collection('branches').findOne({ _id: branch });
    await mongo.db(database).collection('branches').insertOne({ ...branchDocument, _id: otherBranch, name: 'Other QA Station' });
    async function signInAs(role, branchId) {
      const email = `${role}@example.com`;
      await mongo.db(database).collection('users').insertOne({
        firstName: 'Branch', lastName: 'Tester', email, role, branchId,
        password: await bcrypt.hash(adminPassword, 4), isActive: true,
      });
      return (await expect(await request('/auth/mobile/login', 'POST', { email, password: adminPassword }), 200)).accessToken;
    }
    const branchAdmin = await signInAs('branch_admin', branch);
    const otherPastor = await signInAs('resident_pastor', otherBranch);
    const branchSettings = '/guests/branch-form-settings';
    await expect(await request(settings, 'GET', undefined, branchAdmin), 403);
    const local = await expect(await request(branchSettings, 'GET', undefined, branchAdmin), 200);
    assert.deepEqual(local.inheritedHiddenPublic, ['email', 'city']);
    const localChange = { revision: local.revision, hiddenPublic: [], hiddenStaff: ['email'], fields: [{ ...field, label: 'Which service did you attend?' }] };
    const savedLocal = await expect(await request(branchSettings + '?branchId=' + otherBranch, 'PATCH', localChange, branchAdmin), 200);
    await expect(await request(branchSettings, 'PATCH', localChange, branchAdmin), 409);
    const localKey = savedLocal.fields[0].key;
    const localPublic = await expect(await publicForm(), 200);
    assert.ok(localPublic.fields.some((item) => item.key === localKey));
    const otherPublic = await expect(await request(link + '?branchId=' + otherBranch), 200);
    assert.ok(!otherPublic.fields.some((item) => item.key === localKey));
    const otherSettings = await expect(await request(branchSettings, 'GET', undefined, otherPastor), 200);
    assert.deepEqual(otherSettings.fields, []);
    const localStaff = await expect(await request('/guests/staff-form', 'GET', undefined, branchAdmin), 200);
    assert.equal(localStaff.revision, localPublic.formRevision);
    assert.ok(localStaff.hiddenStaff.includes('email'));
    await expect(await request('/guests/staff-form?branchId=' + branch, 'GET', undefined, otherPastor), 403);
    await expect(await submit({ ...core, phone: '555-111-1616' }, localPublic.formRevision), 400);
    await expect(await submit({ ...core, phone: '555-111-1616', [localKey]: 'First service' }, localPublic.formRevision), 201);
    const localGuest = await mongo.db(database).collection('guests').findOne({ phone: '555-111-1616' });
    const localDeskGuest = await expect(await request('/guests', 'POST', {
      branchId: String(branch), firstName: 'Branch', lastName: 'Desk', phone: '555-111-1717',
      customFields: { [localKey]: 'Second service' }, formRevision: localStaff.revision,
    }, branchAdmin), 201);
    assert.equal(localDeskGuest.customAnswers[0].value, 'Second service');
    await expect(await request(branchSettings, 'PATCH', {
      revision: savedLocal.revision, hiddenPublic: [], hiddenStaff: [], fields: [],
    }, branchAdmin), 200);
    assert.ok(!(await expect(await publicForm(), 200)).fields.some((item) => item.key === localKey));
    assert.equal((await expect(await request('/guests/' + localGuest._id, 'GET', undefined, token), 200)).customAnswers[0].value, 'First service');

    await mongo.db(database).collection('appsettings').updateOne({ scopeKey: 'global' }, { $set: { publicConnectEnabled: false } }, { upsert: true });
    await expect(await publicForm(), 404);
    await expect(await submit({ ...core, phone: '555-111-1414' }, 2), 404);
    await expect(await request('/guests/public-register', 'POST', {
      branchId: String(branch), firstName: 'Legacy', lastName: 'Guest', phone: '555-111-1515',
    }), 404);
    let limited = false;
    for (let attempt = 0; attempt <= 30 && !limited; attempt++) {
      const response = await submit(core, 2);
      limited = response.status === 429;
      if (!limited) assert.equal(response.status, 404);
      await response.arrayBuffer();
    }
    assert.ok(limited, 'public submissions are rate limited');
    console.log('Guest Forms & fields verified through both registration routes and workspace boundaries.');
  } finally {
    gateway.close();
    await Promise.all([database, tenantDb].map((name) => mongo.db(name).dropDatabase()));
    await mongo.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
