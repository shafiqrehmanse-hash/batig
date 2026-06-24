# BATIG v2 — Elite Dice Betting

## Setup (required for database)

### 1. Supabase (free database)
1. Go to [supabase.com](https://supabase.com) → New Project
2. Open **SQL Editor** → paste contents of `supabase/schema.sql` → **Run**
3. Go to **Settings → API** and copy:
   - Project URL → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Vercel environment variables
In Vercel → your project → **Settings → Environment Variables**, add:

| Name | Value |
|------|--------|
| `SUPABASE_URL` | your Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | your service role key |
| `JWT_SECRET` | any long random string |
| `CRON_SECRET` | optional random string |

Redeploy after adding variables.

### 3. Push to GitHub
```bash
git add .
git commit -m "BATIG v2 elite with database"
git push
```

## Animation libraries (already integrated via CDN)
- **GSAP** — premium UI transitions, dice roll, balance counter
- **canvas-confetti** — win celebration

No extra install needed. For even higher-end 3D dice later, we can add **Three.js**.

## Stack
- Frontend: HTML + CSS + GSAP
- API: Vercel Serverless (`/api/*`)
- Database: Supabase PostgreSQL
- Cron: Round resolution every minute
