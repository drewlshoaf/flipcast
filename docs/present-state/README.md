# Flipcast — Present State (Handoff)

This directory is a snapshot for the next agent picking up this project. Read these five files in order; each should take 2-3 minutes.

1. **[README.md](README.md)** (you're here) — product, tech stack, directory tree, quick start
2. **[architecture.md](architecture.md)** — monorepo layout, packages, apps, external services, design decisions
3. **[playback-pipeline.md](playback-pipeline.md)** — the lifecycle of a Flipcast from POST to final audio
4. **[operations.md](operations.md)** — dev commands, env vars, utility scripts, troubleshooting recipes
5. **[roadmap.md](roadmap.md)** — planned next steps, deferred work, known quirks

## What Flipcast is

Flipcast is a personalized, on-demand podcast. A listener submits a topic; the system produces a short (~7 minute), scene-structured episode with ads interleaved. Two formats are supported: **Panel Discussion** (three distinct voices debating) and **News Anchor** (a single authoritative host).

The experience is structured like a real produced show — a branded station intro, pre-roll ads, a moderator/anchor welcome message, then alternating content scenes and ad breaks. Ads double as generation-time cover so the listener always has something to hear while the next scene is being produced.

See [docs/medium_flow/spec.md](../medium_flow/spec.md) and [docs/flabbercast_plan/](../flabbercast_plan/) for original product specs. Note: the product was originally named "Flabbercast" — that's why the directory and some early docs carry that name. The product is now **Flipcast**. All code, DB, and user-facing strings use Flipcast. The old `flabbercast_plan/` directory is kept as a historical planning record.

## Tech stack

- **Monorepo**: pnpm workspaces + Turbo
- **Languages**: TypeScript everywhere, Node 20
- **Web**: Next.js 14 (App Router), React 18, server + client components, SSE for live progress
- **Worker**: Node + BullMQ + tsx-watch in dev
- **DB**: Postgres 16 via Drizzle ORM
- **Queue / pub-sub**: Redis 7 (BullMQ jobs + SSE fan-out)
- **Object storage**: MinIO (S3-compatible) locally; a real S3 is the production story
- **LLM**: Anthropic Claude (Sonnet 4.6 for generation, Haiku 4.5 for the Ideas panel)
- **TTS**:
  - **ElevenLabs** — primary, multilingual v2 for scenes/welcome; flash v2.5 for ads
  - **AWS Polly** — used only for pre-recorded static assets (not user-facing casts)
- **Infra**: Docker Compose orchestrates the whole dev stack

## Directory tree

```
.
├── apps/
│   ├── web/              Next.js app — the user surface + HTTP API
│   └── worker/           BullMQ worker — generation pipeline
├── packages/
│   ├── types/            Platform-agnostic: schemas, voice catalog, planSequence, policy
│   ├── server-db/        Drizzle schema + pg client factory
│   └── queue/            BullMQ queue + Redis pub/sub + SSE publisher/subscriber
├── docs/
│   ├── flabbercast_plan/ Original product planning (historical)
│   ├── medium_flow/      Spec that drove the scene-based playback architecture
│   └── present-state/    ← you are here
├── docker-compose.yml
├── .env                  Runtime secrets (NEVER commit)
├── .env.example          Template with safe defaults
├── package.json          Root workspace config
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

## Quick start

```bash
cp .env.example .env
# Then edit .env to add real keys for ANTHROPIC_API_KEY, ELEVENLABS_API_KEY,
# AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY. See operations.md for details.

docker compose up -d --build    # Brings up postgres, redis, minio, web, worker; runs the migrate one-shot

# Open http://localhost:3000 — the Flipcast homepage.
# Open http://localhost:9001 — MinIO console (minioadmin / minioadmin).
```

First-time gotchas:

1. The **station intro** MP3, the **6 pre-recorded ads**, and the **8 voice samples** live as static files under `apps/web/public/`. They should already be present on disk (host-side bind mount). If they're missing or you change scripts, regenerate — see operations.md.
2. The **migrate** service is a one-shot that runs on `docker compose up` and applies the Drizzle schema via `drizzle-kit push`. It exits when done; that's normal.
3. **Env var changes don't propagate to running containers** — you must `docker compose up -d --force-recreate worker web` after editing `.env`.
