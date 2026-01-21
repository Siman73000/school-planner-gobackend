# School Planner (Vercel Option B: Go Functions + Vite)

This repo is built to deploy on **Vercel**:
- Frontend: **Vite + React + Tailwind** (static)
- Backend: **Go Vercel Functions** in `/api` (serverless)
- Persistence: **Upstash Redis REST** (stores a single JSON blob under key `app_state`)

## Why not SQLite?
Vercel Functions are serverless and don't provide a persistent writable filesystem. Use an external store instead.

## Required environment variables (Vercel Project → Settings → Environment Variables)
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Optional:
- `PLANNER_API_KEY` (if set, requests must include header `X-API-Key: <value>`)

## Endpoints
- `GET /api/health`
- `GET /api/state`
- `PUT /api/state`

## Local development
### Best: `vercel dev` (runs both static + /api functions)
```bash
npm i
npm i -g vercel
vercel dev
```
Open http://localhost:3000

### Frontend only (no API)
```bash
npm i
npm run dev
```

## Notes
- State is saved as JSON and returned verbatim for simplicity.
- If you want multi-user accounts, schedules, calendar export, etc., we can extend the API and storage model.
