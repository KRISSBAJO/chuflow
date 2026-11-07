# Workspace isolation

Each organization has its own API deployment and MongoDB database. The existing hierarchy, global admin role, public form links, and scheduled jobs operate within that database. An organization can contain several national churches.

## First workspace

Keep the existing Winners Chapel database URI, signing key, public API host, and web URL. The API defaults to `winners-chapel-international`. Before registering its models, the first startup inserts a workspace binding in the existing database. This operation is repeatable and requires a normal database backup before rollout. Existing sessions without a workspace claim are accepted only by this first workspace and only until they expire.

## Pilot workspace

1. Provision a dedicated, empty MongoDB database and grant its API credentials access only to that database.
2. Create a dedicated API deployment with a unique `WORKSPACE_ID`, its `WORKSPACE_NAME`, and its own strong JWT signing key and administrator credentials.
3. Use workspace-specific API and web hosts. Configure the login cookie and CORS for that workspace's hosts. Set the frontend API and web URLs for the same workspace.
4. Verify sign-in, public forms, exports, reports, and background jobs in a test workspace before onboarding. The startup check refuses a database already bound to another workspace and refuses to adopt existing data for any workspace other than Winners Chapel.

## Web sign-in directory

The sign-in page shows the current organization and links to `/workspaces`. The first deployment defaults to Winners Chapel International. Set `NEXT_PUBLIC_CHUFLOW_WORKSPACE_NAME` when building a different workspace frontend. To list provisioned organizations, set `NEXT_PUBLIC_CHUFLOW_WORKSPACES` to a JSON array such as `[{"name":"Pilot Church","origin":"https://pilot.example.com"}]` in the web build environment. Add only operator-approved origins. Each choice opens that organization's own sign-in page. The directory is public, so its configuration should contain only names and web origins.

Workspace requests still require manual provisioning. Mobile workspace selection and self-service provisioning are separate rollout steps.
