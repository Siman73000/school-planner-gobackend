# School Planner — UI/UX Upgrade (Vercel Go Functions + Vite)

Upgrades included:
- Points + auto-grades (prompt when completing a task)
- Click calendar tasks to view details modal

- Modern sidebar/topbar layout
- Dark mode (persisted)
- Task modal create/edit, tags, estimates, search + filters + sorting
- Calendar month view with day detail panel
- Grades tracker (overall + by course)
- Offline-friendly local cache + retry sync

## Required Vercel Env Vars
Map your Vercel KV values to the names the Go API reads:

- `UPSTASH_REDIS_REST_URL`  = `KV_REST_API_URL`
- `UPSTASH_REDIS_REST_TOKEN` = `KV_REST_API_TOKEN` (NOT the read-only one)

Optional:
- `PLANNER_API_KEY`

## Local dev
Use `vercel dev` so `/api` runs locally:
```bash
npm i
npm i -g vercel
vercel dev
```

## Routes
- `GET /api/health`
- `GET /api/state`
- `PUT /api/state`
