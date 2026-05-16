# MVP API/runtime boundary

**Decision (issue #7):** Next.js App Router is the single API runtime for the Luminate MVP. The Python FastAPI backend under `/backend` is **frozen** as legacy/reference code.

## Why

- The repo carries two near-duplicate API surfaces (Next.js routes under `src/app/api/*` and FastAPI under `backend/app/api/v1/*`). Two implementations + two ORMs (Drizzle + SQLAlchemy) over the same SQLite file is a drift hazard for an MVP shipping with one author.
- The browser features that block the MVP — durable recording upload, slide rendering, ffmpeg.wasm export, YouTube upload — are already wired through Next.js routes. None of them currently route through FastAPI.
- A single runtime keeps deploy, env, schema, and migrations boring (one Drizzle migration set, one `npm run dev`, one `.env`).

## What this means

- ✅ All new MVP work (sources, claims, outline, recording persistence, readiness, export) lands in `src/app/api/*` and `src/lib/db/*`.
- ✅ Drizzle (`drizzle/`) is the source of truth for the SQLite schema. SQLAlchemy models in `backend/app/models/*` are out of date by design.
- ❌ Do not add new endpoints to `backend/app/api/*` for MVP features.
- ❌ Do not edit SQLAlchemy models or Alembic migrations to track MVP schema changes.
- 🧊 The backend can still be run for prototyping multi-provider LLM streaming, but it is not part of the shipped MVP path.

## Re-enabling FastAPI

If a future issue revives FastAPI (e.g. for long-running server-side video encoding), the issue must:

1. Define which routes move to FastAPI.
2. Replace those routes in Next.js with proxies or remove them.
3. Re-sync `backend/app/models/*` with the current Drizzle schema.
4. Add an integration test that hits the live FastAPI path end-to-end.

Until that happens, `/backend` should be treated as read-only by all MVP issues.

## Tests covering the active API path

- `src/__tests__/api/*` — integration tests for Next.js route handlers
- `src/__tests__/stores/*` — Zustand stores that call those routes
- `src/__tests__/lib/db/*` — Drizzle schema/migration tests

No corresponding pytest suite is run as part of MVP CI.
