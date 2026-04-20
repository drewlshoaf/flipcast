# Roadmap

## Immediately-planned: mobile via React Native

A detailed architectural direction was shared by the product owner (see the bottom of the previous session's chat history). Key points:

- **Keep the Next.js web app** — do not migrate it to React Native.
- **Build a dedicated mobile app in React Native** (Expo is the expected path of least resistance).
- **Share non-UI logic via packages**, deliberately; do NOT over-share UI.
- Mobile audio is a first-class concern (playback, lock-screen controls, background, interruption handling) — use native APIs via `expo-av` or `react-native-track-player`.

### Concrete next steps (agreed upon)

The shared package split (step 1) is already done. The three current `packages/*` were designed with this plan in mind — `types` has no Node runtime deps and is mobile-safe.

**Step 2 (next):** Extract `packages/api-client`.

The web form (`flipcast-form.tsx`) currently calls `fetch("/api/flipcasts", ...)` inline and hand-parses SSE events via `EventSource`. Pulling this into a package gives:

- A typed `createFlipcastClient(baseUrl)` factory
- `client.createFlipcast(input): Promise<{ requestId, sequence }>`
- `client.streamEvents(requestId): AsyncIterable<SseEvent>` (or callback-based) — abstracted so a React Native consumer can plug in a different SSE implementation (RN has no native `EventSource`; use `react-native-sse` or a custom fetch-stream subscriber)
- `client.fetchIdeas(): Promise<IdeasPayload>`

**Step 3:** Extract the playback state machine from `flipcast-form.tsx` into a platform-agnostic hook (or pure TS state machine). Web uses it with `<audio>`; RN uses it with `expo-av` / `react-native-track-player`.

**Step 4:** Decide on **public asset URLs** before scaffolding mobile. Today the audio URLs are `http://localhost:9000/flipcast-audio/...` baked into DB rows. Mobile devices can't reach localhost. Options:
- Reverse proxy MinIO via the Next.js server and serve audio under a stable URL
- Real S3 bucket for dev
- ngrok or similar tunnel for local-device testing

**Step 5:** Scaffold `apps/mobile` with Expo, wire up shared `@flipcast/types` + `@flipcast/api-client`.

Skip `packages/ui` until a clear shareable pattern emerges. React Native's `<View>`/`<Text>` and web's DOM don't converge cleanly without something like Tamagui, which is a real commitment.

## Deferred (explicitly not implemented yet)

- **Auth / Login.** A `users` table exists in the schema, but there is no sign-up, login, session, or ownership on `flipcast_requests.user_id` (currently always null). The spec's Phase 2 (account + history) is untouched.
- **History page.** `GET /api/me/flabbercasts` was in the original spec; no route exists. Would need auth first.
- **In-transcript ad insertion.** The original spec called for ads embedded into the moderator's dialogue (read by cast members with promo codes). Current implementation uses only pre-recorded pre-roll/mid-roll ads. The `audio_assets.is_ad_segment` field and `transcript_segments.is_ad_segment` column exist but are always false.
- **Paid tier / ad-free.** `users.plan_tier` enum exists (`free` | `paid`) but nothing reads it.
- **Small / Long / Longer length presets.** The UI used to have a three-option picker but it was pulled. `LENGTH_PRESETS` constant still exists in `packages/types/src/voices.ts`. Current `planSequence()` is fixed — ignores its `lengthMinutes` parameter.
- **Real "Today's News" data.** The Ideas panel's `todaysNews` category is Claude-generated plausible topics, not actual news. Would need a news API (NewsAPI, RSS, etc.).
- **Public production asset URLs.** MinIO URLs are localhost-bound. Blocks mobile + shareable links.
- **Scene counts beyond 3.** Infrastructure supports up to 4 dedicated `scene_N_audio_url` columns, but the fixed sequence produces 3. If length presets come back, scene 5+ would alias to `scene_4_audio_url` (see the comment in `run.ts` → `columnForScene`).
- **Admin tooling, analytics, sponsor management** — from the spec's §5.3 extensibility list. None touched.

## Known quirks

- **`error_message` not cleared on retry success.** BullMQ retries failed jobs with `attempts: 3`. If the first attempt fails (e.g., ElevenLabs 429), it sets status `failed` + `error_message`. On retry success, `status` flips to `complete` but `error_message` stays. Cosmetic — status is authoritative.

- **ElevenLabs 3-concurrent cap.** Current plan allows 3 concurrent `text-to-speech` requests. Our per-request synthesis caps at 3 parallel ElevenLabs calls, so a single cast works. Submitting 2 casts back-to-back will race and one will hit 429. BullMQ retries it. If this becomes painful, move to serialized queue consumption (concurrency 1 in worker) or upgrade the ElevenLabs plan.

- **Ad cycling.** 6 ads in inventory, accessed via `adIndex % 6`. With 5 ads in the fixed sequence, there's no repetition today — but if the sequence ever grows past 6 ads, the same ad could appear twice in one episode.

- **Static asset changes don't propagate to the running web container without a restart.** Wait, they do — `apps/web/public` is bind-mounted, Next.js serves dynamically. But if you rebuild the image, uncommitted asset changes on the host may get overwritten. Treat regenerated ads/intro/samples as source-of-truth on host.

- **Migrate image staleness.** The `migrate` service image caches until you pass `--build`. Easy trap: "I added a column and ran migrate but nothing happened" — almost always means the image is stale. Always use `docker compose run --rm --build migrate`.

- **No git repo (as of handoff).** The project directory has a `.gitignore` but `.git` was never initialized. First commit hasn't happened. The next agent may need to coordinate with the owner on `git init`, branch name, and whether to commit the ~2 MB of pre-rendered audio assets in `apps/web/public/`.

## Suggested first tasks for the next agent

1. Read the five docs here in order.
2. Bring up the stack (`docker compose up -d --build`) and submit a test cast end-to-end to see it all work.
3. Confirm the architectural direction with the owner (mobile plan is documented but not yet broken ground).
4. Start with step 2 above: extract `packages/api-client`. It's a pure refactor — web form consumes the new client, behavior unchanged — but unlocks mobile.
5. Tackle the public asset URL problem before scaffolding `apps/mobile` (otherwise mobile is DOA on first run).

## Architectural principles worth preserving

- **Scene-level granularity.** Episodes are composed of discrete assets delivered incrementally, not one big MP3. Don't collapse this.
- **SSE as source of truth during generation.** The DB row is for audit/retrieval; the live listener experience is driven by `scene_ready` events. Keep the event contract stable (add fields, don't rename).
- **Prompt caching.** Cache breakpoints are deliberately placed in [`generateScene`](../../apps/worker/src/clients/anthropic.ts). If you restructure the prompts, keep the stable portion ahead of the cache_control marker.
- **Voice matching over voice preference.** The cast-diversity prompt instructs Claude to vary names/origins widely. The fallback validator swaps bad voice picks. Don't let "voice selection" collapse back into a hardcoded default cast.
- **Stub paths work without API keys.** `generateSetup`, `generateFullNewscast`, and `generateScene` all have stub branches for when `ANTHROPIC_API_KEY` is missing. Keeps the pipeline testable offline. Don't remove them.
