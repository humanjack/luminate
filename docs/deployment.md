# Deploying Luminate

Next.js is the application runtime. Docker packages Node 22, the native SQLite
addon, FFmpeg and its drawtext font. Provider keys are configured and saved in
Settings; they are not baked into the image. See [runtime boundary](runtime-boundary.md).

## Docker

```sh
docker compose up --build -d
curl --fail http://localhost:3000/api/init
curl --fail http://localhost:3000/api/ready
```

Open http://localhost:3000. The named `luminate-data` volume contains
`luminate.db`, its WAL sidecars, and `media/recordings` / `media/exports`.
`docker compose down` preserves it; **`down --volumes` deletes it**.
New media is served by range-capable `/recordings/*` and `/exports/*` handlers,
so playback and downloads continue after container recreation.

The runner uses the unprivileged `node` user (UID 1000). A named volume inherits
its writable ownership. For a bind mount, create a directory writable by UID 1000
before mounting it at `/data`; the container does not change host permissions.

The default port is 3000. Put a TLS/authenticated reverse proxy in front of the
app for remote use; the app is designed as a single-user workspace.

```sh
docker build -t luminate .
docker run --rm luminate ffmpeg -version
docker run --rm -p 3000:3000 -v luminate-data:/data luminate
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `LUMINATE_DATA_DIR` | `/data` in Docker; working directory otherwise | Database and persistent media root |
| `BACKEND_URL` | empty in Docker | Optional legacy settings sync; leave empty for standalone use |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Public metadata origin; set as Docker build argument / Compose environment before building |
| `PORT` | `3000` | Standalone server port |
| `HOSTNAME` | `0.0.0.0` in Docker | Standalone listen address |

`/api/health` is a liveness probe; `/api/ready` also checks the SQLite connection. Initialize the schema before using project APIs.
Use `/api/init` for initial provisioning and idempotent runtime upgrades. For a
fresh or previously Drizzle-managed database, the CLI migration path is available
as `node scripts/migrate-db.mjs` in the image (`npm run db:migrate` in a checkout).
Do not apply both histories to the same existing database. See [database guide](db.md).

## Bare Node deployment

Install Node 22, FFmpeg, a DejaVu font, and Python/make/g++ if the SQLite native
addon must be compiled. Run `npm ci`, `npm run build`, then `BACKEND_URL='' npm start`.
To use an external data directory, create it first and set `LUMINATE_DATA_DIR`
for both initialization and the server. Without that variable, media is stored
in `public/recordings` and `public/exports`.

## Backup and restore

Stop the app before copying the entire data directory/volume so SQLite and media
are consistent. Preserve ownership and all files, including any WAL sidecars.
Restore into an empty writable volume, start the same or newer app version, and
check `/api/ready`, a saved project, and recording playback. Do not restore an
older schema over a running instance.

The Docker CI smoke test builds the image, checks FFmpeg/native SQLite, creates a
project and recording, recreates the container using the same volume, and checks
project persistence, media bytes and range responses.
