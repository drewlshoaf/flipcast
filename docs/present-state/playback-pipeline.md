# Playback Pipeline

## The fixed sequence (~7:10 per episode)

Produced by [`planSequence()`](../../packages/types/src/voices.ts). Current shape is hardcoded; the `lengthMinutes` parameter is preserved in the schema but ignored (length picker is hidden from the UI).

```
 1. station_intro      (10s, static MP3 under apps/web/public/station/)
 2. ad[0]              (15s, static ElevenLabs Flash)
 3. ad[1]              (15s)
 4. ad[2]              (15s)
 5. welcome            (~30s, generated per-request — topic context + panelist teasers)
 6. ad[3]              (15s)
 7. scene 1            (120s, generated)
 8. ad[4]              (15s)
 9. scene 2            (120s, generated)
10. ad[5]              (15s)
11. scene 3            (60s, generated, FINAL — closing wrap-up)
```

Total: ~430s ≈ 7:10. Ads cycle through the 6-item inventory via `adIndex % AD_INVENTORY`.

## Request lifecycle

1. **Browser POSTs `/api/flipcasts`** with `{ topic, format, vibe, lengthMinutes, voiceIds?, speed? }`.
2. **API validates** via `createRequestSchema`, derives the engine from `format` (both supported formats currently use `elevenlabs`), and inserts a row into `flipcast_requests` with status `validating`.
3. **Moderation**: keyword-based pre-check via [`evaluatePolicy()`](../../packages/types/src/policy.ts). A hit sets status `rejected`, writes a `moderation_decisions` row, and emits an SSE `moderation_rejected`. No keyword hit → status `queued`, emit `moderation_approved` + `queued`.
4. **Enqueue**: a BullMQ job with `{ requestId }` is added to the `flipcast` queue.
5. **API returns** `{ requestId, sequence: <SequencePlan>, format, engine }`. The client uses the sequence to build its playlist immediately and opens an EventSource to `/api/flipcasts/:id/stream`.
6. **Worker picks up the job** and runs the pipeline (below).
7. **SSE events stream** from Redis pub/sub via the web container to the browser as each asset becomes available.
8. **Playback**: the browser starts the station intro immediately (always available), continues through ads (static URLs), and inserts `welcome` / `scene N` audio into the playlist as their URLs arrive.

## Worker pipeline (`apps/worker/src/pipeline/run.ts`)

Branches on format:

### Panel (3 speakers)
1. `generateSetup(topic, format='panel', vibe, engine, outline, presetVoiceIds?)` → Claude picks 3 cast members + assigns voices + writes welcome. Outputs `EpisodeSetup`.
2. Persist cast + topicContext + welcomeText to `flipcast_requests`; insert `transcripts` parent row.
3. Emit `setup_complete` with cast info (UI renders the cast cards immediately).
4. Synthesize welcome with moderator's voice → upload to MinIO → emit `welcome_ready`.
5. For each scene 1..3: `generateScene()` with prompt caching (stable system + user blocks are cached across scenes in the 5-min window). Each scene is a separate Claude call so later scenes can reference `priorScenesBrief`.
6. For each scene's turns: parallel synth via `synthesizeSegment()` with concurrency cap = 3 for ElevenLabs (matches account limit). Upload each segment, stitch them with silence gaps into a scene MP3, upload the stitched file, emit `scene_ready`.
7. On final scene complete → status `complete`, emit `complete`.

### Newscast (1 speaker — cost-optimized)
1. `generateFullNewscast(topic, vibe, engine, outline, presetVoiceIds?)` → **one Claude call** emits the anchor + welcome + full transcript for every scene. Saves ~5 redundant per-scene system prompts per episode.
2. Pre-cache the per-scene turns in a Map.
3. Same setup/welcome synth + per-scene synth + stitch loop as panel, but scene generation is a Map lookup instead of a Claude call.

This split is the single biggest cost optimization in the codebase; panel benefits from prompt caching (~70–80% off input on scenes 2+), newscast benefits from collapse (one call instead of 5–6).

## Scene opening convention

Every scene (including scene 1, which also comes after an ad) opens with the moderator welcoming listeners back and handing off to a panelist by name with a pointed prompt. The final scene (scene 3) uses its welcome-back opener before delivering the wrap-up (no "we'll be right back" at the end). This is enforced in the Claude system prompt for `generateScene` and in the stub path for when `ANTHROPIC_API_KEY` is missing.

## SSE events

Listed in [packages/types/src/types/sse.ts](../../packages/types/src/types/sse.ts):

```
request_received, moderation_started, moderation_rejected, moderation_approved,
queued, setup_started, setup_complete, welcome_synth_started, welcome_ready,
scene_generation_started, scene_synth_started, scene_ready, complete, failed
```

Each event carries `{ event, requestId, message?, percent?, data?, timestamp }`. The `data` field is event-specific:

- `setup_complete.data` → `{ characters, topicContext, welcomeText, outline, plan, format, vibe }`
- `welcome_ready.data` → `{ url }`
- `scene_ready.data` → `{ sceneIndex, totalScenes, url, turns, durationMs }`

## Voice selection

Two modes on the form:

- **Auto-pick** (default): Claude picks voices for the cast based on character gender + ethnicity matching against the voice catalog's `origin` tags (`american`, `british`, `french`, `german`, `generic`). Post-hoc validation in the worker swaps in a fallback if Claude picks an invalid/duplicate voice.
- **Pick your own**: the user selects from ElevenLabs voices (8 total) with sample preview buttons. Panel requires 3 selections, newscast requires 1. Preset voice IDs are passed through to Claude in the setup prompt with "use these exact voice_ids" instructions.

The voice catalog's `providerVoiceId` field decouples our internal `id` (e.g. `el-lauren`) from the actual ElevenLabs voice id (the 20-char string). Polly voices use their name directly (e.g. `Joanna`).

## Speed

- `FLIPCAST_DEFAULT_SPEED` env var (0.7–1.2, default 1.0) sets the baseline for all new casts.
- The form's Speaker Speed slider overrides per-request.
- Stored on `flipcast_requests.speed` (nullable real; null means use env default).
- Applied at ElevenLabs synthesis time via `voiceSettings.speed`.
- Polly synthesis (ads, intro) ignores it — those have fixed baked cadence.

## Prompt configuration

- Claude Sonnet 4.6 (`claude-sonnet-4-6`) for cast/scene generation.
- Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) for the Ideas panel (cheaper, faster).
- Tools are always `tool_choice: { type: "tool", name: "..." }` to force structured output.
- Zod schemas validate tool outputs; voice picks are validated + repaired after parsing.

## Frontend playback

- [`flipcast-form.tsx`](../../apps/web/src/components/flipcast-form.tsx) holds a `playback` state: `{ stage: "idle" | "playing" | "waiting" | "finished", index }`.
- The `<audio>` element uses `key={currentSrc}` + `autoPlay` to remount and play each new track. `onEnded` advances the index.
- If the next item's source isn't available yet (welcome or scene URL hasn't arrived via SSE), stage flips to `waiting` and an effect resumes playback when the SSE event fills it in.
- Autoplay permissions: the first `<audio>` load happens inside the submit handler's user-gesture tick, which unblocks subsequent autoplay chains on modern browsers.
