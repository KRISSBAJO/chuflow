import type { ConfigService } from '@nestjs/config';
import type { Connection } from 'mongoose';

export const FIRST_WORKSPACE_ID = 'winners-chapel-international';
export const FIRST_WORKSPACE_NAME = 'Winners Chapel International';

export function getWorkspace(config: ConfigService) {
  const id = config.get<string>('workspaceId') ?? FIRST_WORKSPACE_ID;
  const name = config.get<string>('workspaceName') ?? FIRST_WORKSPACE_NAME;
  return { id, name };
}

/**
 * A link into the web app that lands in this workspace. The primary workspace keeps its plain
 * links; a provisioned workspace adds `workspace=<handle>` so sign-in and recovery pages talk
 * to its own API and session.
 */
export function workspaceWebLink(
  config: ConfigService,
  path: string,
  params: Record<string, string> = {},
) {
  const webUrl = (
    config.get<string>('webUrl') ?? 'http://localhost:3001'
  ).replace(/\/$/, '');
  const { id } = getWorkspace(config);
  const search = new URLSearchParams(
    id === FIRST_WORKSPACE_ID ? params : { workspace: id, ...params },
  );
  const query = search.toString();
  return `${webUrl}${path}${query ? `?${query}` : ''}`;
}

type WorkspaceBinding = { _id: 'workspace'; workspaceId: string };

/** Verify ownership before Nest registers models or starts application jobs. */
export async function bindWorkspaceDatabase(
  connection: Connection,
  workspaceId: string,
): Promise<Connection> {
  const db = connection.db;
  if (!db) throw new Error('The workspace database connection is unavailable.');

  const bindings = db.collection<WorkspaceBinding>('workspace_bindings');
  let binding = await bindings.findOne({ _id: 'workspace' });
  if (!binding) {
    // The first workspace adopts the existing deployment. A new workspace
    // must start empty so a mistyped URI cannot adopt existing church data.
    if (workspaceId !== FIRST_WORKSPACE_ID) {
      const collections = await db
        .listCollections({}, { nameOnly: true })
        .toArray();
      if (collections.some(({ name }) => name !== bindings.collectionName)) {
        throw new Error(
          'A new workspace requires an empty database or an existing workspace binding.',
        );
      }
    }
    binding = await bindings.findOneAndUpdate(
      { _id: 'workspace' },
      { $setOnInsert: { workspaceId } },
      { upsert: true, returnDocument: 'after' },
    );
  }

  if (binding?.workspaceId !== workspaceId) {
    throw new Error('This database is bound to a different workspace.');
  }
  return connection;
}
