# School Planner (Vercel Option B: Go Functions + Vite)

This version is built for **Vercel**:
- Frontend: **Vite + React + Tailwind** (static)
- Backend: **Go Vercel Functions** in `/api` (no always-on server)
- Persistence: **Upstash Redis REST** (single JSON blob)

## Why not SQLite?
Vercel Functions are serverless and don't support a persistent local filesystem for SQLite writes.
Use an external store instead (Upstash in this repo).

## Deploy on Vercel (production)
1) Create an Upstash Redis database (free tier is fine).
2) In Upstash Console, copy:
   - `UPSTASH_REDIS_REST_URL` (HTTPS endpoint)
   - `UPSTASH_REDIS_REST_TOKEN` (standard token)
3) In Vercel Project → Settings → Environment Variables, add:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   Optional:
   - `PLANNER_API_KEY` (if set, frontend must send `X-API-Key`)
4) Deploy.

## Local dev
### Option 1: Vercel dev (recommended)
```bash
npm i
npm run build
npm i -g vercel
vercel dev
```
Open http://localhost:3000

### Option 2: Frontend only (no API)
```bash
npm i
npm run dev
```
Saving won't work unless you also run functions via `vercel dev`.

## API
- `GET /api/health`
- `GET /api/state`
- `PUT /api/state`

Data is stored in Redis under key `app_state`.
