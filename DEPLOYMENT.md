# Production Deployment

This app is designed to run with:

- `apps/api` on Render
- `apps/web` on AWS Amplify Hosting
- MongoDB Atlas for the production database

## Important auth requirement

This app uses an HTTP-only auth cookie and server-rendered pages.

For production login to work correctly, the frontend and backend should use
custom subdomains under the same parent domain, for example:

- `https://app.yourchurch.org` for Amplify
- `https://api.yourchurch.org` for Render

Do not rely on mixed vendor domains like:

- `*.amplifyapp.com`
- `*.onrender.com`

That setup breaks shared cookie-based SSR authentication across the frontend
and backend.

## Backend on Render

The repo includes [render.yaml](/mnt/c/Users/kriss/cmp-be/render.yaml).

Recommended Render service settings:

- Service type: `Web Service`
- Runtime: `Node`
- Root directory: `apps/api`
- Build command: `npm install && npm run build`
- Start command: `npm run start:prod`
- Health check path: `/api/health`

### Render environment variables

Set these in Render:

```env
APP_NAME=ChuFlow
PORT=10000
MONGODB_URI=<your-atlas-connection-string>
JWT_SECRET=<long-random-secret>
JWT_EXPIRES_IN=1d
WEB_URL=https://app.yourchurch.org
CORS_ALLOWED_ORIGINS=https://app.yourchurch.org
AUTH_COOKIE_NAME=cms_access_token
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
COOKIE_DOMAIN=.yourchurch.org
ADMIN_EMAIL=<your-super-admin-email>
ADMIN_PASSWORD=<your-super-admin-password>
MAIL_HOST=<optional>
MAIL_PORT=<optional>
MAIL_SECURE=<optional>
MAIL_USER=<optional>
MAIL_PASS=<optional>
MAIL_FROM=<optional>
```

## Frontend on AWS Amplify

The repo includes [amplify.yml](/mnt/c/Users/kriss/cmp-be/amplify.yml).

Use the monorepo app root:

- `apps/web`

### Amplify environment variables

Set these in Amplify:

```env
AMPLIFY_MONOREPO_APP_ROOT=apps/web
NEXT_PUBLIC_API_URL=https://api.yourchurch.org/api
```

## MongoDB Atlas

Use the Atlas connection string as the value for:

```env
MONGODB_URI=<your-atlas-connection-string>
```

Make sure Atlas network access allows the Render backend to connect.

## Seed data

The app already seeds key defaults on startup when records are missing:

- super admin
- oversight regions
- districts
- intake templates
- default finance setup

You can also rerun the seed refresh safely with:

```bash
npm run reseed:api
```

Or inside the Render service environment after a build:

```bash
npm run reseed --workspace api
```

The reseed command is idempotent and is intended for:

- first production setup
- refreshing missing defaults
- reapplying seeded templates and finance defaults

## Recommended go-live order

1. Provision MongoDB Atlas.
2. Set the Render environment variables.
3. Deploy the backend to Render.
4. Point `api.yourchurch.org` to Render.
5. Set the Amplify environment variables.
6. Deploy the frontend to Amplify.
7. Point `app.yourchurch.org` to Amplify.
8. Run the reseed command once against production.
9. Log in with the configured super admin.
10. Verify:
   - login
   - users
   - branches
   - templates
   - attendance
   - finance

## Local production-style test

Before go-live, test the production env locally with:

```bash
cd /mnt/c/Users/kriss/cmp-be
npm install
npm run build --workspace api
npm run build --workspace web
```

Then set production-like env values in:

- `apps/api/.env`
- `apps/web/.env.local`

and run:

```bash
npm run dev:api
npm run dev:web
```
