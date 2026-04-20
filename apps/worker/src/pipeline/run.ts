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
  type TtsEngine,
  type TtsProvider,
  type Character,
  type TranscriptTurn,
  type SpeakerRole,
  type FlipcastFormat,
  type FlipcastVibe,
  type SceneOutline,
} from "@flipcast/types";
import { db } from "../db";
import { env } from "../env";
import { emit } from "../emit";
import {
  generateSetup,
  generateScene,
  generateFullNewscast,
} from "../clients/anthropic";
import { synthesizeSegment } from "../clients/tts";
import { uploadObject } from "../clients/s3";
import { stitchSegments } from "./stitch";

const CONCURRENCY_LIMIT: Record<TtsProvider, number> = {
  elevenlabs: 3,
  polly: 10,
};

export async function runPipeline(requestId: string): Promise<void> {
  const request = await db.query.flipcastRequests.findFirst({
    where: eq(flipcastRequests.id, requestId),
  });
  if (!request) throw new Error(`Request ${requestId} not found`);

  try {
    const engineChoice = (request.engine ?? "elevenlabs") as TtsEngine;
    const format = (request.format ?? "panel") as FlipcastFormat;
    const vibe = (request.vibe ?? "serious") as FlipcastVibe;
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
    let setup: Awaited<ReturnType<typeof generateSetup>>;
    let preGeneratedScenes: Map<number, TranscriptTurn[]> | null = null;

    if (cfg.castSize === 1) {
      const full = await generateFullNewscast({
        topic: request.topic,
        vibe,
        engine: engineChoice,
        outline,
        presetVoiceIds: usablePresetVoiceIds,
      });
      setup = full.setup;
      preGeneratedScenes = new Map(
        full.scenes.map((s) => [s.sceneIndex, s.turns]),
      );
    } else {
      setup = await generateSetup({
        topic: request.topic,
        format,
        vibe,
        engine: engineChoice,
        outline,
        presetVoiceIds: usablePresetVoiceIds,
      });
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
        rawPromptContext: { topic: request.topic, format, vibe },
        generatedTranscriptText: "",
        structuredTranscriptJson: {
          topic: request.topic,
          format,
          vibe,
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
        vibe,
      },
    });

    // --- Stage 2: Welcome synthesis ---
    await emit("welcome_synth_started", requestId, {
      message: "Recording welcome message…",
    });

    const moderator = characters.find((c) => c.role === "moderator");
    if (!moderator) throw new Error("Moderator missing from cast.");

    const welcomeAudio = await synthesizeSegment(
      setup.welcomeText,
      moderator.voiceId,
      engineChoice,
      speed,
    );
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

    // --- Stage 3..N: Generate + synthesize each scene ---
    await setStatus(requestId, "synthesizing");

    const moderatorVoice = VOICE_BY_ID.get(voiceForRole.moderator);
    if (!moderatorVoice) throw new Error("Picked voice not in catalog.");
    const provider: TtsProvider = moderatorVoice.provider;
    const concurrency = CONCURRENCY_LIMIT[provider];

    const priorScenesBriefs: string[] = [];
    const allSceneTurns: { sceneIndex: number; turns: TranscriptTurn[] }[] =
      [];

    for (const item of plan.items) {
      if (item.kind !== "scene") continue;
      const sceneIndex = item.sceneIndex;

      await emit("scene_generation_started", requestId, {
        message: `Writing scene ${sceneIndex}/${plan.totalScenes}…`,
        data: { sceneIndex, totalScenes: plan.totalScenes },
      });

      // Give Claude a one-line focus if we don't have one from the outline.
      const sceneOutline = setup.outline.find(
        (o) => o.sceneIndex === sceneIndex,
      );
      if (sceneOutline && !sceneOutline.focus) {
        sceneOutline.focus = defaultFocus(sceneIndex, plan.totalScenes, item.isFinal);
      }

      const preGenTurns = preGeneratedScenes?.get(sceneIndex);
      const { turns } = preGenTurns
        ? { turns: preGenTurns }
        : await generateScene({
            topic: request.topic,
            setup,
            sceneIndex,
            totalScenes: plan.totalScenes,
            format,
            vibe,
            priorScenesBrief:
              priorScenesBriefs.length > 0
                ? priorScenesBriefs.join("\n")
                : undefined,
          });

      allSceneTurns.push({ sceneIndex, turns });
      priorScenesBriefs.push(`Scene ${sceneIndex}: ${summarize(turns)}`);

      const characterByRole = new Map(
        characters.map((c) => [c.role, c] as const),
      );
      const startingSeq = await currentSegmentCount(savedTranscript.id);
      const savedSegments = await db
        .insert(transcriptSegments)
        .values(
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
        )
        .returning();

      await emit("scene_synth_started", requestId, {
        message: `Synthesizing scene ${sceneIndex} (${savedSegments.length} turns, ${provider})…`,
        data: {
          sceneIndex,
          totalScenes: plan.totalScenes,
          turnCount: savedSegments.length,
        },
      });

      const batches: (typeof savedSegments)[] = [];
      for (let i = 0; i < savedSegments.length; i += concurrency) {
        batches.push(savedSegments.slice(i, i + concurrency));
      }
      const segmentAudios: {
        index: number;
        buffer: Buffer;
        pauseMsAfter: number;
      }[] = [];
      for (const batch of batches) {
        const results = await Promise.all(
          batch.map(async (seg) => {
            const audio = await synthesizeSegment(
              seg.text,
              seg.voiceId,
              engineChoice,
              speed,
            );
            const key = `requests/${requestId}/scenes/${sceneIndex}/segments/${seg.sequenceNumber}.mp3`;
            const url = await uploadObject(key, audio, "audio/mpeg");
            await db.insert(audioAssets).values({
              flipcastRequestId: requestId,
              transcriptSegmentId: seg.id,
              assetType: "segment",
              sceneIndex,
              storageUrl: url,
            });
            return {
              index: seg.sequenceNumber,
              buffer: audio,
              pauseMsAfter: seg.pauseMsAfter,
            };
          }),
        );
        segmentAudios.push(...results);
      }

      const { mp3, durationMs } = await stitchSegments(segmentAudios);
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

    await db
      .update(flipcastRequests)
      .set({
        status: "complete",
        transcriptVersion: 1,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(flipcastRequests.id, requestId));

    await emit("complete", requestId, { message: "Flipcast ready." });
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
