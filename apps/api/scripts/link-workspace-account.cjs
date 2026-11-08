const { MongoClient } = require('mongoose').mongo;
const { loadRegistry } = require('./workspace-gateway.cjs');

class LinkError extends Error {}

async function findActiveUser(db, email) {
  const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = await db.collection('users')
    .find({ email: { $regex: '^' + escaped + '$', $options: 'i' } })
    .project({ isActive: 1 }).limit(2).toArray();
  if (matches.length !== 1 || matches[0].isActive !== true) {
    throw new LinkError('Expected one active account for each email.');
  }
  return String(matches[0]._id);
}

async function main([workspaceId, sourceEmail, targetEmail]) {
  if (!sourceEmail?.includes('@') || !targetEmail?.includes('@')) {
    throw new LinkError('Supply a workspace ID and both account emails.');
  }
  const entry = (await loadRegistry(process.env)).get(workspaceId);
  if (!entry) throw new LinkError('The destination is outside the gateway registry.');
  const options = { serverSelectionTimeoutMS: 8000 };
  const source = new MongoClient(process.env.MONGODB_URI, options);
  const target = entry.databaseName ? source : new MongoClient(entry.mongodbUri, options);
  try {
    const sourceDb = source.db();
    const targetDb = target.db(entry.databaseName);
    for (const [db, id] of [[sourceDb, 'winners-chapel-international'], [targetDb, workspaceId]]) {
      const binding = await db.collection('workspace_bindings').findOne({ _id: 'workspace' });
      if (binding?.workspaceId !== id) throw new LinkError('A workspace database binding did not match.');
    }
    const accountId = await findActiveUser(sourceDb, sourceEmail.trim());
    const targetUserId = await findActiveUser(targetDb, targetEmail.trim());
    const memberships = sourceDb.collection('workspace_memberships');
    const _id = accountId + ':' + workspaceId;
    await memberships.updateOne(
      { _id, accountId, workspaceId, targetUserId, enabled: true },
      { $setOnInsert: { workspaceName: entry.name } },
      { upsert: true },
    );
    console.log('Workspace membership verified.');
  } finally {
    await source.close();
    if (target !== source) await target.close();
  }
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof LinkError ? error.message : 'Workspace link failed.');
  process.exitCode = 1;
});
