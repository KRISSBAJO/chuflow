/* Build the API first. Uses disposable databases on local MongoDB only. */
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomBytes, randomUUID } = require('node:crypto');
const { MongoClient, ObjectId } = require('mongoose').mongo;
const { start } = require('../scripts/workspace-gateway.cjs');

async function run() {
  const uri = 'mongodb://127.0.0.1:27017';
  const id = randomBytes(6).toString('hex');
  const database = 'chuflow_ministry_qa_' + id;
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
    const request = (path, method = 'GET', body, token, extraHeaders = {}) => fetch(base + path, {
      method, headers: {
        ...extraHeaders,
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
    const branchId = String(branch);
    await mongo.db(database).collection('branches').insertOne({
      _id: branch, name: 'QA Station', oversightRegion: 'United States', district: 'QA', address: '1 Main',
      city: 'QA', state: 'TX', country: 'US', contactInfo: 'QA', serviceTimes: 'Sunday', status: 'active',
    });
    const settings = (kind) => '/guests/ministry-form-settings/' + kind;
    await expect(await request(settings('child')), 401);
    const definitions = {};
    for (const kind of ['child', 'family', 'outreach', 'service-unit', 'meeting']) {
      const open = ['child', 'family', 'outreach'].includes(kind);
      const change = {
        revision: 0, hiddenPublic: kind === 'outreach' ? ['city'] : [],
        hiddenStaff: kind === 'meeting' ? ['agenda'] : [],
        fields: [{ label: kind + ' extra', type: 'text', public: open, staff: true, required: true, options: [] },
          ...(kind === 'child' ? [{ label: 'Staff question', type: 'text', public: false, staff: true, required: false, options: [] }] : [])],
      };
      const result = await expect(await request(settings(kind), 'PATCH', change, token), 200);
      definitions[kind] = result;
      await expect(await request(settings(kind), 'PATCH', change, token), 409);
      const staff = await expect(await request('/guests/ministry-form/' + kind, 'GET', undefined, token), 200);
      assert.equal(staff.fields[0].key, result.fields[0].key);
    }
    const answer = (kind, value) => ({ formRevision: 1, customFields: { [definitions[kind].fields[0].key]: value } });
    const assertAnswer = (record, value) => assert.equal(record.customAnswers?.[0]?.value, value);

    const familyKey = randomUUID();
    const guardian = { firstName: 'Guardian', lastName: 'Adult', phone: '555-111-1212', relationship: 'parent', canCheckIn: true };
    const family = await expect(await request('/children/families', 'POST', {
      branchId, name: 'Staff family', guardians: [guardian], registrationKey: familyKey, ...answer('family', 'Staff family answer'),
    }, token), 201);
    const guardianId = family.guardians[0].id;
    const child = await expect(await request('/children/profiles', 'POST', {
      familyId: family._id, registrationKey: randomUUID(), firstName: 'Staff', lastName: 'Child', birthDate: '2019-01-01',
      guardianIds: [guardianId], pickupGuardianIds: [guardianId], careNotes: '', pickupNotes: '', photoConsent: false, isMember: false,
      ...answer('child', 'Staff child answer'),
    }, token), 201);
    const staffFamily = await expect(await request('/children/families/' + family._id, 'GET', undefined, token), 200);
    assertAnswer(staffFamily, 'Staff family answer');
    assertAnswer(staffFamily.children.find(({ _id }) => _id === child._id), 'Staff child answer');

    const registration = await expect(await request('/children/registration-links/' + branchId, 'POST', {}, token), 201);
    const registrationHeaders = { 'x-children-registration': registration.token };
    const parentInfo = await expect(await request('/children-registration', 'GET', undefined, undefined, registrationHeaders), 200);
    assert.equal(parentInfo.childForm.fields.length, 1);
    assert.equal(parentInfo.familyForm.fields[0].key, definitions.family.fields[0].key);
    const requestKey = randomUUID();
    const parentChild = { firstName: 'Public', lastName: 'Child', birthDate: '2018-01-01', pickupAdults: [0], careNotes: '' };
    const parentBody = {
      requestKey, familyName: 'Public family', adults: [{ firstName: guardian.firstName, lastName: guardian.lastName, phone: '555-111-1414', relationship: guardian.relationship }],
      children: [{ ...parentChild, ...answer('child', 'Public child answer') }], consent: true, ...answer('family', 'Public family answer'),
    };
    await expect(await request('/children-registration', 'POST', { ...parentBody, consent: false }, undefined, registrationHeaders), 400);
    const received = await expect(await request('/children-registration', 'POST', parentBody, undefined, registrationHeaders), 201);
    assert.deepEqual(received, { received: true });
    const pending = await mongo.db(database).collection('childrenregistrations').findOne({ requestKey });
    assertAnswer(pending, 'Public family answer');
    assertAnswer(pending.children[0], 'Public child answer');
    const approved = await expect(await request('/children/registrations/' + pending._id + '/review', 'POST', {
      action: 'approve', note: 'Checked consent and guardian details', expectedRevision: pending.revision, guardianVerified: true, duplicatesChecked: true, registerAsMembers: false,
    }, token), 201);
    const approvedFamily = await expect(await request('/children/families/' + approved.familyId, 'GET', undefined, token), 200);
    assertAnswer(approvedFamily, 'Public family answer');
    assertAnswer(approvedFamily.children[0], 'Public child answer');

    const outreachLink = await expect(await request('/evangelism/links', 'POST', { branchId, name: 'QA outreach', kind: 'branch' }, token), 201);
    const publicOutreach = '/evangelism/public/' + outreachLink.token;
    const info = await expect(await request(publicOutreach), 200);
    assert.ok(info.form.hiddenStaff.includes('city'));
    const contact = { firstName: 'Public', lastName: 'Contact', phone: '+15551111314', preferredContactMethod: 'phone_call', consentToContact: true };
    await expect(await request(publicOutreach, 'POST', contact), 400);
    const publicReceipt = await expect(await request(publicOutreach, 'POST', { ...contact, city: 'Hidden', ...answer('outreach', 'Public outreach answer') }), 201);
    assert.deepEqual(publicReceipt, { success: true });
    const publicRecord = await mongo.db(database).collection('outreachcontacts').findOne({ phone: contact.phone });
    assert.equal(publicRecord.city, undefined);
    assertAnswer(publicRecord, 'Public outreach answer');
    const staffContact = await expect(await request('/evangelism/contacts', 'POST', { ...contact, branchId, phone: '+15551111315', ...answer('outreach', 'Staff outreach answer') }, token), 201);
    const contactProfile = await expect(await request('/evangelism/contacts/' + staffContact.id, 'GET', undefined, token), 200);
    assertAnswer(contactProfile, 'Staff outreach answer');

    const unit = await expect(await request('/service-units', 'POST', { branchId, name: 'QA service unit', meetingDay: 'Monday', prayerDay: 'Friday', ...answer('service-unit', 'Service unit answer') }, token), 201);
    assertAnswer(await expect(await request('/service-units/' + unit._id, 'GET', undefined, token), 200), 'Service unit answer');
    assertAnswer(await expect(await request('/service-units/' + unit._id, 'PATCH', answer('service-unit', 'Updated unit answer'), token), 200), 'Updated unit answer');

    const meeting = await expect(await request('/meetings', 'POST', {
      branchId, title: 'QA meeting', agenda: 'Hidden agenda', startsAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 90000000).toISOString(), attendeeUserIds: [], sendInvitations: false,
      ...answer('meeting', 'Meeting answer'),
    }, token), 201);
    const detail = await expect(await request('/meetings/' + meeting._id, 'GET', undefined, token), 200);
    assert.notEqual(detail.agenda, 'Hidden agenda');
    assertAnswer(detail, 'Meeting answer');
    assertAnswer(await expect(await request('/meetings/' + meeting._id, 'PATCH', { operation: 'details', expectedRevision: detail.revision, ...answer('meeting', 'Updated meeting answer') }, token), 200), 'Updated meeting answer');
    console.log('Ministry forms verified across staff records, parent registration approval, public outreach, service units, and meetings.');
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
