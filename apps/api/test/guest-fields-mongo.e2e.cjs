/* Build the API first. Uses disposable databases on local MongoDB only. */
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
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
  const messages = [];
  const smtp = net.createServer(socket => {
    let buffer = '';
    let data;
    socket.setEncoding('utf8');
    socket.write('220 localhost QA\r\n');
    socket.on('data', chunk => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 2);
        if (data) {
          if (line === '.') {
            messages.push(data.join('\r\n'));
            data = undefined;
            socket.write('250 Accepted\r\n');
          } else data.push(line);
        } else if (line === 'DATA') {
          data = [];
          socket.write('354 End with a period\r\n');
        } else if (line === 'QUIT') socket.end('221 Goodbye\r\n');
        else socket.write('250 localhost\r\n');
      }
    });
  });
  smtp.listen(0, '127.0.0.1');
  await once(smtp, 'listening');
  const gateway = start({
    PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP,
    NODE_PATH: require('node:path').join(__dirname, '..', 'node_modules'),
    PORT: '0', API_BIND_HOST: '127.0.0.1', MONGODB_URI: uri + '/' + database,
    JWT_SECRET: secret(), ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword,
    WEB_URL: 'http://localhost:3000',
    MAIL_HOST: '127.0.0.1', MAIL_PORT: String(smtp.address().port),
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
    async function signInAs(role, branchId, scope = {}) {
      const email = `${role}@example.com`;
      await mongo.db(database).collection('users').insertOne({
        firstName: 'Branch', lastName: 'Tester', email, role, branchId,
        password: await bcrypt.hash(adminPassword, 4), isActive: true, ...scope,
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

    const prayer = '/guests/prayer-care';
    const prayerForm = await expect(await publicForm(), 200);
    assert.ok(prayerForm.fields.some((item) => item.key === 'wantsPastoralCall' && !item.required));
    const prayerText = 'Private request from local QA';
    await expect(await submit({ ...core, phone: '555-111-1818', prayerRequest: prayerText, wantsPastoralCall: 'Yes' }, prayerForm.formRevision), 201);
    await expect(await submit({ ...core, phone: '555-111-1919', prayerRequest: 'Private prayer only' }, prayerForm.formRevision), 201);
    const optedIn = await mongo.db(database).collection('guests').findOne({ phone: '555-111-1818' });
    assert.equal(optedIn.wantsPastoralCall, true);
    assert.equal((await expect(await request('/guests/' + optedIn._id, 'GET', undefined, branchAdmin), 200)).prayerRequest, undefined);
    const submissions = mongo.db(database).collection('intakesubmissions');
    assert.ok(await submissions.countDocuments({ 'answers.phone': '555-111-1818' }));
    assert.equal(await submissions.countDocuments({ 'answers.prayerRequest': prayerText }), 0);
    const team = await signInAs('follow_up', branch);
    const usher = await signInAs('usher', branch);
    const staffId = (await mongo.db(database).collection('users').findOne({ email: 'follow_up@example.com' }))._id;
    const outsideId = (await mongo.db(database).collection('users').findOne({ email: 'resident_pastor@example.com' }))._id;
    await expect(await request(prayer), 401);
    await expect(await request(prayer, 'GET', undefined, usher), 403);
    assert.equal((await expect(await request(prayer, 'GET', undefined, otherPastor), 200)).items.length, 0);
    assert.equal((await expect(await request(prayer, 'GET', undefined, team), 200)).items.length, 0);
    const queue = await expect(await request(prayer, 'GET', undefined, branchAdmin), 200);
    const contact = queue.items.find((item) => item.request === prayerText);
    const privateOnly = queue.items.find((item) => item.request === 'Private prayer only');
    assert.equal(contact.phone, '555-111-1818');
    assert.equal(privateOnly.phone, undefined);
    const updatePrayer = (item, body, auth = branchAdmin) => request(prayer + '/' + item.id, 'PATCH', { revision: item.revision, ...body }, auth);
    await expect(await updatePrayer(privateOnly, { status: 'follow_up' }), 400);
    await expect(await updatePrayer(contact, { status: 'praying', assigneeId: String(outsideId) }), 400);
    await expect(await updatePrayer(contact, { status: 'praying', assigneeId: String(staffId) }), 200);
    await expect(await updatePrayer(contact, { status: 'closed' }), 409);
    const assigned = (await expect(await request(prayer, 'GET', undefined, team), 200)).items;
    assert.deepEqual(assigned.map((item) => item.id), [contact.id]);
    await expect(await updatePrayer(assigned[0], { status: 'follow_up', assigneeId: null }, team), 403);
    await expect(await updatePrayer(assigned[0], { status: 'follow_up', dueDate: '2026-02-30' }, team), 400);
    const privateNote = 'Private follow-up note from local QA';
    await expect(await updatePrayer(assigned[0], { status: 'follow_up', dueDate: '2026-11-12', note: privateNote }, team), 200);
    await expect(await updatePrayer(assigned[0], { status: 'follow_up', note: 'Stale draft' }, team), 409);
    const followUpQueue = await expect(await request(prayer + '?view=follow_up', 'GET', undefined, branchAdmin), 200);
    assert.deepEqual(followUpQueue.items.map((item) => item.id), [contact.id]);
    assert.equal(followUpQueue.items[0].dueDate, '2026-11-12');
    assert.ok(!JSON.stringify(followUpQueue).includes(privateNote));
    const timeline = prayer + '/' + contact.id + '/timeline';
    await expect(await request(timeline), 401);
    await expect(await request(timeline, 'GET', undefined, otherPastor), 404);
    await expect(await request(timeline, 'GET', undefined, usher), 403);
    const history = await expect(await request(timeline, 'GET', undefined, team), 200);
    assert.deepEqual(history.events.map(({ status }) => status), ['follow_up', 'praying']);
    assert.equal(history.events[0].note, privateNote);
    assert.equal(history.events[0].dueDate, '2026-11-12');
    assert.ok(history.events[1].assignee);
    const audits = await mongo.db(database).collection('auditlogs').find({ entityId: contact.id }).toArray();
    assert.ok(!JSON.stringify(audits).includes(privateNote));
    await expect(await updatePrayer(followUpQueue.items[0], { status: 'closed', assigneeId: null }), 200);
    await expect(await request(timeline, 'GET', undefined, team), 404);

    const youth = (path = '', method = 'GET', body, auth = branchAdmin) => request('/youth' + path, method, body, auth);
    await expect(await youth('/pilot', 'POST', { branchId: String(branch) }, team), 403);
    const youthAccounts = {};
    for (const role of ['youth_leader', 'youth_pastor']) {
      const payload = { firstName: 'Youth', lastName: 'Tester', email: role + '@example.com', password: adminPassword, role, isActive: true };
      const created = await expect(await request('/users', 'POST', payload, branchAdmin), 201);
      assert.equal(created.role, role);
      const login = await expect(await request('/auth/mobile/login', 'POST', { email: payload.email, password: adminPassword }), 200);
      youthAccounts[role] = { token: login.accessToken, id: created._id };
      await expect(await request('/auth/me', 'GET', undefined, login.accessToken), 200);
      for (const path of ['/users', '/members', '/guests', '/children', '/meetings', '/finance/offerings']) {
        await expect(await request(path, 'GET', undefined, login.accessToken), 403);
      }
    }
    const youthLeader = youthAccounts.youth_leader;
    const youthPastor = youthAccounts.youth_pastor;
    assert.equal((await expect(await youth('', 'GET', undefined, youthLeader.token), 200)).groups.length, 0);
    await expect(await youth('/pilot', 'POST', { branchId: String(otherBranch) }, youthPastor.token), 403);
    await expect(await youth('/pilot', 'POST', { branchId: String(branch) }), 201);
    await expect(await youth('/pilot', 'POST', { branchId: String(branch) }), 201);
    const overview = await expect(await youth(), 200);
    assert.equal(overview.groups.length, 2);
    assert.equal((await expect(await youth('', 'GET', undefined, otherPastor), 200)).groups.length, 0);
    const teens = '/groups/' + overview.groups.find(group => group.program === 'Teens Church')._id;
    const adults = '/groups/' + overview.groups.find(group => group.program === 'Youth Alive')._id;
    await expect(await youth(teens, 'GET', undefined, youthPastor.token), 200);
    await expect(await youth(teens, 'GET', undefined, youthLeader.token), 403);
    await expect(await youth('/pilot', 'POST', { branchId: String(branch) }, youthLeader.token), 403);
    await expect(await youth(teens, 'GET', undefined, otherPastor), 403);
    await expect(await youth(teens + '/link', 'POST'), 403);
    for (const group of [teens, adults]) {
      await expect(await youth(group + '/leader', 'PATCH', { leaderId: String(outsideId), clearanceUntil: '2099-01-01', screeningVerified: true }), 400);
      await expect(await youth(group + '/leader', 'PATCH', { leaderId: String(staffId), clearanceUntil: '2099-01-01', screeningVerified: true }), 200);
      await expect(await youth(group + '/link', 'POST'), 201);
    }
    const teenLink = (await expect(await youth(teens), 200)).registrationToken;
    const adultLink = (await expect(await youth(adults), 200)).registrationToken;
    const registration = (registrationToken, body, workspace = '') => fetch(base + workspace + '/youth-registration', {
      method: body ? 'POST' : 'GET',
      headers: { 'x-youth-registration': registrationToken, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    await expect(await registration(teenLink, undefined, '/w/test-church'), 404);
    const birthDate = (years) => (new Date().getUTCFullYear() - years) + '-01-01';
    const commonYouth = { firstName: 'Local', lastName: 'Youth', contact: 'local@example.com', consentVersion: 1, consent: true, locale: 'en', formRevision: 0 };
    const teen = { ...commonYouth, birthDate: birthDate(15), guardianName: 'Local Guardian' };
    const adult = { ...commonYouth, firstName: 'Adult', birthDate: birthDate(21) };
    await expect(await registration(teenLink, { ...teen, guardianName: undefined }), 400);
    await expect(await registration(adultLink, teen), 400);
    await expect(await registration(teenLink, teen), 201);
    await expect(await registration(teenLink, teen), 201);
    await expect(await registration(adultLink, adult), 201);
    const roster = await expect(await youth(teens), 200);
    assert.equal(roster.people.length, 1);
    const teenId = roster.people[0]._id;
    assert.equal(roster.people[0].guardianName, teen.guardianName);
    assert.equal((await expect(await youth(teens, 'GET', undefined, team), 200)).people.length, 0);
    const date = new Date().toISOString().slice(0, 10);
    const mark = { date, enrollmentId: teenId, present: true };
    await expect(await youth(teens + '/attendance', 'PATCH', mark, team), 404);
    await expect(await youth(teens + '/people/' + teenId, 'PATCH', { state: 'active' }), 400);
    const existingChild = await mongo.db(database).collection('childprofiles').insertOne({
      branchId: branch, firstName: teen.firstName, lastName: teen.lastName, birthDate: teen.birthDate, isActive: true,
    });
    const matches = await expect(await youth(teens + '/people/' + teenId + '/matches'), 200);
    assert.equal(matches.children[0]._id, String(existingChild.insertedId));
    await expect(await youth(teens + '/people/' + teenId, 'PATCH', { state: 'active', guardianVerified: true, childId: String(existingChild.insertedId) }), 200);
    const leaderRoster = await expect(await youth(teens, 'GET', undefined, team), 200);
    assert.equal(leaderRoster.people[0]._id, teenId);
    assert.equal(leaderRoster.people[0].guardianName, undefined);
    assert.equal(leaderRoster.registrationToken, null);
    assert.equal((await expect(await youth(teens + '?view=attendance'), 200)).people[0].contact, undefined);
    await expect(await youth(teens + '/attendance', 'PATCH', mark, team), 200);
    await expect(await youth(teens + '/attendance', 'PATCH', mark, team), 200);
    assert.deepEqual((await expect(await youth(teens), 200)).present, [teenId]);
    const adultRoster = await expect(await youth(adults), 200);
    const adultId = adultRoster.people[0]._id;
    await expect(await youth(adults + '/people/' + adultId, 'PATCH', { state: 'active' }), 200);
    const extraGroup = await expect(await youth('/groups', 'POST', {
      branchId: String(branch), name: 'Young Adult Leaders', program: 'Youth Alive', minAge: 18, maxAge: 35, meetingDay: 1, guardianUnderAge: 18,
    }), 201);
    await expect(await youth('/groups/' + extraGroup.id + '/leader', 'PATCH', {
      leaderId: String(staffId), clearanceUntil: '2099-01-01', screeningVerified: true,
    }), 200);
    const move = { destinationId: extraGroup.id, consent: true, consentVersion: 1, locale: 'en', contact: 'new-contact@example.com' };
    const transfer = adults + '/people/' + adultId + '/transition';
    await expect(await youth(transfer, 'POST', move, team), 403);
    await expect(await youth(transfer, 'POST', move), 201);
    await expect(await youth(transfer, 'POST', { ...move, contact: 'another@example.com' }), 409);
    const linked = await mongo.db(database).collection('youthenrollments').findOne({ groupId: new ObjectId(extraGroup.id) });
    assert.equal(String(linked.linkedEnrollmentId), adultId);
    assert.equal(linked.consentSource, 'staff');

    const development = teens + '/development';
    await expect(await youth(development, 'GET', undefined, otherPastor), 403);
    await expect(await youth(development, 'GET', undefined, youthLeader.token), 403);
    await expect(await youth(development + '/tracks', 'POST', { title: 'Foundations', milestones: ['Start'] }, team), 403);
    const track = await expect(await youth(development + '/tracks', 'POST', {
      title: 'Foundations', milestones: ['Read together', 'Discuss'],
    }, youthPastor.token), 201);
    const progressPath = development + '/' + track.id + '/progress';
    const setProgress = (milestone, completed = true, enrollmentId = teenId) =>
      youth(progressPath, 'PATCH', { enrollmentId, milestone, completed }, team);
    await expect(await setProgress(5), 400);
    await expect(await setProgress(0, true, adultId), 404);
    for (const response of await Promise.all([setProgress(0), setProgress(1), setProgress(0)])) await expect(response, 200);
    const progress = (await expect(await youth(development, 'GET', undefined, team), 200)).progress;
    assert.deepEqual(progress.find(row => row.activityId === track.id).completed.sort(), [0, 1]);
    await expect(await setProgress(0, false), 200);
    const project = await expect(await youth(development + '/projects', 'POST', { title: 'Community cleanup', date, location: 'Park' }), 201);
    await expect(await youth(development + '/' + project.id + '/progress', 'PATCH', { enrollmentId: teenId, milestone: 0, completed: true }, team), 200);
    const future = await expect(await youth(development + '/projects', 'POST', { title: 'Future project', date: '2099-01-01', location: 'Park' }), 201);
    await expect(await youth(development + '/' + future.id + '/progress', 'PATCH', { enrollmentId: teenId, milestone: 0, completed: true }, team), 400);
    const pair = { title: 'Leadership skills', enrollmentId: teenId, permissionConfirmed: true };
    await expect(await youth(development + '/mentoring', 'POST', { ...pair, permissionConfirmed: false }), 400);
    const mentoring = await expect(await youth(development + '/mentoring', 'POST', pair, youthPastor.token), 201);
    await expect(await youth(development + '/mentoring', 'POST', pair), 409);
    const checkIn = development + '/' + mentoring.id + '/check-ins';
    await expect(await youth(checkIn, 'POST', { date }, team), 201);
    await expect(await youth(checkIn, 'POST', { date }, team), 201);
    const mentorView = await expect(await youth(development, 'GET', undefined, team), 200);
    assert.deepEqual(mentorView.activities.find(item => item._id === mentoring.id).checkIns, [date]);
    assert.equal(mentorView.people[0].contact, undefined);
    await expect(await youth(teens + '/leader', 'PATCH', { leaderId: youthLeader.id, clearanceUntil: '2099-01-01', screeningVerified: true }), 200);
    await expect(await youth(checkIn, 'POST', { date }, team), 403);
    assert.ok(!(await expect(await youth(development, 'GET', undefined, youthLeader.token), 200)).activities.some(item => item._id === mentoring.id));
    await expect(await youth(development + '/' + mentoring.id + '/end', 'PATCH', undefined, youthPastor.token), 200);
    await expect(await youth(teens + '/leader', 'PATCH', { leaderId: String(staffId), clearanceUntil: '2099-01-01', screeningVerified: true }), 200);

    const invitePath = teens + '/people/' + teenId + '/invite';
    const invite = { email: 'participant@example.com', permissionConfirmed: true };
    await expect(await youth(invitePath, 'POST', invite, otherPastor), 403);
    await expect(await youth(invitePath, 'POST', { ...invite, permissionConfirmed: false }, youthPastor.token), 400);
    const invitation = await expect(await youth(invitePath, 'POST', invite, youthPastor.token), 201);
    await expect(await youth(invitePath, 'POST', invite, youthPastor.token), 409);
    const inviteToken = new URL(invitation.invitation).searchParams.get('token');
    await expect(await request('/auth/reset-password', 'POST', { token: inviteToken, newPassword: adminPassword }), 201);
    await expect(await request('/auth/reset-password', 'POST', { token: inviteToken, newPassword: adminPassword }), 400);
    const participant = await expect(await request('/auth/mobile/login', 'POST', { email: invite.email, password: adminPassword }), 200);
    assert.equal(participant.user.role, 'youth_participant');
    const participantToken = participant.accessToken;
    const participantHome = () => request('/youth-participant/home', 'GET', undefined, participantToken);
    const youthHome = await expect(await participantHome(), 200);
    const reminderAssignment = await expect(await youth(development + '/mentoring', 'POST',
      { ...pair, title: 'Private staff focus' }, youthPastor.token), 201);
    const mentoringReminderPath = development + '/' + reminderAssignment.id + '/reminder';
    const reminderInput = { date, nextStep: 'Bring your reflection.' };
    await expect(await youth(mentoringReminderPath, 'PATCH', reminderInput, otherPastor), 403);
    await expect(await youth(mentoringReminderPath, 'PATCH', { ...reminderInput, date: '2026-02-30' }, team), 400);
    await expect(await youth(mentoringReminderPath, 'PATCH', reminderInput, team), 200);
    const reminderHome = await expect(await participantHome(), 200);
    assert.deepEqual(reminderHome.mentoringReminder, reminderInput);
    assert.ok(!JSON.stringify(reminderHome).includes('Private staff focus'));
    const rolloutPath = development + '/rollout';
    const consentInvitePath = development + '/mentoring-consent/' + teenId;
    const emailPath = development + '/' + reminderAssignment.id + '/mentoring-email';
    const rollout = { youthFeedEnabled: true, mentoringEmailEnabled: true };
    await expect(await youth(consentInvitePath, 'POST', undefined, youthPastor.token), 403);
    await expect(await youth(rolloutPath, 'PATCH', rollout, otherPastor), 403);
    await expect(await youth(rolloutPath, 'PATCH', rollout, youthPastor.token), 200);
    await expect(await youth(emailPath, 'POST', undefined, youthPastor.token), 409);
    const consentInvite = await expect(await youth(consentInvitePath, 'POST', undefined, youthPastor.token), 201);
    assert.equal(consentInvite.guardian, true);
    const preferenceToken = new URL(consentInvite.link).pathname.split('/').pop();
    const preference = (enabled, token = preferenceToken) => fetch(base + '/youth-registration/mentoring-consent', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-youth-registration': token },
      body: JSON.stringify({ enabled, locale: 'es' }),
    });
    await expect(await preference(true, preferenceToken.slice(0, -1) + (preferenceToken.endsWith('0') ? '1' : '0')), 404);
    await expect(await preference(true), 201);
    await expect(await preference(true), 409);
    const mailAttempts = await Promise.all([youth(emailPath, 'POST', undefined, youthPastor.token), youth(emailPath, 'POST', undefined, youthPastor.token)]);
    assert.deepEqual(mailAttempts.map(response => response.status).sort(), [201, 409]);
    const mentoringEmail = messages.map(message => message.replace(/=\r\n/g, '').replace(/=3D/g, '='))
      .find(message => message.includes('mentoring=off'));
    assert.ok(mentoringEmail);
    assert.match(mentoringEmail, /To: local@example\.com/);
    assert.match(mentoringEmail, /Hay una reuni/);
    assert.ok(!mentoringEmail.includes('Bring your reflection'));
    assert.ok(!mentoringEmail.includes('Private staff focus'));
    const optOutToken = mentoringEmail.match(/youth-register\/([a-f0-9]{88})\?mentoring=off/)[1];
    await expect(await preference(false, optOutToken), 201);
    await expect(await preference(true), 409);
    await expect(await youth(development + '/' + reminderAssignment.id + '/check-ins', 'POST', { date }, team), 201);
    assert.equal((await expect(await participantHome(), 200)).mentoringReminder, undefined);
    await expect(await youth(mentoringReminderPath, 'PATCH', reminderInput, team), 409);
    await expect(await youth(mentoringReminderPath, 'PATCH', { date: '2099-02-28' }, youthPastor.token), 200);
    await expect(await youth(mentoringReminderPath, 'PATCH', { date: null }, youthPastor.token), 200);
    assert.equal((await expect(await participantHome(), 200)).mentoringReminder, undefined);
    const servicePath = development + '/' + project.id + '/service-minutes';
    const service = { enrollmentId: teenId, minutes: 90 };
    await expect(await youth(servicePath, 'PATCH', service, team), 403);
    await expect(await youth(servicePath, 'PATCH', service, otherPastor), 403);
    await expect(await youth(servicePath, 'PATCH', { ...service, minutes: 1441 }, youthPastor.token), 400);
    await expect(await youth(servicePath, 'PATCH', service, youthPastor.token), 200);
    const verifiedService = (await expect(await participantHome(), 200)).serviceHistory;
    assert.deepEqual(verifiedService, [{ id: project.id, title: 'Community cleanup', date, minutes: 90 }]);
    const projectProgress = development + '/' + project.id + '/progress';
    await expect(await youth(projectProgress, 'PATCH', { enrollmentId: teenId, milestone: 0, completed: false }, team), 200);
    await expect(await youth(servicePath, 'PATCH', service, youthPastor.token), 409);
    assert.deepEqual((await expect(await participantHome(), 200)).serviceHistory, []);
    const postBody = { kind: 'devotional', title: 'Weekly reflection', body: 'Consider how you can welcome someone this week.' };
    await expect(await youth(development + '/posts', 'POST', postBody, otherPastor), 403);
    await expect(await youth(development + '/posts', 'POST', { ...postBody, body: ' ' }, youthPastor.token), 400);
    const posted = await expect(await youth(development + '/posts', 'POST', postBody, youthPastor.token), 201);
    await expect(await youth(adults + '/development/posts', 'POST', { ...postBody, title: 'Other group' }), 201);
    const postFeed = (await expect(await participantHome(), 200)).posts;
    assert.deepEqual(postFeed.map(post => post.title), ['Weekly reflection']);
    assert.equal(postFeed[0].createdBy, undefined);
    await expect(await youth(rolloutPath, 'PATCH', { ...rollout, youthFeedEnabled: false }, youthPastor.token), 200);
    assert.deepEqual((await expect(await participantHome(), 200)).posts, []);
    await expect(await youth(rolloutPath, 'PATCH', rollout, youthPastor.token), 200);
    await expect(await youth(adults + '/development/posts/' + posted.id, 'DELETE'), 404);
    await expect(await youth(development + '/posts/' + posted.id, 'DELETE', undefined, youthPastor.token), 200);
    assert.deepEqual((await expect(await participantHome(), 200)).posts, []);
    assert.deepEqual(youthHome.tracks.find(item => item.id === track.id).completed, [1]);
    assert.equal(youthHome.projects.find(item => item.id === future.id).signedUp, false);
    assert.ok(!JSON.stringify(youthHome).includes('Leadership skills'));
    await expect(await request('/youth', 'GET', undefined, participantToken), 403);
    await expect(await request('/guests', 'GET', undefined, participantToken), 403);
    await expect(await request('/youth-participant/home', 'GET', undefined, youthPastor.token), 403);
    await expect(await request('/youth-participant/projects/' + track.id + '/signup', 'POST', {}, participantToken), 404);
    await expect(await request('/youth-participant/projects/' + future.id + '/signup', 'POST', {}, participantToken), 201);
    await expect(await request('/youth-participant/projects/' + future.id + '/signup', 'POST', {}, participantToken), 201);
    assert.equal((await expect(await participantHome(), 200)).projects.find(item => item.id === future.id).signedUp, true);
    assert.ok((await expect(await youth(development), 200)).progress.some(item => item.activityId === future.id && item.enrollmentId === teenId && item.signedUpAt));

    const pilotEvent = await expect(await youth('/events', 'POST', { branchId: String(branch), name: 'Participant RSVP QA',
      program: 'Teens Church', minAge: 13, maxAge: 17, guardianUnderAge: 18, venue: 'Local Hall',
      eventDate: date, registrationDeadline: date, capacity: 1 }), 201);
    const pilotPath = '/groups/' + pilotEvent.id;
    await expect(await youth(pilotPath + '/leader', 'PATCH', { leaderId: String(staffId), clearanceUntil: '2099-01-01', screeningVerified: true }), 200);
    await expect(await youth(pilotPath + '/link', 'POST'), 201);
    const openEvent = (await expect(await participantHome(), 200)).events.find(item => item.id === pilotEvent.id);
    await expect(await registration(new URL(openEvent.registrationUrl).pathname.split('/').pop(), teen), 201);
    const rsvp = (await expect(await participantHome(), 200)).events.find(item => item.id === pilotEvent.id);
    assert.equal(rsvp.state, 'pending');
    assert.equal(rsvp.registrationUrl, undefined);

    await expect(await youth(teens + '/people/' + teenId + '/withdraw', 'POST'), 201);
    await expect(await participantHome(), 403);
    await expect(await youth(teens + '/attendance', 'PATCH', mark, team), 404);
    assert.deepEqual((await expect(await youth(teens), 200)).present, [teenId]);
    await expect(await youth(teens + '/link', 'DELETE'), 200);
    await expect(await registration(teenLink), 404);

    const eventInput = { branchId: String(branch), name: 'Youth Rally', program: 'Teens Church', minAge: 13, maxAge: 17,
      guardianUnderAge: 18, venue: 'Local Hall', eventDate: date, registrationDeadline: date, capacity: 1 };
    await expect(await youth('/events', 'POST', eventInput, otherPastor), 403);
    await expect(await youth('/events', 'POST', { ...eventInput, registrationDeadline: '2099-01-01' }), 400);
    const district = await signInAs('district_admin', undefined, { district: 'QA', oversightRegion: 'United States' });
    await expect(await youth(teens, 'GET', undefined, district), 403);
    const event = await expect(await youth('/events', 'POST', eventInput, district), 201);
    const eventPath = '/groups/' + event.id;
    await expect(await youth(eventPath + '/link', 'POST'), 403);
    await expect(await youth(eventPath + '/leader', 'PATCH', { leaderId: String(staffId), clearanceUntil: '2099-01-01', screeningVerified: true }), 200);
    await expect(await youth(eventPath + '/link', 'POST'), 201);
    const eventLink = (await expect(await youth(eventPath), 200)).registrationToken;
    const form = await expect(await registration(eventLink), 200);
    assert.equal(form.eventDate, date);
    assert.equal(form.venue, 'Local Hall');
    await expect(await registration(eventLink, { ...teen, guardianEmailOptIn: true, contact: '555-111-2222' }), 400);
    await expect(await registration(eventLink, { ...teen, guardianEmailOptIn: true, locale: 'es' }), 201);
    await expect(await registration(eventLink, { ...teen, firstName: 'Second', guardianEmailOptIn: true, locale: 'es' }), 201);
    const eventRoster = await expect(await youth(eventPath), 200);
    const approveSeat = (person) => youth(eventPath + '/people/' + person._id, 'PATCH', { state: 'active', guardianVerified: true });
    const results = await Promise.all(eventRoster.people.map(approveSeat));
    assert.deepEqual(results.map(response => response.status).sort(), [200, 409]);
    assert.equal((await results.find(response => response.status === 409).json()).code, 'youth_event_full');
    const confirmed = eventRoster.people.find((_, index) => results[index].status === 200);
    const waiting = eventRoster.people.find((_, index) => results[index].status === 409);
    const reminderPath = eventPath + '/people/' + confirmed._id + '/guardian-reminder';
    await expect(await youth(reminderPath, 'POST', undefined, otherPastor), 403);
    await expect(await youth(reminderPath, 'POST', undefined, district), 403);
    await expect(await youth(eventPath + '/people/' + waiting._id + '/guardian-reminder', 'POST'), 409);
    const deliveries = await Promise.all([youth(reminderPath, 'POST'), youth(reminderPath, 'POST')]);
    assert.deepEqual(deliveries.map(response => response.status).sort(), [201, 409]);
    const reminder = messages.find(message => message.includes('Recordatorio del evento juvenil'));
    assert.ok(reminder);
    assert.ok(reminder.includes('Youth Rally'));
    const unsubscribeToken = reminder.replace(/=\r\n/g, '').match(/youth-register\/([a-f0-9]{48})/)[1];
    const unsubscribe = await fetch(base + '/youth-registration/unsubscribe', { method: 'POST', headers: { 'x-youth-registration': unsubscribeToken } });
    await expect(unsubscribe, 201);
    const optedOut = (await expect(await youth(eventPath), 200)).people.find(person => person._id === confirmed._id);
    assert.equal(optedOut.guardianEmailOptIn, false);
    assert.equal(optedOut.guardianEmailTokenHash, undefined);
    const eventMark = { date, enrollmentId: confirmed._id, present: true };
    await expect(await youth(eventPath + '/attendance', 'PATCH', { ...eventMark, date: '2000-01-01' }, team), 400);
    await expect(await youth(eventPath + '/attendance', 'PATCH', eventMark, team), 200);
    await expect(await youth(eventPath + '/leader', 'PATCH', { leaderId: youthLeader.id, clearanceUntil: '2099-01-01', screeningVerified: true }, youthPastor.token), 200);
    await expect(await youth(eventPath + '/attendance', 'PATCH', eventMark, youthLeader.token), 200);
    const eventFollowUpPath = eventPath + '/people/' + confirmed._id + '/follow-up';
    const eventTask = { ownerId: youthPastor.id, dueDate: date, date, reason: 'invite', outcome: 'open', revision: 0 };
    await expect(await youth(eventFollowUpPath, 'PATCH', eventTask, youthLeader.token), 403);
    await expect(await youth(eventFollowUpPath, 'PATCH', eventTask, district), 403);
    await expect(await youth(eventFollowUpPath, 'PATCH', eventTask, otherPastor), 403);
    await expect(await youth(eventFollowUpPath, 'PATCH', { ...eventTask, reason: 'missed' }), 400);
    await expect(await youth(eventFollowUpPath, 'PATCH', eventTask), 200);
    await expect(await youth(eventFollowUpPath, 'PATCH', { ...eventTask, outcome: 'connected', revision: 1 }, youthPastor.token), 200);
    const eventFollowUpRoster = await expect(await youth(eventPath), 200);
    assert.equal(eventFollowUpRoster.people.find(person => person._id === confirmed._id).campFollowUp.outcome, 'connected');
    for (const [suffix, auth] of [['', district], ['', youthLeader.token], ['?view=attendance', branchAdmin]]) {
      const restricted = await expect(await youth(eventPath + suffix, 'GET', undefined, auth), 200);
      assert.equal(restricted.followUpOwners, undefined);
      assert.equal(restricted.people.find(person => person._id === confirmed._id).campFollowUp, undefined);
    }
    await expect(await youth(eventPath + '/link', 'DELETE', undefined, youthLeader.token), 403);
    assert.equal((await expect(await youth(eventPath, 'GET', undefined, youthLeader.token), 200)).people[0].guardianName, undefined);
    assert.equal((await expect(await youth('', 'GET', undefined, youthLeader.token), 200)).groups.length, 1);
    await expect(await youth(eventPath + '/people/' + confirmed._id + '/withdraw', 'POST'), 201);
    await expect(await approveSeat(waiting), 200);
    assert.deepEqual((await expect(await youth(eventPath + '?date=2000-01-01'), 200)).present, [confirmed._id]);

    const tomorrow = new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10);
    const campInput = { ...eventInput, name: 'District camp', campEndDate: tomorrow, currency: 'USD', feeMinor: 5000, depositMinor: 2000, capacity: 2 };
    const camp = await expect(await youth('/camps', 'POST', campInput, district), 201);
    const campPath = '/camps/' + camp.id;
    const localCamp = campPath + '/branches/' + branch;
    const visitingCamp = campPath + '/branches/' + otherBranch;
    await expect(await youth(campPath, 'GET', undefined, otherPastor), 403);
    await expect(await youth(campPath + '/branches', 'POST', { branchId: String(otherBranch) }), 403);
    await expect(await youth(campPath + '/branches', 'POST', { branchId: String(branch) }, district), 201);
    await expect(await youth(campPath + '/branches', 'POST', { branchId: String(otherBranch) }, district), 201);
    await expect(await youth('/groups/' + camp.id + '/leader', 'PATCH', { leaderId: String(staffId), clearanceUntil: date, screeningVerified: true }), 200);
    await expect(await youth(localCamp + '/link', 'PATCH', { enabled: true }), 403);
    await expect(await youth('/groups/' + camp.id + '/leader', 'PATCH', { leaderId: String(staffId), clearanceUntil: '2099-01-01', screeningVerified: true }), 200);
    await expect(await youth(localCamp + '/link', 'PATCH', { enabled: true }), 200);
    await expect(await youth(visitingCamp + '/link', 'PATCH', { enabled: true }, otherPastor), 200);
    const campToken = (await expect(await youth(campPath + '?branch=' + branch), 200)).token;
    const home = await expect(await youth('/home-preview', 'GET', undefined, youthPastor.token), 200);
    assert.equal(home.branch, 'QA Station');
    assert.ok(home.groups.some(group => group.program === 'Teens Church'));
    assert.ok(home.events.some(event => event.id === camp.id));
    assert.ok(home.tracks.length);
    assert.ok(!JSON.stringify(home).includes(campToken));
    const otherHome = await expect(await youth('/home-preview', 'GET', undefined, otherPastor), 200);
    assert.notEqual(otherHome.branch, home.branch);
    assert.equal(otherHome.tracks.length, 0);
    await expect(await youth('/home-preview', 'GET', undefined, youthLeader.token), 403);
    const visitorToken = (await expect(await youth(campPath, 'GET', undefined, otherPastor), 200)).token;
    assert.notEqual(campToken, visitorToken);
    const campForm = await expect(await registration(campToken), 200);
    assert.equal(campForm.campEndDate, tomorrow);
    assert.equal(campForm.branchName, 'QA Station');
    assert.equal(campForm.depositMinor, 2000);
    await expect(await registration(campToken, { ...teen, transportConsent: true }), 201);
    await expect(await registration(visitorToken, { ...teen, firstName: 'Visiting' }), 201);
    const summary = await expect(await youth(campPath, 'GET', undefined, district), 200);
    assert.equal(summary.branches.length, 2);
    assert.deepEqual(summary.people, []);
    await expect(await youth(campPath + '?branch=' + otherBranch), 403);
    await expect(await youth('/groups/' + camp.id), 404);
    const ownCampPerson = (await expect(await youth(campPath + '?branch=' + branch), 200)).people[0];
    const visitCampPerson = (await expect(await youth(campPath, 'GET', undefined, otherPastor), 200)).people[0];
    const ownPersonPath = localCamp + '/people/' + ownCampPerson._id;
    const visitPersonPath = visitingCamp + '/people/' + visitCampPerson._id;
    await expect(await youth(ownPersonPath + '/review', 'PATCH', { state: 'active' }), 400);
    await expect(await youth(ownPersonPath + '/review', 'PATCH', { state: 'active', guardianVerified: true }), 200);
    await expect(await youth(visitPersonPath + '/review', 'PATCH', { state: 'active', guardianVerified: true }, otherPastor), 200);
    await expect(await youth(visitPersonPath + '/logistics', 'PATCH', { transport: 'Bus B', room: 'Room 2' }, otherPastor), 400);
    await expect(await youth(ownPersonPath + '/logistics', 'PATCH', { transport: 'Bus A', room: 'Room 1' }), 200);
    await expect(await youth(localCamp + '/attendance', 'PATCH', { date: tomorrow, enrollmentId: ownCampPerson._id, present: true }), 400);
    await expect(await youth(localCamp + '/attendance', 'PATCH', { date, enrollmentId: ownCampPerson._id, present: true }), 200);
    const followUpPath = ownPersonPath + '/follow-up';
    const followUp = { ownerId: youthPastor.id, dueDate: tomorrow, date, reason: 'welcome', outcome: 'open', revision: 0 };
    await expect(await youth(followUpPath, 'PATCH', followUp, otherPastor), 403);
    await expect(await youth(followUpPath, 'PATCH', followUp, district), 403);
    await expect(await youth(followUpPath, 'PATCH', { ...followUp, ownerId: youthLeader.id }), 400);
    await expect(await youth(followUpPath, 'PATCH', { ...followUp, reason: 'missed' }), 400);
    await expect(await youth(followUpPath, 'PATCH', followUp), 200);
    await expect(await youth(followUpPath, 'PATCH', followUp), 409);
    await expect(await youth(followUpPath, 'PATCH', { ...followUp, outcome: 'connected', revision: 1 }, youthPastor.token), 200);
    const campWithFollowUp = await expect(await youth(campPath + '?branch=' + branch), 200);
    assert.equal(campWithFollowUp.people[0].campFollowUp.outcome, 'connected');
    assert.ok(campWithFollowUp.followUpOwners.some(owner => owner._id === youthPastor.id));
    assert.deepEqual((await expect(await youth(campPath, 'GET', undefined, district), 200)).followUpOwners, []);
    assert.equal((await expect(await youth(campPath, 'GET', undefined, otherPastor), 200)).people[0].campFollowUp, undefined);
    await expect(await youth(visitPersonPath + '/guardian-reminder', 'POST', undefined, otherPastor), 409);
    await mongo.db(database).collection('branches').insertOne({ ...branchDocument, _id: new ObjectId(), name: 'Outside reporting scope', district: 'Different district' });
    const localReport = await expect(await youth('/reports'), 200);
    assert.deepEqual(localReport.map(row => row.branchId), [String(branch)]);
    assert.equal(localReport[0].closed, 2);
    assert.equal(localReport[0].checkIns, 2);
    assert.equal(localReport[0].serviceSignups, 1);
    const districtReport = await expect(await youth('/reports', 'GET', undefined, district), 200);
    assert.deepEqual(new Set(districtReport.map(row => row.branchId)), new Set([String(branch), String(otherBranch)]));
    await expect(await youth('/reports', 'GET', undefined, youthLeader.token), 403);
    assert.equal((await expect(await youth(campPath + '?branch=' + branch + '&date=' + tomorrow), 200)).present.length, 0);
    const payment = { requestId: '11111111-1111-4111-8111-111111111111', kind: 'payment', amount: 2000, revision: 0 };
    await expect(await youth(ownPersonPath + '/ledger', 'POST', payment, youthPastor.token), 403);
    await expect(await youth(ownPersonPath + '/ledger', 'POST', payment), 201);
    await expect(await youth(ownPersonPath + '/ledger', 'POST', payment), 201);
    await expect(await youth(ownPersonPath + '/ledger', 'POST', { ...payment, requestId: '22222222-2222-4222-8222-222222222222', kind: 'scholarship', amount: 4000, revision: 1 }), 400);
    await expect(await youth(ownPersonPath + '/ledger', 'POST', { ...payment, requestId: '22222222-2222-4222-8222-222222222222', kind: 'scholarship', amount: 1000, revision: 1 }), 201);
    const paid = (await expect(await youth(campPath + '?branch=' + branch), 200)).people[0];
    assert.equal(paid.campPaid, 2000);
    assert.equal(paid.campScholarship, 1000);
    assert.equal(paid.campLedger.length, 2);
    assert.equal((await expect(await youth(campPath + '?branch=' + branch, 'GET', undefined, youthPastor.token), 200)).people[0].campLedger, undefined);

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
    smtp.close();
    await Promise.all([database, tenantDb].map((name) => mongo.db(name).dropDatabase()));
    await mongo.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
