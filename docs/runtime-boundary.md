# MVP API/runtime boundary

**Decision (issue #7):** Next.js App Router is the single API runtime for the Luminate MVP. The Python FastAPI backend under `/backend` is **frozen** as legacy/reference code.

## Why

- The repo carries two near-duplicate API surfaces (Next.js routes under `src/app/api/*` and FastAPI under `backend/app/api/v1/*`). Two implementations + two ORMs (Drizzle + SQLAlchemy) over the same SQLite file is a drift hazard for an MVP shipping with one author.
- The browser features that block the MVP — durable recording upload, slide rendering, ffmpeg.wasm export, YouTube upload — are already wired through Next.js routes. None of them currently route through FastAPI.
- A single runtime keeps deploy, env, schema, and migrations boring (one Drizzle migration set, one `npm run dev`, one `.env`).

## What this means

- ✅ All new MVP work (sources, claims, outline, recording persistence, readiness, export) lands in `src/app/api/*` and `src/lib/db/*`.
- ✅ Runtime provisioning in `createTables()` and the Drizzle schema/migrations are kept in parity (see `docs/db.md`). SQLAlchemy models in `backend/app/models/*` are out of date by design.
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

## LLM generation (issue #60)

Research, content, and script generation run in Next.js without a Python service.
The server reads the selected provider, its saved API key, and model from SQLite:
Anthropic uses its SDK, OpenAI uses the Responses API, and Google uses Gemini
streaming. The routes validate inputs and preserve the `text` / `done` / `error`
SSE contract. Disconnects cancel the upstream request; a 120-second deadline
bounds ordinary generation. Provider failures and incomplete responses emit an
error instead of marking partial text complete.

With web research disabled, research uses the same selected provider. Grounded
web research and the existing SEO, clips, and agent features remain Anthropic
features and require an Anthropic key. Claude Code CLI generation is unsupported;
the settings option is disabled and legacy saved CLI selections receive an
explicit configuration error rather than silently using a different provider.

Anthropic key verification calls Anthropic directly and does not save the key.
Optional legacy settings synchronization can still use `BACKEND_URL`; set it
to an empty string for a standalone deployment. No core generation route uses the legacy
proxy module.

Protocol references: [OpenAI Responses](https://developers.openai.com/api/reference/typescript/resources/responses/methods/create)
and [Gemini streaming content](https://ai.google.dev/api/generate-content#method:-models.streamgeneratecontent).

Offline regression tests exercise all three provider transports, saved model/key
selection, validation, errors, stream framing, and disconnect cancellation in
`src/__tests__/api/llm-generation.test.ts`. Live provider calls require valid
account credentials and are not part of the deterministic test suite.
