# Operations

## Env vars

All live in `.env` at the repo root. `.env.example` has safe defaults; never commit real keys.

| Var | Purpose | Default | Where read |
|---|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Postgres bootstrap | flipcast/flipcast/flipcast | compose |
| `POSTGRES_PORT` | Exposed port | 5432 | compose |
| `REDIS_PORT` | Exposed port | 6379 | compose |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | MinIO admin | minioadmin/minioadmin | compose + S3 client |
| `MINIO_PORT` / `MINIO_CONSOLE_PORT` | Exposed ports | 9000 / 9001 | compose |
| `FLIPCAST_BUCKET` | MinIO bucket for audio | flipcast-audio | minio-init + S3 client |
| `S3_PUBLIC_ENDPOINT` | Base URL baked into stored audio URLs | http://localhost:9000 | web + worker |
| `WEB_PORT` | Next.js exposed port | 3000 | compose |
| `WORKER_CONCURRENCY` | BullMQ concurrency | 2 | worker |
| `FLIPCAST_DEFAULT_SPEED` | Default speaker speed (0.7–1.2) | 1.0 | web + worker |
| `ANTHROPIC_API_KEY` | Claude API — required for real transcript/ideas generation | (empty → stubs) | web + worker |
| `ELEVENLABS_API_KEY` | ElevenLabs TTS — required for all cast/welcome/ad synthesis | (empty → errors) | worker |
| `AWS_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | AWS Polly (only used by generator scripts now) | us-east-1 / — / — | worker |

## Docker Compose recipes

**First-time bring-up:**
```bash
docker compose up -d --build
```

**Nuke everything including data volumes:**
```bash
docker compose down -v
```

**Rebuild just one service (picks up package.json changes):**
```bash
docker compose up -d --build --force-recreate worker
```

**Reload env vars into already-running containers (most common need):**
```bash
docker compose up -d --force-recreate worker web
```
⚠ `docker compose restart` does NOT re-read `.env`. You MUST use `--force-recreate`.

**Apply Drizzle schema changes:**
```bash
docker compose run --rm --build migrate
```
The `--build` forces rebuild of the migrate image so it picks up any changes in `packages/server-db/src/schema.ts`. Without `--build` the image is stale from the initial build.

**Tail logs:**
```bash
docker compose logs --tail=30 -f worker
docker compose logs --tail=30 -f web
```

**Exec into a container:**
```bash
docker compose exec worker sh
docker compose exec postgres psql -U flipcast -d flipcast
```

**Flush the BullMQ queue in Redis** (useful when stale jobs from an old schema are retrying):
```bash
docker compose exec redis redis-cli eval \
  "local keys = redis.call('keys', 'bull:flipcast:*') if #keys > 0 then return redis.call('del', unpack(keys)) else return 0 end" 0
```

## Utility scripts (run inside worker container)

All live in `apps/worker/scripts/`. They're one-shot generators that write to `apps/web/public/` (via the shared bind mount, so the web container sees them immediately).

```bash
# Regenerate the 6 pre-recorded ads (~15s each, ElevenLabs Flash).
docker compose exec worker pnpm ads

# Regenerate the 10s branded station intro.
docker compose exec worker pnpm intro

# Regenerate the 8 ElevenLabs voice preview clips (used by the "Pick my own voices" UI).
docker compose exec worker pnpm voice-samples
```

Edit the corresponding `.ts` file under `apps/worker/scripts/` to change scripts, voices, or models. `tsx watch` doesn't apply to scripts — just re-run the pnpm command.

## Key rotation procedure

When `ANTHROPIC_API_KEY` or `ELEVENLABS_API_KEY` changes in `.env`:

```bash
docker compose up -d --force-recreate worker web
```

Then verify:

```bash
docker compose exec worker sh -c 'echo "$ANTHROPIC_API_KEY" | head -c 20; echo; echo "$ELEVENLABS_API_KEY" | head -c 12'
```

The prefix printed should match what's in `.env`. If not, the containers are still on the old snapshot and `--force-recreate` didn't actually recreate (rare — usually means something was holding the container).

Live API probes (both should return 200):

```bash
docker compose exec worker node -e '
  fetch("https://api.elevenlabs.io/v1/text-to-speech/DODLEQrClDo8wCz460ld", {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({ text: "Test.", model_id: "eleven_multilingual_v2" }),
  }).then(r => console.log("elevenlabs", r.status))'

docker compose exec web node -e '
  fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 10,
      messages: [{ role: "user", content: "ok" }],
    }),
  }).then(r => console.log("anthropic", r.status))'
```

## Common troubleshooting

| Symptom | Fix |
|---|---|
| `"Invalid API key"` from ElevenLabs or Anthropic | `.env` was edited but containers still have old snapshot → `docker compose up -d --force-recreate worker web` |
| Worker logs `Error: column "X" does not exist` | Schema changed but migrate hasn't run with `--build` → `docker compose run --rm --build migrate` |
| Scene generation works but nothing plays | Check MinIO console at http://localhost:9001; verify the bucket has the expected object keys; ensure `S3_PUBLIC_ENDPOINT` in env matches what the browser can reach |
| "Unknown voice id on request" in worker | Usually means a stale queued job from an old voice catalog; flush the BullMQ queue (see above) and resubmit |
| ElevenLabs 429 `concurrent_limit_exceeded` | Account plan's concurrent cap (3 for the current plan). If submitting multiple casts fast, they race. Fix: wait for the first to reach stitch stage before submitting the next, or upgrade plan |
| Next.js shows old content after editing shared types | Next dev usually HMRs fine; if not, `docker compose restart web` (no env changes → restart is sufficient) |
| Worker not hot-reloading on code changes | Worker runs `tsx watch src/index.ts`; check that the bind mounts in `docker-compose.yml` include the relevant package's `src/` directory |
| Mysterious "stale" error_message on a `complete` row | Known quirk — BullMQ retries a job that initially failed; on success the status flips to `complete` but `error_message` isn't cleared. Harmless. |

## Where things live (quick reference)

| What | Where |
|---|---|
| Station intro MP3 | `apps/web/public/station/intro.mp3` |
| Ad MP3s | `apps/web/public/ads/ad-{1..6}.mp3` |
| Voice sample MP3s | `apps/web/public/voice-samples/el-*.mp3` |
| Generated per-episode audio | MinIO, bucket `flipcast-audio`, keys `requests/{requestId}/...` |
| Postgres data | Docker named volume `flipcast_postgres_data` |
| Redis data | Docker named volume `flipcast_redis_data` |
| MinIO data | Docker named volume `flipcast_minio_data` |
| Source code | `apps/` and `packages/` (bind-mounted into containers) |
