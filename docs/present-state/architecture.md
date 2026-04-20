# Architecture

## Monorepo layout

pnpm workspaces with Turbo on top. Three `packages/` + two `apps/`:

```
packages/types       — platform-agnostic (no Node runtime deps beyond zod)
packages/server-db   — Drizzle ORM + pg (server-only)
packages/queue       — BullMQ + ioredis + SSE publisher/subscriber (server-only)

apps/web             — Next.js 14: form UI, API routes, SSE endpoint, /api/ideas
apps/worker          — BullMQ worker: moderation → Claude → ElevenLabs → ffmpeg → MinIO
```

Dependency graph (no cycles):

```
types
  ↑        ↑
queue    apps/web, apps/worker
server-db ──↑
```

The split was done deliberately so a future React Native mobile app can depend on `@flipcast/types` (and eventually a new `@flipcast/api-client`) without pulling in `pg` / `bullmq` transitively. See [roadmap.md](roadmap.md) for that plan.

## Packages

### `@flipcast/types`

The shared domain layer. Contains:

- **Request schemas**: `createRequestSchema` (zod) — validates POST `/api/flipcasts` bodies
- **Domain types**: `Character`, `SceneOutline`, `EpisodeSetup`, `TranscriptTurn`, `SseEvent`, `SseEventName`
- **Voice catalog**: `VOICES` (20 total — 12 Polly, 8 ElevenLabs), `AVAILABLE_FORMATS`, `AVAILABLE_VIBES`, `LENGTH_PRESETS`
- **Sequence planner**: `planSequence()` — returns the fixed 11-item playback sequence (see [playback-pipeline.md](playback-pipeline.md))
- **Policy**: `evaluatePolicy()` — keyword-based moderation gate (cheap pre-check before the cast generates)
- **SSE helpers**: `sseChannel(requestId)` → Redis channel key

Zero runtime side effects. Safe to import from anywhere.

### `@flipcast/server-db`

Drizzle schema + a `createDb(url)` factory. Tables:

- `users` (exists but auth is not wired up yet)
- `flipcast_requests` — one row per submitted cast
- `transcripts` — one row per generated episode; stores structured_transcript_json blob with outline + scenes + panelists
- `transcript_segments` — per-turn rows with `scene_index`
- `audio_assets` — every generated MP3 (segment, scene, welcome) with its MinIO URL
- `moderation_decisions` — audit log of keyword matches

Migrations are applied by the `migrate` compose service via `drizzle-kit push`. Schema changes → `docker compose run --rm --build migrate`.

### `@flipcast/queue`

BullMQ queue factory + Redis pub/sub primitives:

- `createFlipcastQueue(connection)` — the single queue named `flipcast`
- `createRedisPublisher(url)` / `createRedisSubscriber(url)` — separate connections for pub and sub (ioredis requirement)
- `publishSseEvent(pub, event)` — publishes to `flipcast:events:{requestId}` channel

The web API uses the publisher from inside route handlers to emit pre-queue events (request_received, moderation_started/approved/rejected, queued). The worker uses the publisher during generation (setup_started, welcome_ready, scene_ready, complete, failed). The web SSE route uses the subscriber to stream to the browser.

## Apps

### `apps/web` — Next.js 14

- **Pages**: single homepage in [page.tsx](../../apps/web/src/app/page.tsx) delegating to a client component that holds the topic state shared between form and Ideas panel
- **Form**: [flipcast-form.tsx](../../apps/web/src/components/flipcast-form.tsx) — the big stateful component (form fields, SSE subscription, playlist state machine, player UI, cast/outline/transcript display). This file is due to be split; see roadmap.md.
- **Ideas panel**: [ideas-panel.tsx](../../apps/web/src/components/ideas-panel.tsx) — right column, fetches `/api/ideas` on mount, renders 3 categories of clickable prompts
- **API routes**:
  - `POST /api/flipcasts` → validate, moderate, enqueue, return sequence plan
  - `GET /api/flipcasts/:id` → fetch request row
  - `GET /api/flipcasts/:id/stream` → SSE endpoint that subscribes to Redis and forwards events
  - `GET /api/ideas` → Claude-generated topic ideas, 30-min in-memory cache
- **Server-only env**: [src/lib/env.ts](../../apps/web/src/lib/env.ts) reads DATABASE_URL, REDIS_URL, S3_*, ANTHROPIC_API_KEY, FLIPCAST_DEFAULT_SPEED from `process.env`
- **Static assets** in `public/`:
  - `station/intro.mp3` — 10s branded station intro (generated once, checked into repo)
  - `ads/ad-1..6.mp3` + `manifest.json` — 6 × ~15s pre-recorded ads
  - `voice-samples/el-*.mp3` + `manifest.json` — 5s preview clips for voice picker

### `apps/worker` — BullMQ worker

- **Entry**: [src/index.ts](../../apps/worker/src/index.ts) — creates a single Worker on the `flipcast` queue; default concurrency 2
- **Pipeline**: [src/pipeline/run.ts](../../apps/worker/src/pipeline/run.ts) — orchestrates the full episode (see [playback-pipeline.md](playback-pipeline.md))
- **Stitcher**: [src/pipeline/stitch.ts](../../apps/worker/src/pipeline/stitch.ts) — concatenates segment MP3s with silence gaps using ffmpeg (installed in the worker image)
- **Clients**:
  - `clients/anthropic.ts` — Claude calls for `generateSetup`, `generateScene` (panel), `generateFullNewscast` (solo one-shot)
  - `clients/tts.ts` — dispatcher by voice provider
  - `clients/polly.ts` — AWS Polly (used only by ad-generation scripts now)
  - `clients/elevenlabs.ts` — primary TTS, maps engine → model + voice settings
  - `clients/s3.ts` — S3 client configured against MinIO
- **Scripts** in `apps/worker/scripts/`:
  - `generate-ads.ts` — regenerates the 6 ads via ElevenLabs Flash
  - `generate-intro.ts` — regenerates the 10s station intro via ElevenLabs multilingual v2
  - `generate-voice-samples.ts` — regenerates the 8 voice preview clips
- **Dev mode**: `pnpm dev` runs `tsx watch src/index.ts` — auto-reloads on any file change in `apps/worker/src` or the bind-mounted shared package sources

## External services (docker-compose)

| Service | Purpose | Ports |
|---|---|---|
| `postgres` | Primary data store | 5432 |
| `redis` | BullMQ broker + SSE pub/sub | 6379 |
| `minio` | S3-compatible object store for per-episode audio | 9000 (API), 9001 (console) |
| `minio-init` | One-shot: creates the `flipcast-audio` bucket with public-download policy | — |
| `migrate` | One-shot: runs `drizzle-kit push` | — |
| `web` | Next.js app | 3000 |
| `worker` | BullMQ worker in watch mode | — |

**Bind mounts** in `docker-compose.yml`: host source directories are mounted into both the web and worker containers so Next.js HMR and tsx-watch pick up code changes without rebuilds. The mounts cover `apps/*/src` and `packages/*/src` plus the `apps/web/public` directory so regenerated ads / intro / samples show up immediately.

## Key design decisions

1. **Staged playback as orchestration buffer.** The sequence — intro, pre-roll ads, welcome, mid-roll ads, scenes — isn't just a product choice; it's also the mechanism that hides generation latency. The listener is always hearing something while the next scene is being produced.

2. **Scene generation strategy differs by format.** Panel uses per-scene Claude calls with prompt caching (better multi-voice coherence). Newscast uses a single call that emits the full script (single-speaker doesn't need the iterative reasoning, saves ~5 Claude calls per episode).

3. **Prompt caching for panel.** The system prompt and user message in `generateScene` are split into cache_control'd stable blocks + dynamic tails, so scenes 2+ of the same episode read the stable bits at 10% input cost.

4. **ElevenLabs everywhere except static ads.** Was experimenting with Polly for a while but settled on ElevenLabs for all user-facing cast audio (quality). Pre-recorded ads use ElevenLabs Flash (faster model) since they're baked once; Polly client is kept around but not used by the live pipeline.

5. **Voice auto-pick via Claude.** Users don't have to select voices. Claude picks based on character gender + ethnicity match against the voice catalog's `origin` tags. Users can override via the "Choose my own" mode on the form.

6. **Speed is per-request with env default.** `FLIPCAST_DEFAULT_SPEED` env var sets the baseline (0.7–1.2); the form's slider overrides per-cast. Applied at ElevenLabs synthesis time via `voiceSettings.speed`. Polly ads ignore it.

7. **Ideas panel is its own service.** Separate Claude call, 30-minute in-memory cache, uses Haiku (cheaper), on the `web` container side (not the worker). Click-to-fill populates the topic input.

8. **Docker bind mounts for dev, baked images for infra.** Only source directories are bind-mounted; `node_modules` and `package.json` live inside images. Editing `package.json` requires rebuilding the image.
