# Platform control plane and subscriptions

The control plane is where ChuFlow's own operators run the platform: the tenant directory, operator accounts, the plan catalog, each workspace's subscription, and an audit trail of every operator action. It lives in its own database on the same cluster as the workspace databases and is served by the primary API under `/api/platform`. Church users never see it; operator accounts are separate from church accounts and have their own signing key.

## Settings

| Variable | Where | Purpose |
| --- | --- | --- |
| `CONTROL_DATABASE_NAME` | every API worker and the gateway | The control database, for example `chuflow_control`. Workers only read their own subscription from it. Unset, nothing is enforced and the API behaves as before. |
| `CONTROL_ENCRYPTION_KEY` | primary API and gateway | 32 random bytes, base64. Seals each provisioned workspace's signing secret and first admin password at rest. |
| `PLATFORM_ENABLED` | primary API only | Turns on the operator API. Elsewhere `/api/platform` answers 404. |
| `PLATFORM_JWT_SECRET` | primary API | Signs operator sessions (8 hours). Distinct from `JWT_SECRET`. |
| `PLATFORM_OWNER_EMAIL`, `PLATFORM_OWNER_PASSWORD` | primary API | Creates the first owner operator on startup if no operator with that email exists. |

Generate the key with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Operators

Roles: `owner` (everything, including other operators and archiving), `support` (provision, edit, suspend and reactivate workspaces), `billing` (plans, subscriptions, payments, suspend and reactivate), `read_only`. Sign in with `POST /api/platform/auth/login` as JSON; ten failed attempts from one address pause sign-in for fifteen minutes. Every change an operator makes is written to `operator_audit` with their email, the action, the workspace and the reason they gave.

## Workspaces

`POST /api/platform/workspaces` with `handle`, `name` and `adminEmail` provisions a church:

1. The handle is checked against the pattern, the reserved list and existing workspaces.
2. A signing secret and a first admin password are generated and sealed.
3. The database `chuflow_<handle>` is claimed with the same binding check the API runs at startup, so a database that already holds data is refused.
4. A trial subscription starts on the requested plan (default `trial`).
5. The record becomes `active` and the response carries the admin password once. It is not shown again.

The gateway reads the directory every 30 seconds. A new workspace is served at `/api/w/<handle>/…` on its first request, when the worker starts and seeds the admin from the sealed credentials. Suspending a workspace makes the gateway answer `402 workspace_suspended` before any worker runs; archiving removes it from the gateway and stops its worker. Both keep the data. The primary workspace is listed but managed by environment, so it cannot be suspended here.

With shared workspace routing enabled, send the admin the workspace's `/login?workspace=<handle>` link for web sign-in. On mobile, they enter the handle on the sign-in screen. The temporary password only grants access to account setup. Choosing a permanent password invalidates the temporary session. Recovery emails carry the same workspace handle and use the configured ChuFlow mail sender.

`GET /api/platform/workspaces/:id/usage` counts branches, active users, members, active children and guests straight from the workspace's database next to its quotas.

## Plans and subscriptions

The catalog is seeded with `trial`, `starter`, `growth` and `enterprise`; owners and billing operators edit it with `PUT /api/platform/plans/:id`. A plan carries feature keys (`guests`, `members`, `attendance`, `follow_up`, `care`, `meetings`, `kids`, `finance`, `communications`, `reporting`, `exports`, `api`), quotas (`branches`, `users`, `members`, `children`, `null` for unlimited), a monthly price and trial length.

A subscription is one record per workspace: plan, status (`trialing`, `active`, `past_due`, `suspended`, `cancelled`), billing mode (`manual` today), trial end, paid period end, grace days and optional per-workspace overrides for features and quotas. `PUT /api/platform/workspaces/:id/subscription` sets it; `POST /api/platform/workspaces/:id/payments` records a payment received outside the app, which extends the paid period and reactivates the workspace. A card processor later plugs into the same two calls from its webhooks.

### What the workspace experiences

The lifecycle is evaluated on every request from the stored dates, so nothing depends on a scheduled job:

| Situation | Status shown | Access |
| --- | --- | --- |
| In trial or within the paid period | `trialing` / `active` | full |
| Trial or period ended, within grace days | `past_due` | full, with the grace deadline in `/auth/me` |
| Grace passed | `delinquent` | read-only |
| Subscription `cancelled`, period still paid | `cancelled` | read-only |
| Subscription `cancelled` after the period, or `suspended` | `cancelled` / `suspended` | locked |

Read-only means sign-in, viewing and exports work and attendance already counted on phones still syncs, but any other change answers `402` with code `workspace_read_only`. Locked answers `402 workspace_locked` for everything except sign-in. A feature outside the plan answers `402 feature_locked` with the feature key, and creating a branch, user, member or child beyond its quota answers `402 quota_exceeded` with the quota and limit. Web and mobile read the same snapshot from `GET /auth/me` under `entitlements` to hide locked features and show upgrade prompts instead of errors.

Workers cache the snapshot for one minute and keep the last known answer if the control database is unreachable; a workspace with no subscription record is unrestricted. A billing outage can therefore never lock a church out.

## Operator scripts

`scripts/link-workspace-account.cjs` now finds workspaces provisioned through the control plane as well as those in `CHUFLOW_WORKSPACE_REGISTRY`. The environment registry keeps working for the pilot, and both sources are validated together: distinct databases on the cluster and distinct signing secrets.

## Not yet built

Card payments and dunning emails, usage metering of messages and storage, break-glass impersonation, custom domains, and per-tenant mail settings for gateway workers. The operator web console is under `/ops`.
