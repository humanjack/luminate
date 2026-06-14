# Luminate

Luminate turns a topic into a finished, narrated YouTube video through a linear 7‑step workflow:

**Research → Content → Slides → Script → Recording → Analysis → Video**

An LLM drafts grounded research, shapes it into a Slidev presentation, splits it into slides, writes a conversational script per slide; you record narration in the browser; an external speech provider scores delivery; and FFmpeg combines slides + audio into an MP4 (with optional YouTube upload).

## Tech stack

- **Next.js 16 (App Router) + React 19** — the canonical API/runtime for the MVP.
- **SQLite via better‑sqlite3 + Drizzle ORM** — single local database file (`luminate.db`).
- **Zustand** — client state (project data, workflow step, settings).
- **Tailwind + Radix/shadcn UI**.
- **`@anthropic-ai/sdk`** — direct, streaming LLM calls for several steps.

A Python **FastAPI** backend exists under [`/backend`](backend) but is **frozen/legacy** — see [Runtime boundary](#runtime-boundary).

## Quickstart

Prerequisites: Node matching [`.nvmrc`](.nvmrc) (Node 22; `engines` floor is ≥ 20.9), plus a system **`ffmpeg`** binary for video export and speech analysis.

```bash
nvm use            # or install Node 22
npm install
npm run dev        # http://localhost:3000 (Turbopack)
```

Then initialize the database once:

```bash
curl http://localhost:3000/api/init
```

### Where API keys go

API keys (Anthropic, OpenAI, Google, Azure Speech, SpeechSuper, ELSA, Tavily, Brave) are entered in the **Settings page**, persisted to the local SQLite database — **not** read from the environment. The **only** value read from the environment is `BACKEND_URL` (see [`.env.example`](.env.example)). `GET /api/settings` redacts stored secrets before returning them to the browser.

> ⚠️ Treat `luminate.db` as sensitive — it holds your provider keys and all project data. It is git‑ignored by default; never commit or host it publicly.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | ESLint (informational — see [CONTRIBUTING](CONTRIBUTING.md)) |
| `npm run test` | Vitest (watch) |
| `npm run test:run` | Vitest (run once) |
| `npm run test:coverage` | Vitest with coverage (ratcheted thresholds) |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Run Drizzle migrations |
| `npm run db:studio` | Drizzle Studio GUI |

A `Makefile` mirrors the common targets (`make dev`, `make build`, `make test`, `make migrate`, …).

## Runtime boundary

Next.js App Router is the single API runtime for the MVP; `/backend` is frozen reference code. One caveat: the **Content** and **Script** generation steps still proxy to the FastAPI backend (default `http://localhost:8000`) — if it isn't running, those two steps fail. See [`docs/runtime-boundary.md`](docs/runtime-boundary.md) and [#60](https://github.com/humanjack/luminate/issues/60). Set `BACKEND_URL=""` to disable backend sync entirely.

## Deployment notes

- `better-sqlite3` is a native addon and the app writes to the local filesystem (`luminate.db`, `public/recordings`, `public/exports`) and shells out to `ffmpeg` — so a drop‑in serverless deploy is **not** supported. Run it as a long‑lived Node server (or container) with a persistent volume.
- Health/readiness probes: `GET /api/health` (liveness) and `GET /api/ready` (DB check).

## More

- [CONTRIBUTING.md](CONTRIBUTING.md) — setup, the quality gate, conventions.
- [SECURITY.md](SECURITY.md) — vulnerability reporting and secrets handling.
- [CLAUDE.md](CLAUDE.md) — architecture notes (agent‑facing).
