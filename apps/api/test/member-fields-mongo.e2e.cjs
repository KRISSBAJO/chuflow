/* Build the API first. Uses disposable databases on local MongoDB only. */
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const { MongoClient, ObjectId } = require('mongoose').mongo;
const { start } = require('../scripts/workspace-gateway.cjs');

async function run() {
  const uri = 'mongodb://127.0.0.1:27017';
  const id = randomBytes(6).toString('hex');
  const database = 'chuflow_member_qa_' + id;
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

    const branch = new ObjectId();
    await mongo.db(database).collection('branches').insertOne({
      _id: branch, name: 'QA Station', oversightRegion: 'United States', district: 'QA', address: '1 Main',
      city: 'QA', state: 'TX', country: 'US', contactInfo: 'QA', serviceTimes: 'Sunday', status: 'active',
    });
    const field = (label, type = 'text') => ({ label, type, public: true, staff: true, required: false, options: [] });
    const empty = { revision: 0, hiddenPublic: [], hiddenStaff: [] };
    const guestSettings = await expect(await request('/guests/form-settings', 'PATCH', {
      ...empty, fields: [field('Preferred service'), field('Staff-only note')],
    }, token), 200);
    const [source, privateNote] = guestSettings.fields;
    const guest = await expect(await request('/guests', 'POST', {
      branchId: String(branch), firstName: 'Mapped', lastName: 'Guest', phone: '555-111-1212',
      customFields: { [source.key]: 'Second service', [privateNote.key]: 'Do not copy' },
    }, token), 201);
    const settings = '/members/form-settings';
    await expect(await request(settings), 401);
    const defaults = await expect(await request(settings, 'GET', undefined, token), 200);
    assert.equal(defaults.revision, 0);
    assert.deepEqual(defaults.hiddenStaff, []);
    const publish = (body) => request(settings, 'PATCH', body, token);
    const change = { revision: 0, hiddenPublic: defaults.defaultPublic.map(({ key }) => key),
      hiddenStaff: ['familyDetails', 'formation'], fields: [
        { ...field('Preferred service'), guestFieldKey: source.key, required: true },
        { ...field('Ministry interest'), required: true },
      ],
    };
    await expect(await publish({ ...change, fields: [{ ...change.fields[0], type: 'number' }] }), 400);
    await expect(await publish({ ...change, fields: Array.from({length: 21}, () => field('Extra')) }), 400);
    const published = await expect(await publish(change), 200);
    await expect(await publish(change), 409);
    const [preferred, interest] = published.fields;
    const link = '/intake-templates/public/member-growth-record';
    const form = await expect(await request(link + '?branchId=' + branch), 200);
    assert.equal(form.formRevision, 1);
    assert.ok(form.fields.some((field) => field.key === preferred.key));
    assert.ok(!form.fields.some((field) => field.key === 'email'));
    const other = await expect(await request('/w/test-church' + link), 200);
    assert.ok(other.fields.some((field) => field.key === 'email'));
    assert.ok(!other.fields.some((field) => field.key === preferred.key));
    assert.match(other.shareUrl, /workspace=test-church/);

    const convert = '/members/convert/' + guest._id;
    const preview = await expect(await request(convert + '/form', 'GET', undefined, token), 200);
    assert.deepEqual(preview.values, { [preferred.key]: 'Second service' });
    assert.ok(preview.fields.every((field) => !field.guestFieldKey));
    await expect(await request(convert, 'POST', { formRevision: 1 }, token), 400);
    const converted = await expect(await request(convert, 'POST', {
      formRevision: 1, customFields: { [interest.key]: 'Care team' },
    }, token), 201);
    assert.deepEqual(converted.customAnswers.map(({ value }) => value), ['Second service', 'Care team']);
    const retried = await expect(await request(convert, 'POST', {}, token), 201);
    assert.equal(retried._id, converted._id);

    const staff = await expect(await request('/members', 'POST', {
      branchId: String(branch), firstName: 'Staff', lastName: 'Member', title: 'resident_pastor',
      familyDetails: 'Hidden', bccStatus: 'yes', formRevision: 1,
      customFields: { [preferred.key]: 'Evening service', [interest.key]: 'Hospitality' },
    }, token), 201);
    assert.equal(staff.title, 'resident_pastor');
    assert.equal(staff.familyDetails, undefined);
    assert.notEqual(staff.bccStatus, 'yes');
    assert.equal(staff.customAnswers.length, 2);
    const updated = await expect(await request('/members/' + staff._id, 'PATCH', {
      formRevision: 1, customFields: { [interest.key]: 'Outreach' },
    }, token), 200);
    assert.deepEqual(updated.customAnswers.map(({ value }) => value), ['Evening service', 'Outreach']);

    const publicMember = await expect(await request(link + '/submit?branchId=' + branch, 'POST', {
      formRevision: 1, answers: {
        firstName: 'Public', lastName: 'Member', membershipStatus: 'active',
        [preferred.key]: 'Morning', [interest.key]: 'Music', email: 'hidden@example.com',
      },
    }), 201);
    const profile = await expect(await request('/members/' + publicMember.memberId, 'GET', undefined, token), 200);
    assert.equal(profile.email, undefined);
    assert.deepEqual(profile.customAnswers.map(({ value }) => value), ['Morning', 'Music']);
    await expect(await publish({
      ...change, revision: 1, fields: [{ ...preferred, public: false, staff: false }, interest],
    }), 200);
    const retained = await expect(await request('/members/' + staff._id, 'PATCH', {
      formRevision: 2, customFields: { [interest.key]: 'Welcome team' },
    }, token), 200);
    assert.deepEqual(retained.customAnswers.map(({ value }) => value), ['Evening service', 'Welcome team']);
    console.log('Member forms verified across public intake, staff registration, profile edits, and guest conversion.');
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
