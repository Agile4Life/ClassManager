# ClassManager Backend

Node.js/Express API for the tuition-center database in `database/schema.sql`. All table and column names follow the supplied PostgreSQL/Supabase schema.

## Setup

Requirements: Node.js 18+ and PostgreSQL or Supabase PostgreSQL.

1. Run `database/schema.sql`, then `database/seed.sql`.
2. Copy `.env.example` to `.env`; configure `DATABASE_URL` and a strong `JWT_SECRET`.
3. Install and run:

```bash
npm install
npm run dev
```

Check `GET http://localhost:3000/api/health`. Seed login: `admin` / `Admin@123`.

## Frontend

The React frontend lives in `frontend/` and uses Vite with Fluent UI.

```bash
cd frontend
npm install
npm run dev -- --configLoader runner
```

Run the backend in another terminal with `npm run dev`. Vite proxies `/api` to `http://localhost:3000`.

For a single-service production build:

```bash
npm run build:frontend
npm start
```

When `NODE_ENV=production`, Express serves `frontend/dist` and keeps all API routes under `/api`.

For local PostgreSQL without TLS, set `DATABASE_SSL=false`. `CORS_ORIGIN` accepts a comma-separated allowlist for cross-origin clients. Same-origin requests are accepted automatically; development also accepts loopback origins on any port.

## API conventions

Success responses use `{ "success": true, "message": "...", "data": ... }`. Errors use `{ "success": false, "message": "..." }`. Protected routes require `Authorization: Bearer <token>`.

Main route groups:

- Auth: `/api/auth`
- CRUD: `/api/students`, `/parents`, `/teachers`, `/subjects`, `/rooms`, `/classes`
- Timetable: `/api/timetable`, `/api/classes/:classId/schedules`, `/api/schedules/:scheduleId`
- Sessions/attendance: `/api/classes/:classId/sessions`, `/api/sessions/:sessionId/attendance`
- Assignments: `/api/topics`, `/api/assignments`, `/api/submissions`, `/api/answers`
- Reports: `/api/reports`
- Finance: `/api/invoices`, `/api/payments`

List CRUD endpoints support `page`, `limit` (maximum 100), `search`, and resource-specific filters.

## Password reset

Only reset-token hashes are stored. Reset tokens are never returned unless both `NODE_ENV` is not `production` and `EXPOSE_RESET_TOKEN=true` is explicitly configured. Connect an email service before deploying this flow.

## Verification

```bash
npm run check
npm test
npm run db:check
```

These commands check JavaScript syntax, run regression checks, and verify the configured database and required tables without modifying business data.
