# Contributing to Luminate

Thanks for contributing! This guide covers setup, the quality gate, and a few load‑bearing conventions.

## Prerequisites & setup

- Node matching [`.nvmrc`](.nvmrc) (Node 22; `package.json` `engines` floor is ≥ 20.9). `nvm use` reads it.
- A system **`ffmpeg`** binary (video export + speech analysis spawn it).

```bash
npm install
npm run dev
curl http://localhost:3000/api/init   # first‑run DB init
```

## The quality gate

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs on every PR. **Keep these green:**

```bash
npx tsc --noEmit      # typecheck
npm run test:run      # vitest (coverage thresholds enforced via test:coverage in CI)
npm run build         # production build
```

`npm run lint` also runs in CI but is **non‑blocking** (`continue-on-error`): the repo carries a documented pre‑existing ESLint baseline, so lint is **informational, not a merge gate** (tracked in [#61](https://github.com/humanjack/luminate/issues/61) / [#119](https://github.com/humanjack/luminate/issues/119)). Don't add new lint errors, but don't let the existing baseline block you.

When you add code under `src/lib/**` or `src/stores/**`, keep coverage at or above the ratcheted thresholds in [`vitest.config.ts`](vitest.config.ts) — add tests rather than lowering the floor.

## Conventions

- **Runtime boundary.** All new MVP work lands in `src/app/api/*` and `src/lib/db/*`. **Do not** add endpoints to `/backend` or edit its SQLAlchemy models — it's frozen (see [`docs/runtime-boundary.md`](docs/runtime-boundary.md)).
- **Database.** `createTables()` in `src/lib/db/migrations.ts` is the runtime source of truth for the schema. On a schema change, edit `src/lib/db/schema.ts` **and** the `createTables` DDL, then run `npm run db:generate`.
- **Secrets.** Provider API keys live in the SQLite Settings store (entered via the Settings UI), not in env. Don't read keys from `process.env`; don't return raw secrets from an API route (`GET /api/settings` redacts them).
- **API responses.** Use the helpers in `src/lib/api/respond.ts` (`ok`/`fail`/`serverError`) and validate request bodies with `src/lib/api/validate.ts` (`readJson`/`parseJson`).

## Pull requests

- Branch off `main`, keep the change focused, and make sure the quality gate passes locally.
- Describe what changed and how you verified it. Link the issue it closes.
