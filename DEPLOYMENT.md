# Deploy ClassManager on Vercel

This repo is ready to deploy as one Vercel project:

- Frontend: Vite builds to `public/`.
- Backend: Express runs as a Vercel Serverless Function through `api/index.js`.
- API calls use same-origin `/api`, so no separate backend domain is needed.

## 1. Prepare the database

Run the database files in Supabase/PostgreSQL before the first deploy:

1. `database/schema.sql`
2. `database/seed.sql`
3. Every file in `database/migrations/` that applies to your current database

Use the Supabase pooler connection string for `DATABASE_URL` when deploying to Vercel.

## 2. Vercel settings

When importing the Git repo into Vercel:

- Framework Preset: `Other`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `public`

These values are also supported by `vercel.json`.

## 3. Environment variables

Add these in Vercel Project Settings -> Environment Variables for Production:

```env
NODE_ENV=production
DATABASE_URL=postgresql://postgres.YOUR_PROJECT:YOUR_PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
DATABASE_SSL=true
DATABASE_POOL_MAX=1
DATABASE_IDLE_TIMEOUT_MS=30000
DATABASE_CONNECTION_TIMEOUT_MS=5000
DATABASE_STATEMENT_TIMEOUT_MS=15000
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=1d
REFRESH_TOKEN_EXPIRES_DAYS=7
EXPOSE_RESET_TOKEN=false
GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
VITE_API_URL=/api
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
```

For Google login, also add your Vercel domain to the Google OAuth client:

- Authorized JavaScript origins: `https://your-project.vercel.app`

## 4. Verify after deploy

You can deploy from the terminal after setting the environment variables in Vercel:

```bash
npm run deploy
```

The first run may ask you to log in to Vercel and link the project.

Open:

```text
https://your-project.vercel.app/api/health
```

Expected result:

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

Then open the app root and sign in with the seeded admin account if your seed data is present.
