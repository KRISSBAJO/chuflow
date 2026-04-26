# ChuFlow

Monorepo for the ChuFlow church operations platform with:

- `apps/api`: NestJS API with JWT cookie auth, Swagger, MongoDB, and MVP ministry modules
- `apps/web`: Next.js admin/public web app
- `packages/types`: shared domain enums and interfaces

## Quick start

1. Copy the env examples:
   - `apps/api/.env.example` to `apps/api/.env`
   - `apps/web/.env.example` to `apps/web/.env.local`
2. Install dependencies:
   - `npm install`
3. Start MongoDB locally or point `MONGODB_URI` to Atlas
   - quickest local option in this repo: `npm run db:up`
4. Start Mailpit for local password-reset email testing:
   - SMTP: `127.0.0.1:1025`
   - Inbox UI: `http://localhost:8025`
5. Run:
   - `npm run dev:api`
   - `npm run dev:web`

## Windows development

If this checkout lives in `C:\Users\...`, use Windows for installs and development and do not alternate between Windows and WSL in the same checkout. Native packages like Next/Tailwind CSS binaries can break when `node_modules` is reused across both environments.

Helpful commands:

- Start local MongoDB in Docker: `npm run db:up`
- Stop local MongoDB in Docker: `npm run db:down`
- Start both servers: `npm run dev:windows`
- Repair the repo if native dependencies get mixed up: `npm run repair:windows`

You should not need to run the repair command every day. It is mainly for when a mixed install or broken native binary causes startup failures.

## Mailpit local email

The API is configured to work well with Mailpit in local development.

- Set `MAIL_HOST=127.0.0.1`
- Set `MAIL_PORT=1025`
- Leave `MAIL_USER` and `MAIL_PASS` empty unless your SMTP server requires them
- Open Mailpit inbox at `http://localhost:8025`

If SMTP is unavailable, forgot-password falls back to preview-link mode.

## Default seeded super admin

- Email: `admin@church.local`
- Password: `ChangeMe123!`

Change these with env vars before production.

## Production deployment

See [DEPLOYMENT.md](/mnt/c/Users/kriss/cmp-be/DEPLOYMENT.md) for the Render + Amplify + Atlas setup, custom-domain cookie requirements, and the production reseed command.
