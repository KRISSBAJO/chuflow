/* Run after the API build, using a disposable local replica set only. */
const assert = require('node:assert/strict');
require('reflect-metadata');
const mongoose = require('mongoose');
const {
  PermissionsService,
} = require('../dist/permissions/permissions.service');
const { UserSchema } = require('../dist/users/schemas/user.schema');
const {
  PermissionDelegationSchema,
} = require('../dist/permissions/permission.schema');
const uri = process.env.PERMISSION_TEST_MONGO;
if (!uri)
  throw Error('Set PERMISSION_TEST_MONGO to a disposable local replica set.');
const parsed = new URL(uri);
if (
  !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
  !parsed.pathname.startsWith('/chuflow_permissions_qa_')
)
  throw Error('This test refuses non-local or non-QA databases.');
async function run() {
  await mongoose.connect(uri);
  const users = mongoose.model('User', UserSchema);
  const grants = mongoose.model(
    'PermissionDelegation',
    PermissionDelegationSchema,
  );
  await Promise.all([users.init(), grants.init()]);
  const branch = new mongoose.Types.ObjectId(),
    other = new mongoose.Types.ObjectId();
  const [manager, recipient, outsider] = await users.create([
    {
      firstName: 'Test',
      lastName: 'Manager',
      email: 'manager@example.com',
      password: 'not-a-real-login',
      role: 'resident_pastor',
      branchId: branch,
    },
    {
      firstName: 'Test',
      lastName: 'Recipient',
      email: 'recipient@example.com',
      password: 'not-a-real-login',
      role: 'follow_up',
      branchId: branch,
    },
    {
      firstName: 'Outside',
      lastName: 'Station',
      email: 'outside@example.com',
      password: 'not-a-real-login',
      role: 'follow_up',
      branchId: other,
    },
  ]);
  let expanded = false;
  const scopes = {
    getAccessibleBranchIds: async (user) =>
      user.role === 'super_admin'
        ? null
        : expanded && user.sub === String(recipient._id)
          ? [String(branch), String(other)]
          : [String(user.branchId)],
  };
  const service = new PermissionsService(users, grants, scopes);
  const actor = {
    sub: String(manager._id),
    email: manager.email,
    role: manager.role,
    branchId: String(branch),
  };
  const input = {
    recipientId: String(recipient._id),
    permissions: ['members.view'],
    reason: 'Temporary register assistance',
    expectedRevision: 0,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };
  await service.grant(actor, input);
  assert.deepEqual(
    (await service.resolve(await users.findById(recipient._id).lean()))
      .additionalPermissions,
    ['members.view'],
  );
  const ledger = await service.list(actor, { limit: 100 });
  assert.equal(ledger.total, 1);
  assert.equal(ledger.items[0].recipient.email, 'recipient@example.com');
  assert.equal(ledger.items[0].recipient.password, undefined);
  assert.equal(ledger.items[0].status, 'active');
  assert.equal(
    (await service.list(actor, { search: 'recipient@example.com' })).total,
    1,
  );
  assert.equal(
    (await service.list(actor, { search: 'Test Recipient' })).total,
    1,
  );
  assert.equal((await service.list(actor, { search: '[' })).total, 0);
  await assert.rejects(
    service.grant(actor, { ...input, recipientId: String(outsider._id) }),
    /outside your management scope/,
  );
  const outcomes = await Promise.allSettled([
    service.grant(actor, {
      ...input,
      permissions: ['members.edit'],
      expectedRevision: 1,
    }),
    service.grant(actor, {
      ...input,
      permissions: ['members.create'],
      expectedRevision: 1,
    }),
  ]);
  assert.equal(
    outcomes.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  assert.equal(
    outcomes.filter((result) => result.status === 'rejected').length,
    1,
  );
  assert.equal((await users.findById(recipient._id)).permissionRevision, 2);
  const oldCreate = grants.create;
  grants.create = () => Promise.reject(Error('Simulated write failure'));
  await assert.rejects(
    service.grant(actor, { ...input, expectedRevision: 2 }),
    /Simulated write failure/,
  );
  grants.create = oldCreate;
  assert.equal((await users.findById(recipient._id)).permissionRevision, 2);
  assert.equal(
    await grants.countDocuments({
      permission: 'members.view',
      status: 'active',
    }),
    1,
  );
  await service.grant(actor, { ...input, expectedRevision: 2 });
  assert.equal(await grants.countDocuments({ permission: 'members.view' }), 2);
  assert.equal(
    await grants.countDocuments({
      permission: 'members.view',
      status: 'revoked',
    }),
    1,
  );
  const current = await grants.findOne({
    permission: 'members.view',
    status: 'active',
  });
  await grants.updateOne(
    { _id: current._id },
    { $set: { expiresAt: new Date(Date.now() - 1000) } },
  );
  assert.equal((await service.list(actor, { status: 'expired' })).total, 1);
  const detail = await service.detail(actor, String(recipient._id));
  assert.equal(detail.revision, 3);
  await service.revoke(actor, String(current._id), {
    expectedRevision: 3,
    reason: 'Temporary duty ended',
  });
  assert.equal((await grants.findById(current._id)).revokedByName, actor.email);
  expanded = true;
  const paused = await service.resolve(
    await users.findById(recipient._id).lean(),
  );
  assert.deepEqual(paused.additionalPermissions, []);
  assert.ok(
    (await service.list(actor, {})).items.some(
      (row) => row.status === 'needs_review',
    ),
  );
  expanded = false;
  await service.revokeAll(actor, String(recipient._id), {
    expectedRevision: 4,
    reason: 'End all temporary duties',
  });
  assert.deepEqual(
    (await service.resolve(await users.findById(recipient._id).lean()))
      .additionalPermissions,
    [],
  );
  const history = await service.list(actor, { status: 'revoked' });
  assert.equal(history.total, 3);
  assert.equal(await grants.countDocuments(), 3);
  assert.equal((await service.targets(actor, 'Test Recipient')).total, 1);
  const ownTargets = await service.targets(actor, 'recipient');
  assert.equal(ownTargets.total, 1);
  assert.equal((await service.targets(actor, 'outside')).total, 0);
  console.log(
    'PASS: local MongoDB grants, scoped aggregation, search, concurrent updates, transactional rollback, renewal history, expiry, review and bulk revocation.',
  );
}
run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState === 1)
      await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
