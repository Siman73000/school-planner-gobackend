# School Planner (Vercel Option B: Go Functions + Vite) — FIXED

This version fixes the Vercel build error:

> use of internal package .../internal/... not allowed

Vercel's Go runtime wraps/relocates function code during build, which can break Go's `internal/` import rules.
So shared Go code is placed in a **non-internal root package**: `api_utils/`.

## Deploy on Vercel
Add env vars in Vercel Project → Settings → Environment Variables:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
Optional:
- `PLANNER_API_KEY`

## Routes
- `GET /api/health`
- `GET /api/state`
- `PUT /api/state`

## Local dev
Use `vercel dev` so `/api` runs locally:
```bash
npm i
npm i -g vercel
vercel dev
```
