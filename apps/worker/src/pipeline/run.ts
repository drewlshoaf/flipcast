import { eq } from "drizzle-orm";
import {
  flipcastRequests,
  transcripts,
  transcriptSegments,
  audioAssets,
} from "@flipcast/server-db";
import {
  VOICE_BY_ID,
  planSequence,
  formatConfig,
  emptyClaudeUsage,
  mergeClaudeUsage,
  type TtsEngine,
  type Character,
  type ClaudeCallUsage,
  type ClaudeUsageAggregate,
  type EpisodeMetadata,
  type EpisodeSetup,
  type TranscriptTurn,
  type SpeakerRole,
  type FlipcastFormat,
  type SceneOutline,
} from "@flipcast/types";
import { db } from "../db";
import { env } from "../env";
import { emit } from "../emit";
import {
  classifyEpisode,
  generateSetup,
  generateScene,
  generateFullNewscast,
  validateEpisode,
} from "../clients/anthropic";
import { synthesizeSegment } from "../clients/tts";
import { synthesizeWithFishMulti } from "../clients/fish";
import { uploadObject } from "../clients/s3";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Map a TranscriptTurn's speaker role to the Fish multi-speaker index. The
// reference_id array is built in this same order below.
const ROLE_TO_SPEAKER: Record<SpeakerRole, number> = {
  moderator: 0,
  panelist_1: 1,
  panelist_2: 2,
};

// Translate a turn's numeric pauseMsAfter into an inline Fish tag. Fish
// renders the tag as actual silence; no post-hoc stitching needed.
function pauseTagForMs(ms: number): string {
  if (ms >= 1500) return " [long pause]";
  if (ms >= 800) return " [pause]";
  if (ms >= 300) return " [short pause]";
  return "";
}

// Fish S2 Pro multi-speaker voices drift when a single call has many speaker
// switches (~25+ turns). Split the scene into chunks bounded by turn count
// *and* character budget, render each chunk as its own Fish call, and concat
// the mp3s. Each call gets the same `reference_id` array so the speaker↔voice
// mapping stays locked across chunks.
const MAX_TURNS_PER_FISH_CHUNK = 8;
const MAX_CHARS_PER_FISH_CHUNK = 700;

function chunkTurnsForMultiSpeaker(
  turns: TranscriptTurn[],
): TranscriptTurn[][] {
  const chunks: TranscriptTurn[][] = [];
  let current: TranscriptTurn[] = [];
  let currentChars = 0;
  for (const t of turns) {
    const tLen = t.text.length;
    if (
      current.length >= MAX_TURNS_PER_FISH_CHUNK ||
      (current.length > 0 && currentChars + tLen > MAX_CHARS_PER_FISH_CHUNK)
    ) {
      chunks.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(t);
    currentChars += tLen;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

// Retry a synthesis call up to 3 attempts with exponential backoff. On each
// non-final failure, emit a `synth_retry` SSE event so the UI can pop a
// "having a moment" notice instead of the user staring at a stuck buffer.
async function synthWithRetry<T>(opts: {
  requestId: string;
  label: string;
  data?: Record<string, unknown>;
  call: () => Promise<T>;
}): Promise<T> {
  const maxAttempts = 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await opts.call();
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts) break;
      console.warn(
        `[synth] ${opts.label} attempt ${attempt}/${maxAttempts} failed:`,
        err instanceof Error ? err.message : err,
      );
      await emit("synth_retry", opts.requestId, {
        message:
          "Having a moment with the audio engine — retrying. One sec.",
        data: {
          ...opts.data,
          label: opts.label,
          attempt,
          ofAttempts: maxAttempts,
        },
      });
      // 600ms, then 1.4s — quick first retry, longer second.
      await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }
  throw lastErr;
}

async function runFfmpeg(args: string[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn("ffmpeg", args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    proc.stderr.on("data", (c) => (stderr += c.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(`ffmpeg exit ${code}: ${stderr.slice(-500) || "(no log)"}`),
        );
    });
  });
}

// Two-pass concat: normalize each chunk to canonical 44.1 kHz mono 128 kbps
// mp3, then concat demuxer with -c copy. Fish mp3s are usually uniform
// already but normalization eliminates sample-rate/bitrate mismatch as a
// failure mode.
async function concatMp3s(buffers: Buffer[]): Promise<Buffer> {
  if (buffers.length === 0) throw new Error("concatMp3s: no buffers");
  if (buffers.length === 1) return buffers[0]!;
  const workDir = await mkdtemp(join(tmpdir(), "flipcast-concat-"));
  try {
    const normalized: string[] = [];
    for (let i = 0; i < buffers.length; i++) {
      const inPath = join(workDir, `in-${i}.mp3`);
      const outPath = join(workDir, `norm-${i}.mp3`);
      await writeFile(inPath, buffers[i]!);
      await runFfmpeg([
        "-y",
        "-i",
        inPath,
        "-ar",
        "44100",
        "-ac",
        "1",
        "-c:a",
        "libmp3lame",
        "-b:a",
        "128k",
        outPath,
      ]);
      normalized.push(outPath);
    }
    const listPath = join(workDir, "list.txt");
    const listBody =
      normalized
        .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
        .join("\n") + "\n";
    await writeFile(listPath, listBody);
    const outPath = join(workDir, "out.mp3");
    await runFfmpeg([
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c",
      "copy",
      outPath,
    ]);
    return await readFile(outPath);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

// Probe the duration of an mp3 Buffer via ffprobe (writes to a temp file,
// reads `format=duration`, cleans up). Used to record durationMs on the
// scene's audio_asset row for the admin reporting view.
async function probeMp3DurationMsFromBuffer(buf: Buffer): Promise<number> {
  const workDir = await mkdtemp(join(tmpdir(), "flipcast-probe-"));
  const filePath = join(workDir, "a.mp3");
  try {
    await writeFile(filePath, buf);
    return await new Promise<number>((resolve, reject) => {
      const proc = spawn("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        filePath,
      ]);
      let out = "";
      proc.stdout.on("data", (c) => (out += c.toString()));
      proc.on("error", reject);
      proc.on("close", (code) => {
        if (code !== 0) return reject(new Error(`ffprobe exit ${code}`));
        const secs = Number(out.trim());
        if (!Number.isFinite(secs)) return reject(new Error("bad duration"));
        resolve(Math.round(secs * 1000));
      });
    });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

interface RunPipelineOptions {
  // Admin fast-iteration: still run the full Claude pipeline (classify →
  // setup → scenes → validate) but skip Fish TTS for welcome and scenes.
  transcriptOnly?: boolean;
}

export async function runPipeline(
  requestId: string,
  opts: RunPipelineOptions = {},
): Promise<void> {
  const transcriptOnly = Boolean(opts.transcriptOnly);
  const request = await db.query.flipcastRequests.findFirst({
    where: eq(flipcastRequests.id, requestId),
  });
  if (!request) throw new Error(`Request ${requestId} not found`);

  try {
    const engineChoice = (request.engine ?? "fish") as TtsEngine;
    const format = (request.format ?? "panel") as FlipcastFormat;
    const locale = "en" as const;
    const cfg = formatConfig(format);
    const speed =
      typeof request.speed === "number" ? request.speed : env.defaultSpeed;

    const lengthMinutes = request.requestedDurationSecondsTarget / 60;
    const plan = planSequence(lengthMinutes);

    // Build outline from plan: one entry per scene with its target seconds.
    const outline: SceneOutline[] = plan.items
      .filter((it): it is Extract<typeof it, { kind: "scene" }> => it.kind === "scene")
      .map((scene) => ({
        sceneIndex: scene.sceneIndex,
        focus: "",
        targetSeconds: scene.targetSeconds,
      }));

    // --- Stage 1: Setup ---
    await setStatus(requestId, "generating_transcript");
    await emit("setup_started", requestId, {
      message:
        cfg.castSize === 1 ? "Casting the host…" : "Casting the panel…",
    });

    const presetVoiceIds = [
      request.moderatorVoiceId,
      request.panelist1VoiceId,
      request.panelist2VoiceId,
    ].filter((v): v is string => !!v);
    const usablePresetVoiceIds =
      presetVoiceIds.length === cfg.castSize ? presetVoiceIds : undefined;

    // For solo formats (newscast) we generate the full script in a single
    // Claude call and cache the per-scene turns. For panel we keep per-scene
    // generation (with prompt caching) so each scene can react to the prior.
    let setup: EpisodeSetup;
    let preGeneratedScenes: Map<number, TranscriptTurn[]> | null = null;

    let usageAgg: ClaudeUsageAggregate = emptyClaudeUsage();
    const recordUsage = async (
      model: string,
      usage: ClaudeCallUsage,
    ): Promise<void> => {
      usageAgg = mergeClaudeUsage(usageAgg, model, usage);
      await db
        .update(flipcastRequests)
        .set({ claudeUsage: usageAgg, updatedAt: new Date() })
        .where(eq(flipcastRequests.id, requestId));
    };

    // Pre-generation classifier — one cheap Haiku call that produces the
    // metadata object driving downstream prompt branching for THIS episode.
    // Failures fall through to safe defaults inside classifyEpisode itself,
    // so this never blocks the run.
    let metadata: EpisodeMetadata | undefined;
    try {
      const cls = await classifyEpisode({
        topic: request.topic,
        format,
        locale,
      });
      const { model: clsModel, usage: clsUsage, ...meta } = cls;
      metadata = meta;
      await recordUsage(clsModel, clsUsage);
      console.log(
        `[classify ${requestId}] ${meta.format_type} | ${meta.time_context} | ${meta.topic_domain} | intent=${meta.user_intent} | tone=${meta.tone_profile} | freshness=${meta.freshness_requirement} | facts=${meta.fact_sensitivity}${meta.speaker_pattern ? ` | speakers=${meta.speaker_pattern}` : ""}`,
      );
    } catch (err) {
      console.warn(
        `[classify ${requestId}] failed; continuing without metadata directive:`,
        err instanceof Error ? err.message : err,
      );
    }

    if (cfg.castSize === 1) {
      const full = await generateFullNewscast({
        topic: request.topic,
        engine: engineChoice,
        outline,
        presetVoiceIds: usablePresetVoiceIds,
        locale,
        metadata,
      });
      setup = full.setup;
      preGeneratedScenes = new Map(
        full.scenes.map((s) => [s.sceneIndex, s.turns]),
      );
      await recordUsage(full.model, full.usage);
    } else {
      const setupResult = await generateSetup({
        topic: request.topic,
        format,
        engine: engineChoice,
        outline,
        presetVoiceIds: usablePresetVoiceIds,
        locale,
        metadata,
      });
      setup = {
        topicContext: setupResult.topicContext,
        panelists: setupResult.panelists,
        welcomeText: setupResult.welcomeText,
        outline: setupResult.outline,
      };
      await recordUsage(setupResult.model, setupResult.usage);
    }

    const characters: Character[] = setup.panelists;
    const voiceForRole: Record<SpeakerRole, string> = {
      moderator: "",
      panelist_1: "",
      panelist_2: "",
    };
    for (const c of characters) voiceForRole[c.role] = c.voiceId;
    // For single-speaker formats, reuse moderator voice for any panelist slot
    // that appears (shouldn't happen but defensive).
    if (cfg.castSize === 1) {
      voiceForRole.panelist_1 = voiceForRole.moderator;
      voiceForRole.panelist_2 = voiceForRole.moderator;
    }

    await db
      .update(flipcastRequests)
      .set({
        moderatorVoiceId: voiceForRole.moderator,
        panelist1VoiceId: voiceForRole.panelist_1 || null,
        panelist2VoiceId: voiceForRole.panelist_2 || null,
        topicContext: setup.topicContext,
        welcomeText: setup.welcomeText,
        updatedAt: new Date(),
      })
      .where(eq(flipcastRequests.id, requestId));

    const [savedTranscript] = await db
      .insert(transcripts)
      .values({
        flipcastRequestId: requestId,
        rawPromptContext: { topic: request.topic, format, metadata: metadata ?? null },
        generatedTranscriptText: "",
        structuredTranscriptJson: {
          topic: request.topic,
          format,
          metadata: metadata ?? null,
          topicContext: setup.topicContext,
          panelists: setup.panelists,
          welcomeText: setup.welcomeText,
          outline: setup.outline,
          scenes: [] as { sceneIndex: number; turns: TranscriptTurn[] }[],
        },
        characters,
        adInserted: false,
        estimatedDurationSeconds: plan.estimatedSeconds,
      })
      .returning();
    if (!savedTranscript) throw new Error("Failed to persist transcript.");

    await emit("setup_complete", requestId, {
      message: `Cast ready: ${characters.map((c) => `${c.name} (${c.voiceLabel})`).join(", ")}.`,
      data: {
        characters,
        topicContext: setup.topicContext,
        welcomeText: setup.welcomeText,
        outline: setup.outline,
        plan,
        format,
        metadata: metadata ?? null,
      },
    });

    // --- Stage 2: Welcome synthesis ---
    // Skipped entirely in transcript-only mode. The setup_complete event
    // already carried welcomeText, so admins reviewing the transcript see it.
    const moderator = characters.find((c) => c.role === "moderator");
    if (!moderator) throw new Error("Moderator missing from cast.");

    if (transcriptOnly) {
      await emit("welcome_ready", requestId, {
        message: "Welcome ready (transcript-only — no audio).",
        data: { url: null, transcriptOnly: true },
      });
    } else {
      await emit("welcome_synth_started", requestId, {
        message: "Recording welcome message…",
      });
      const welcomeAudio = await synthWithRetry({
        requestId,
        label: "welcome",
        call: () =>
          synthesizeSegment(
            setup.welcomeText,
            moderator.voiceId,
            engineChoice,
            speed,
          ),
      });
      const welcomeKey = `requests/${requestId}/welcome.mp3`;
      const welcomeUrl = await uploadObject(
        welcomeKey,
        welcomeAudio,
        "audio/mpeg",
      );
      await db.insert(audioAssets).values({
        flipcastRequestId: requestId,
        assetType: "welcome",
        storageUrl: welcomeUrl,
      });
      await db
        .update(flipcastRequests)
        .set({ welcomeAudioUrl: welcomeUrl, updatedAt: new Date() })
        .where(eq(flipcastRequests.id, requestId));

      await emit("welcome_ready", requestId, {
        message: "Welcome message ready.",
        data: { url: welcomeUrl },
      });
    }

    // --- Stage 3..N: Generate + synthesize each scene ---
    await setStatus(requestId, "synthesizing");

    const moderatorVoice = VOICE_BY_ID.get(voiceForRole.moderator);
    if (!moderatorVoice) throw new Error("Picked voice not in catalog.");

    const priorScenesBriefs: string[] = [];
    const allSceneTurns: { sceneIndex: number; turns: TranscriptTurn[] }[] =
      [];

    const sceneItems = plan.items.filter(
      (it): it is Extract<typeof it, { kind: "scene" }> => it.kind === "scene",
    );

    // Fill missing outline focuses upfront so a prefetched next scene has
    // its focus set before we kick off its Claude call.
    for (const s of sceneItems) {
      const outlineEntry = setup.outline.find(
        (o) => o.sceneIndex === s.sceneIndex,
      );
      if (outlineEntry && !outlineEntry.focus) {
        outlineEntry.focus = defaultFocus(
          s.sceneIndex,
          plan.totalScenes,
          s.isFinal,
        );
      }
    }

    // Prefetch one scene ahead: while scene N's TTS/stitch/upload runs,
    // Claude generates scene N+1. Skipped for newscast (pre-generated).
    let nextGenPromise: Promise<{
      turns: TranscriptTurn[];
      model: string;
      usage: ClaudeCallUsage;
    }> | null = null;

    for (let i = 0; i < sceneItems.length; i++) {
      const item = sceneItems[i]!;
      const sceneIndex = item.sceneIndex;

      await emit("scene_generation_started", requestId, {
        message: `Writing scene ${sceneIndex}/${plan.totalScenes}…`,
        data: { sceneIndex, totalScenes: plan.totalScenes },
      });

      const preGenTurns = preGeneratedScenes?.get(sceneIndex);
      let turns: TranscriptTurn[];
      if (preGenTurns) {
        turns = preGenTurns;
      } else {
        const res = nextGenPromise
          ? await nextGenPromise
          : await generateScene({
              topic: request.topic,
              setup,
              sceneIndex,
              totalScenes: plan.totalScenes,
              format,
              locale,
              metadata,
              priorScenesBrief:
                priorScenesBriefs.length > 0
                  ? priorScenesBriefs.join("\n")
                  : undefined,
            });
        nextGenPromise = null;
        turns = res.turns;
        await recordUsage(res.model, res.usage);
      }

      allSceneTurns.push({ sceneIndex, turns });
      priorScenesBriefs.push(`Scene ${sceneIndex}: ${summarize(turns)}`);

      const nextItem = sceneItems[i + 1];
      if (nextItem && !preGeneratedScenes) {
        const briefForNext = priorScenesBriefs.join("\n");
        const pending = generateScene({
          topic: request.topic,
          setup,
          sceneIndex: nextItem.sceneIndex,
          totalScenes: plan.totalScenes,
          format,
          locale,
          metadata,
          priorScenesBrief: briefForNext,
        });
        // Prevent unhandled rejection if the main loop throws before we await.
        pending.catch(() => {});
        nextGenPromise = pending;
      }

      const characterByRole = new Map(
        characters.map((c) => [c.role, c] as const),
      );
      const startingSeq = await currentSegmentCount(savedTranscript.id);
      await db.insert(transcriptSegments).values(
        turns.map((t, i) => ({
          transcriptId: savedTranscript.id,
          sequenceNumber: startingSeq + i,
          sceneIndex,
          speakerRole: t.speaker,
          speakerName:
            characterByRole.get(t.speaker)?.name ??
            characterByRole.get("moderator")?.name ??
            null,
          voiceId: voiceForRole[t.speaker] || voiceForRole.moderator,
          text: t.text,
          pauseMsAfter: t.pauseMsAfter,
          isAdSegment: t.isAd,
        })),
      );

      // Transcript-only mode short-circuits Fish entirely: persist the turns
      // (already done above), update the structured transcript JSON, emit
      // scene_ready with a null url + the turns, and move on. No mp3, no
      // upload, no audio_assets row, no scene URL column update.
      if (transcriptOnly) {
        const updatedScenes = [...allSceneTurns];
        const existing =
          (savedTranscript.structuredTranscriptJson ?? {}) as Record<
            string,
            unknown
          >;
        await db
          .update(transcripts)
          .set({
            structuredTranscriptJson: {
              ...existing,
              scenes: updatedScenes,
            },
          })
          .where(eq(transcripts.id, savedTranscript.id));

        await emit("scene_ready", requestId, {
          message: `Scene ${sceneIndex}/${plan.totalScenes} ready (transcript-only).`,
          percent: Math.round((sceneIndex / plan.totalScenes) * 100),
          data: {
            sceneIndex,
            totalScenes: plan.totalScenes,
            url: null,
            turns,
            transcriptOnly: true,
          },
        });
        continue;
      }

      await emit("scene_synth_started", requestId, {
        message: `Synthesizing scene ${sceneIndex} (${turns.length} turns, fish)…`,
        data: {
          sceneIndex,
          totalScenes: plan.totalScenes,
          turnCount: turns.length,
        },
      });

      // Scene synthesis. Multi-speaker (panel/pals) is split into chunks:
      // Fish S2 Pro drifts voices on long multi-speaker calls, so we cap
      // each call at MAX_TURNS_PER_FISH_CHUNK / MAX_CHARS_PER_FISH_CHUNK,
      // render each chunk independently with the same reference_id array
      // (locking the speaker↔voice mapping), then ffmpeg-concat the mp3s.
      // Solo (newscast) scenes stay one-shot through the single-voice path.
      let mp3: Buffer;
      if (cfg.castSize > 1) {
        // Strict voice resolution — fail loud rather than silently dropping
        // a missing panelist voice (which would shift speaker indices and
        // misassign every `<|speaker:N|>` token after it).
        const requiredSlots: {
          idx: number;
          role: SpeakerRole;
          id: string | undefined;
        }[] =
          cfg.castSize === 2
            ? [
                { idx: 0, role: "moderator", id: voiceForRole.moderator },
                { idx: 1, role: "panelist_1", id: voiceForRole.panelist_1 },
              ]
            : [
                { idx: 0, role: "moderator", id: voiceForRole.moderator },
                { idx: 1, role: "panelist_1", id: voiceForRole.panelist_1 },
                { idx: 2, role: "panelist_2", id: voiceForRole.panelist_2 },
              ];
        const voices = requiredSlots.map((slot) => {
          const v = slot.id ? VOICE_BY_ID.get(slot.id) : undefined;
          if (!v) {
            throw new Error(
              `Scene ${sceneIndex}: missing voice for speaker:${slot.idx} (${slot.role}) — id="${slot.id}"`,
            );
          }
          return v;
        });

        const chunks = chunkTurnsForMultiSpeaker(turns);
        const chunkMp3s = await Promise.all(
          chunks.map((chunkTurns, chunkIdx) => {
            const multiText = chunkTurns
              .map((t) => {
                const speakerIdx = ROLE_TO_SPEAKER[t.speaker];
                const pause = pauseTagForMs(t.pauseMsAfter);
                return `<|speaker:${speakerIdx}|>${t.text}${pause}`;
              })
              .join("\n");
            return synthWithRetry({
              requestId,
              label: `scene_${sceneIndex}_chunk_${chunkIdx}`,
              data: { sceneIndex, chunkIndex: chunkIdx },
              call: () => synthesizeWithFishMulti(multiText, voices, speed),
            });
          }),
        );
        mp3 = await concatMp3s(chunkMp3s);
      } else {
        const soloText = turns
          .map((t) => `${t.text}${pauseTagForMs(t.pauseMsAfter)}`)
          .join(" ");
        const moderatorVoiceId = voiceForRole.moderator;
        if (!moderatorVoiceId) {
          throw new Error(
            `Solo scene ${sceneIndex} missing moderator voice`,
          );
        }
        mp3 = await synthWithRetry({
          requestId,
          label: `scene_${sceneIndex}_solo`,
          data: { sceneIndex },
          call: () =>
            synthesizeSegment(
              soloText,
              moderatorVoiceId,
              engineChoice,
              speed,
            ),
        });
      }

      const durationMs = await probeMp3DurationMsFromBuffer(mp3).catch(
        () => null,
      );
      const sceneKey = `requests/${requestId}/scenes/${sceneIndex}/scene.mp3`;
      const sceneUrl = await uploadObject(sceneKey, mp3, "audio/mpeg");
      await db.insert(audioAssets).values({
        flipcastRequestId: requestId,
        assetType: "scene",
        sceneIndex,
        storageUrl: sceneUrl,
        durationMs,
      });

      await db
        .update(flipcastRequests)
        .set({
          [columnForScene(sceneIndex)]: sceneUrl,
          updatedAt: new Date(),
        })
        .where(eq(flipcastRequests.id, requestId));

      const updatedScenes = [...allSceneTurns];
      const existing =
        (savedTranscript.structuredTranscriptJson ?? {}) as Record<
          string,
          unknown
        >;
      await db
        .update(transcripts)
        .set({
          structuredTranscriptJson: {
            ...existing,
            scenes: updatedScenes,
          },
        })
        .where(eq(transcripts.id, savedTranscript.id));

      await emit("scene_ready", requestId, {
        message: `Scene ${sceneIndex}/${plan.totalScenes} ready.`,
        percent: Math.round((sceneIndex / plan.totalScenes) * 100),
        data: {
          sceneIndex,
          totalScenes: plan.totalScenes,
          url: sceneUrl,
          turns,
          durationMs,
        },
      });
    }

    const flatTurns = allSceneTurns.flatMap((s) => s.turns);
    await db
      .update(transcripts)
      .set({ generatedTranscriptText: transcriptToPlainText(flatTurns) })
      .where(eq(transcripts.id, savedTranscript.id));

    // Post-generation validation pass — five checks (stale timing, missing
    // subject naming, generic filler, interchangeable speakers, overconfident
    // claims). Optional and never blocks completion; failures are logged and
    // emitted via SSE for admin visibility.
    try {
      const v = await validateEpisode({
        topic: request.topic,
        setup,
        scenes: allSceneTurns,
        metadata,
        locale,
      });
      const { model: vModel, usage: vUsage, ...checks } = v;
      await recordUsage(vModel, vUsage);
      const summary = (
        [
          "stale_timing",
          "missing_subject_naming",
          "generic_filler",
          "interchangeable_speakers",
          "overconfident_claims",
          "title_script_mismatch",
          "weak_early_payoff",
        ] as const
      )
        .map((k) => {
          const c = checks[k];
          return `${k}=${c.severity}${c.note ? ` (${c.note})` : ""}`;
        })
        .join(" | ");
      console.log(`[validate ${requestId}] ${summary}`);

      // Persist validation onto the transcript record so the admin view can
      // surface it without a separate fetch.
      const existing =
        (savedTranscript.structuredTranscriptJson ?? {}) as Record<
          string,
          unknown
        >;
      await db
        .update(transcripts)
        .set({
          structuredTranscriptJson: {
            ...existing,
            validation: checks,
          },
        })
        .where(eq(transcripts.id, savedTranscript.id));

      await emit("validation_complete", requestId, {
        message: "Quality check complete.",
        data: { validation: checks },
      });
    } catch (err) {
      console.warn(
        `[validate ${requestId}] failed; continuing without validation:`,
        err instanceof Error ? err.message : err,
      );
    }

    await db
      .update(flipcastRequests)
      .set({
        status: "complete",
        transcriptVersion: 1,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(flipcastRequests.id, requestId));

    await emit("complete", requestId, { message: "flipcast ready." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db
      .update(flipcastRequests)
      .set({
        status: "failed",
        errorMessage: message,
        updatedAt: new Date(),
      })
      .where(eq(flipcastRequests.id, requestId));
    await emit("failed", requestId, { message });
    throw err;
  }
}

async function setStatus(
  id: string,
  status:
    | "generating_transcript"
    | "synthesizing"
    | "stitching"
    | "finalizing"
    | "complete"
    | "failed",
) {
  await db
    .update(flipcastRequests)
    .set({ status, updatedAt: new Date() })
    .where(eq(flipcastRequests.id, id));
}

async function currentSegmentCount(transcriptId: string): Promise<number> {
  const rows = await db.query.transcriptSegments.findMany({
    where: eq(transcriptSegments.transcriptId, transcriptId),
    columns: { id: true },
  });
  return rows.length;
}

function transcriptToPlainText(turns: TranscriptTurn[]): string {
  return turns.map((turn) => `[${turn.speaker}] ${turn.text}`).join("\n\n");
}

function summarize(turns: TranscriptTurn[]): string {
  const joined = turns.map((t) => t.text).join(" ");
  return joined.length > 300 ? joined.slice(0, 300) + "…" : joined;
}

function defaultFocus(
  sceneIndex: number,
  totalScenes: number,
  isFinal: boolean,
): string {
  if (isFinal) return "Wrap-up: closing thoughts and sign-off.";
  if (sceneIndex === 1) return "Opening beat: frame the topic and the stakes.";
  if (sceneIndex === totalScenes - 1)
    return "Building toward the conclusion, sharpening the tension.";
  return `Scene ${sceneIndex}: deepen the conversation with fresh angles.`;
}

function columnForScene(
  sceneIndex: number,
):
  | "scene1AudioUrl"
  | "scene2AudioUrl"
  | "scene3AudioUrl"
  | "scene4AudioUrl" {
  // For longer episodes we only have 4 dedicated columns; scenes 5+ are
  // still persisted as audio_assets rows but not surfaced via a request
  // column. Frontend relies on scene_ready SSE events for URLs.
  switch (sceneIndex) {
    case 1:
      return "scene1AudioUrl";
    case 2:
      return "scene2AudioUrl";
    case 3:
      return "scene3AudioUrl";
    case 4:
      return "scene4AudioUrl";
    default:
      // For scenes beyond 4, just reuse slot 4. Not ideal, but SSE is the
      // authoritative delivery channel for URLs during live playback.
      return "scene4AudioUrl";
  }
}
