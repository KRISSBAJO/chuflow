# Workspace isolation

Each organization has its own MongoDB database. The workspace gateway pilot serves several organizations from one API deployment and keeps each organization in a separate, database-bound worker. The existing hierarchy, global admin role, public form links, and jobs operate within that database. An organization can contain several national churches.

## First workspace

Keep the existing Winners Chapel database URI, signing key, public API host, and web URL. The API defaults to `winners-chapel-international`. Before registering its models, the first startup inserts a workspace binding in the existing database. This operation is repeatable and requires a normal database backup before rollout. Existing sessions without a workspace claim are accepted only by this first workspace and only until they expire.

## Pilot workspace

1. Provision a dedicated, empty MongoDB database and grant its API credentials access only to that database.
2. Add its ID, name, database connection and separate signing key to the private gateway registry.
3. Test the scoped API and its separate session cookie through the shared API hostname.
4. Verify sign-in, public forms, exports, reports, and background jobs in a test workspace before onboarding. The startup check refuses a database already bound to another workspace and refuses to adopt existing data for any workspace other than Winners Chapel.

## Web sign-in directory

The sign-in page shows the current organization and links to `/workspaces`. The first deployment defaults to Winners Chapel International. Set `NEXT_PUBLIC_CHUFLOW_WORKSPACE_NAME` when building a different workspace frontend. To list provisioned organizations, set `NEXT_PUBLIC_CHUFLOW_WORKSPACES` to a JSON array such as `[{"name":"Pilot Church","origin":"https://pilot.example.com"}]` in the web build environment. Add only operator-approved origins. Each choice opens that organization's own sign-in page. The directory is public, so its configuration should contain only names and web origins.

Workspace requests still require manual provisioning. Self-service provisioning is a separate rollout step.


## Shared sign-in pilot

The optional workspace handoff API is disabled until keys are configured. Use a dedicated RSA key pair for the workspace directory. Set the base64-encoded private PEM as `WORKSPACE_DIRECTORY_SIGNING_KEY` only on the trusted directory deployment. Configure only the matching base64-encoded public PEM as `WORKSPACE_DIRECTORY_VERIFICATION_KEY` on participating workspace APIs. Each API keeps its separate session signing key.

An operator can add an explicit link in the directory's `workspace_memberships` collection. The document contains string fields `_id` (source user ID plus a colon plus target workspace ID), `accountId` (source user ID), `workspaceId`, `workspaceName`, `targetUserId` (an existing account ID in the target workspace), and boolean `enabled`. Confirm control of both accounts before linking. Identical emails are insufficient. Restrict write access to this collection to trusted operators. Disabling the link stops new handoffs. Deactivate the target account if its existing sessions must also stop.

Clients can list authorized workspaces through `GET /auth/workspaces`, request a handoff through `POST /auth/workspaces/:workspaceId/handoff` on the directory API, and redeem it once through `POST /auth/workspace/exchange` on the selected workspace API. Both POST endpoints require JSON. The client must use an operator-configured workspace endpoint and keep handoffs out of query strings, storage, and logs. The target determines the user's actual permissions. Invitation management still requires an operator.

For shared web sign-in, include the workspace ID alongside its name and origin in the directory's `NEXT_PUBLIC_CHUFLOW_WORKSPACES`. On each receiving web deployment set `NEXT_PUBLIC_CHUFLOW_DIRECTORY_ORIGIN` to the exact HTTPS origin of the trusted directory. The browser posts handoffs to the destination web host, which checks the request origin before exchanging them. Configure each workspace's web and API cookie scope so it does not overlap any other workspace.

For mobile, configure `EXPO_PUBLIC_CHUFLOW_WORKSPACES` as an array of objects with `id`, `apiOrigin` and `webOrigin` using the operator-approved HTTPS origins. The primary mobile API is the workspace directory. After a switch, requests and offline attendance are scoped to the selected workspace. The original outbox is retained under its existing key for the primary workspace.

## Shared API gateway pilot

Run `node scripts/workspace-gateway.cjs` from `apps/api` after building the API. Keep the primary deployment variables as they are, and supply `CHUFLOW_WORKSPACE_REGISTRY` as a secret JSON array. Each entry has `id`, `name`, `mongodbUri`, `jwtSecret`, `adminEmail`, and `adminPassword`. The gateway requires a distinct database on the same cluster and a distinct session key for each workspace.

The unprefixed `/api` routes keep their current Winners Chapel behavior. Requests for Test Church use `/api/w/test-church/…` on the same hostname. Unknown workspace IDs return 404, and every selected worker validates its own sessions. The gateway starts workers on demand and is a pilot for a small workspace count. Capacity limits and scheduling for background jobs must be addressed before onboarding broadly.

The gateway and its explicit registry are local pilot infrastructure. The production start command is unchanged. Linking the shared web and mobile UI to these scoped routes, an administrator provisioning workflow, and a hosted pilot are still pending.
