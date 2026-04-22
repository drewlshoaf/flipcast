import Anthropic from "@anthropic-ai/sdk";
import {
  transcriptTurnSchema,
  voicesForEngine,
  VOICE_BY_ID,
  AVAILABLE_VIBES,
  formatConfig,
  type Character,
  type ClaudeCallUsage,
  type EpisodeSetup,
  type TranscriptTurn,
  type TtsEngine,
  type VoiceOption,
  type FlipcastFormat,
  type FlipcastVibe,
  type SceneOutline,
} from "@flipaudio/types";

const SETUP_MODEL = "claude-sonnet-4-6";
const NEWSCAST_MODEL = "claude-sonnet-4-6";
const SCENE_MODEL = "claude-sonnet-4-6";

// Fish Audio S2 Pro accepts inline bracketed direction tags that shape
// delivery. The synth reads tags as performance cues, not speech, so
// they never land as literal audio. Reused across every prompt that
// produces spoken text so the welcome, every scene, and the solo newscast
// all get the same vocabulary.
const FISH_TAG_GUIDANCE = [
  "",
  "— VOICE DIRECTION (Fish Audio S2 Pro inline tags) —",
  "Place bracketed performance tags inside the spoken text. Tags affect the phrase around them, not the whole turn, so drop them where the performance should change. Lowercase, spelled exactly.",
  "",
  "RELIABLE PRESETS (use these first — officially supported):",
  "  Pauses & timing: [pause], [short pause]",
  "  Breath & vocals: [inhale], [exhale], [sigh], [panting], [clearing throat], [tsk]",
  "  Laughter: [laughing], [laughing tone], [chuckle], [chuckling], [audience laughter]",
  "  Emotions: [excited], [excited tone], [angry], [sad], [delight], [surprised], [shocked]",
  "  Volume & quality: [whisper], [low voice], [low volume], [loud], [shouting], [screaming], [volume up], [volume down], [echo]",
  "  Delivery: [emphasis], [singing], [interrupting], [with strong accent]",
  "",
  "FREE-FORM (also work in practice — use when a preset doesn't fit):",
  "  Pauses: [gasp], [long pause], [beat], [slight pause], [sharp inhale], [startled gasp], [deep breath], [slightly out of breath]",
  "  Emotional nuance: [nervous], [scared], [confident], [sarcastic], [curious], [disappointed], [relieved], [hopeful], [annoyed], [disgusted], [mysterious], [proud]",
  "  Delivery style: [whisper in small voice], [whispers sweetly], [laughing nervously], [professional broadcast tone], [newscaster style], [narrator], [pitch up], [pitch down], [slow], [fast], [dramatic], [monotone]",
  "",
  "RULES:",
  "  1. One or two tags per turn is usually enough. At most three stacked (e.g. `[whisper][nervous]`). More than that and delivery gets muddy.",
  "  2. Not every turn needs a tag. Use them where they meaningfully change delivery; let plain lines stay plain. Punctuation (commas, em-dashes, ellipses) already shapes pacing.",
  "  3. Match tags to the vibe — sincere stays restrained, playful leans into [laughing] / [delight] / [chuckle], curious reaches for [curious] / [mysterious], relaxed uses [sigh] / [slow] / [chuckle] sparingly.",
  "  4. Exact spelling matters: `[laughing]` and `[laugh]` are NOT the same tag. Stick to the vocabulary above or use a plain natural-language phrase in brackets if you need something specific.",
  "  5. Never use the multi-speaker syntax `<|speaker:N|>` — each turn is synthesized on its own voice.",
  "  6. Do NOT tag the verbatim ad-break transition line or the verbatim sign-off line. Leave those clean.",
].join("\n");

const ZERO_USAGE: ClaudeCallUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
};

function extractUsage(response: Anthropic.Message): ClaudeCallUsage {
  const u = response.usage as
    | {
        input_tokens?: number;
        output_tokens?: number;
        cache_read_input_tokens?: number | null;
        cache_creation_input_tokens?: number | null;
      }
    | undefined;
  return {
    inputTokens: u?.input_tokens ?? 0,
    outputTokens: u?.output_tokens ?? 0,
    cacheReadTokens: u?.cache_read_input_tokens ?? 0,
    cacheCreationTokens: u?.cache_creation_input_tokens ?? 0,
  };
}
import { z } from "zod";
import { env } from "../env";

// ---------- Panel setup tool ----------

const PANEL_SETUP_TOOL = {
  name: "emit_setup",
  description:
    "Emit the episode setup: topic context, three cast members (with voice picks), welcome message.",
  input_schema: {
    type: "object",
    properties: {
      topicContext: {
        type: "string",
        description:
          "A short (1-2 sentence) description of the requested topic, framing what the conversation will cover.",
      },
      panelists: {
        type: "array",
        description:
          "Exactly three cast members — one moderator, two panelists. Sharply distinct. Randomize names and ethnic origins across runs.",
        items: {
          type: "object",
          properties: {
            role: {
              type: "string",
              enum: ["moderator", "panelist_1", "panelist_2"],
            },
            name: { type: "string" },
            gender: { type: "string", enum: ["male", "female", "neutral"] },
            ethnicity: { type: "string" },
            bio: {
              type: "string",
              description:
                "A two-to-three-second spoken bio (~7-10 words). Used when the moderator introduces the cast.",
            },
            persona: {
              type: "string",
              description:
                "A dramatic 4-6 sentence character description covering background, personality, speaking style, signature quirk, and what makes them electric on a panel.",
            },
            voice_id: {
              type: "string",
              description:
                "Best-fit voice id from the catalog. Priority: (1) gender MUST match; (2) origin should match ethnicity as closely as possible; (3) no two cast members may share a voice.",
            },
          },
          required: ["role", "name", "gender", "ethnicity", "bio", "persona", "voice_id"],
        },
      },
      welcomeText: {
        type: "string",
        description:
          "A ~30 second (~75 words) spoken welcome message from the moderator. Frame the topic with real context (2-3 sentences), then briefly tease each of the two panelists by name with a one-line hint at the angle they'll bring. First-person moderator voice.",
      },
    },
    required: ["topicContext", "panelists", "welcomeText"],
  },
} as const;

// ---------- Solo setup tool (newscast + story) ----------

const SOLO_SETUP_TOOL = {
  name: "emit_setup",
  description:
    "Emit the episode setup: topic context, a single host, welcome message.",
  input_schema: {
    type: "object",
    properties: {
      topicContext: { type: "string" },
      panelists: {
        type: "array",
        description: "Exactly ONE host (the narrator or anchor).",
        items: {
          type: "object",
          properties: {
            role: { type: "string", enum: ["moderator"] },
            name: { type: "string" },
            gender: { type: "string", enum: ["male", "female", "neutral"] },
            ethnicity: { type: "string" },
            bio: {
              type: "string",
              description: "A short spoken bio.",
            },
            persona: {
              type: "string",
              description:
                "4-6 sentences describing the host's voice, background, and style.",
            },
            voice_id: { type: "string" },
          },
          required: ["role", "name", "gender", "ethnicity", "bio", "persona", "voice_id"],
        },
      },
      welcomeText: {
        type: "string",
        description:
          "A ~30 second (~75 words) spoken opening in the host's own first-person voice. Frame the topic with real context (3-4 sentences — what it is, why it matters, what the listener will get from this report).",
      },
    },
    required: ["topicContext", "panelists", "welcomeText"],
  },
} as const;

// ---------- Full-newscast tool (single-call solo generation) ----------

const FULL_NEWSCAST_TOOL = {
  name: "emit_newscast",
  description:
    "Emit the full newscast episode in one response: anchor setup, welcome message, and every scene's transcript.",
  input_schema: {
    type: "object",
    properties: {
      topicContext: { type: "string" },
      anchor: {
        type: "object",
        properties: {
          name: { type: "string" },
          gender: {
            type: "string",
            enum: ["male", "female", "neutral"],
          },
          ethnicity: { type: "string" },
          bio: { type: "string" },
          persona: { type: "string" },
          voice_id: {
            type: "string",
            description:
              "Best-fit voice id from the catalog. Must match the anchor's gender.",
          },
        },
        required: ["name", "gender", "ethnicity", "bio", "persona", "voice_id"],
      },
      welcomeText: {
        type: "string",
        description:
          "The host's opening words right after the station intro and first ads. ~75 words. Frame the topic with real context (3-4 sentences — what it is, why it matters right now, what the listener will get from this report). Do NOT re-greet with 'welcome to flip.audio'. End with the verbatim line: \"We'll be right with you after this ad.\"",
      },
      scenes: {
        type: "array",
        description:
          "One entry per scene, in order. Each scene opens with 'And we're back.' or 'Welcome back.' and dives into that scene's beat.",
        items: {
          type: "object",
          properties: {
            sceneIndex: { type: "number" },
            turns: {
              type: "array",
              description:
                "A handful of monologue segments for this scene; the host breaks the content into turns to allow for natural pauses. Each turn uses the anchor as speaker.",
              items: {
                type: "object",
                properties: {
                  sequence: { type: "number" },
                  text: { type: "string" },
                  pauseMsAfter: { type: "number" },
                },
                required: ["sequence", "text"],
              },
            },
          },
          required: ["sceneIndex", "turns"],
        },
      },
    },
    required: ["topicContext", "anchor", "welcomeText", "scenes"],
  },
} as const;

const fullNewscastPayloadSchema = z.object({
  topicContext: z.string().min(1),
  anchor: z.object({
    name: z.string().min(1),
    gender: z.enum(["male", "female", "neutral"]),
    ethnicity: z.string().min(1),
    bio: z.string().min(1),
    persona: z.string().min(1),
    voice_id: z.string().min(1),
  }),
  welcomeText: z.string().min(1),
  scenes: z
    .array(
      z.object({
        sceneIndex: z.number().int().min(1),
        turns: z
          .array(
            z.object({
              sequence: z.number().int().nonnegative().optional(),
              text: z.string().min(1),
              pauseMsAfter: z.number().int().nonnegative().optional(),
            }),
          )
          .min(1),
      }),
    )
    .min(2),
});

// ---------- Scene tool ----------

const SCENE_TOOL = {
  name: "emit_scene",
  description: "Emit the dialogue turns for a single scene.",
  input_schema: {
    type: "object",
    properties: {
      turns: {
        type: "array",
        items: {
          type: "object",
          properties: {
            sequence: { type: "number" },
            speaker: {
              type: "string",
              enum: ["moderator", "panelist_1", "panelist_2"],
            },
            text: { type: "string" },
            pauseMsAfter: { type: "number" },
          },
          required: ["sequence", "speaker", "text"],
        },
      },
    },
    required: ["turns"],
  },
} as const;

// ---------- Zod payload schemas ----------

const panelistSchema = z.object({
  role: z.enum(["moderator", "panelist_1", "panelist_2"]),
  name: z.string().min(1),
  gender: z.enum(["male", "female", "neutral"]),
  ethnicity: z.string().min(1),
  bio: z.string().min(1),
  persona: z.string().min(1),
  voice_id: z.string().min(1),
});

const setupPayloadSchema = z.object({
  topicContext: z.string().min(1),
  panelists: z.array(panelistSchema).min(1).max(3),
  welcomeText: z.string().min(1),
});

const scenePayloadSchema = z.object({
  turns: z.array(transcriptTurnSchema.omit({ isAd: true })).min(1),
});

// ---------- Helpers ----------

function client(): Anthropic {
  if (!env.anthropicApiKey) throw new Error("ANTHROPIC_API_KEY not set");
  return new Anthropic({ apiKey: env.anthropicApiKey });
}

function formatCatalog(pool: VoiceOption[]): string {
  return pool
    .map(
      (v) =>
        `  - id: ${v.id} | gender: ${v.gender} | origin: ${v.origin} | label: ${v.label}`,
    )
    .join("\n");
}

function pickFallbackVoice(
  gender: string,
  usedIds: Set<string>,
  pool: VoiceOption[],
): VoiceOption {
  const candidates = pool.filter(
    (v) => v.gender === gender && !usedIds.has(v.id),
  );
  if (candidates.length > 0) {
    return candidates[Math.floor(Math.random() * candidates.length)]!;
  }
  const anyUnused = pool.filter((v) => !usedIds.has(v.id));
  if (anyUnused.length > 0) {
    return anyUnused[Math.floor(Math.random() * anyUnused.length)]!;
  }
  return pool[Math.floor(Math.random() * pool.length)]!;
}

function vibeDescription(vibe: FlipcastVibe): string {
  const entry = AVAILABLE_VIBES.find((v) => v.id === vibe);
  return entry ? `${entry.label} — ${entry.description}` : vibe;
}

function formatBlurb(format: FlipcastFormat): string {
  switch (format) {
    case "panel":
      return "a three-person panel discussion — one moderator and two distinct panelists who interact with each other";
    case "pals":
      return "a two-host show — two co-equal hosts with chemistry, riffing as friends rather than interviewer/guest";
    case "newscast":
      return "a newscast — one authoritative anchor delivering a crisp, informative report, no panel interaction";
  }
}

// ---------- Public API ----------

export async function generateSetup(args: {
  topic: string;
  format: FlipcastFormat;
  vibe: FlipcastVibe;
  engine: TtsEngine;
  outline: SceneOutline[];
  presetVoiceIds?: string[]; // if the user picked voices
}): Promise<EpisodeSetup & { model: string; usage: ClaudeCallUsage }> {
  const cfg = formatConfig(args.format);
  const pool = voicesForEngine(args.engine);
  if (pool.length < cfg.castSize) {
    throw new Error(
      `Engine ${args.engine} has fewer voices than the cast size (${cfg.castSize}) for format ${args.format}.`,
    );
  }

  if (!env.anthropicApiKey) {
    return { ...stubSetup(args, pool), model: SETUP_MODEL, usage: ZERO_USAGE };
  }

  // Single-speaker formats use the solo tool. Multi-speaker formats (pals=2,
  // panel=3) share the panel tool — its panelists array accepts 1–3.
  const useSolo = cfg.castSize === 1;
  const isPals = cfg.castSize === 2;
  const toolDef = useSolo ? SOLO_SETUP_TOOL : PANEL_SETUP_TOOL;
  const roles = useSolo
    ? ["moderator"]
    : isPals
      ? ["moderator", "panelist_1"]
      : ["moderator", "panelist_1", "panelist_2"];

  let castInstructions: string;
  if (useSolo) {
    castInstructions =
      "Invent ONE news anchor — credible, authoritative, with a clear voice. Give them a plausible name, ethnicity, and short on-air bio.";
  } else if (isPals) {
    castInstructions = [
      "Invent TWO co-host characters with established chemistry — a duo who riff as equals (think a podcast pair, not interviewer/guest). They should have distinct backgrounds, temperaments, and rhythms but feel like longtime friends.",
      "Vary names and origins widely across runs. Traditional American names (Michael Davidson, Sarah Carter, David Thompson, Jennifer Walsh, Ryan Sullivan, Emily Roberts, etc.) are great and often the best fit — don't default to the same distinctive non-American names every time. AVOID repeat offenders like 'Dmitri Volkov', 'Amara Okafor', 'Priya Patel', and 'Maya Desai'. Pull from a fresh, wide pool each run.",
      "Use the role 'moderator' for the lead host (the one who opens the welcome) and 'panelist_1' for the co-host. Do NOT include a panelist_2.",
    ].join(" ");
  } else {
    castInstructions = [
      "Invent three vivid, dramatic characters: one moderator and two panelists, sharply distinct in background, temperament, and cadence.",
      "Vary names and origins widely across runs. Traditional American names (Michael Davidson, Sarah Carter, David Thompson, Jennifer Walsh, Ryan Sullivan, Emily Roberts, etc.) are great and often the best fit — don't default to the same distinctive non-American names every time. AVOID repeat offenders like 'Dmitri Volkov', 'Amara Okafor', 'Priya Patel', and 'Maya Desai' — the user has seen them too many times. Pull from a fresh, wide pool each run.",
    ].join(" ");
  }

  const voiceInstructions = args.presetVoiceIds && args.presetVoiceIds.length > 0
    ? [
        "The user has preselected voices. Assign them to roles in order:",
        ...args.presetVoiceIds.map((id, i) => `  - ${roles[i]} → ${id}`),
        "Use these exact voice_id values for the matching roles. The character's gender must match the voice's gender.",
      ].join("\n")
    : [
        "Assign a voice from the catalog to each character. Matching rules, in priority order:",
        "  1. voice.gender MUST equal the character's gender.",
        "  2. voice.origin should match the character's ethnicity as closely as possible; pick the closest-sounding option when no exact match exists.",
        "  3. No two cast members may share the same voice.",
      ].join("\n");

  const system = [
    `You are casting ${formatBlurb(args.format)} for flip.audio.`,
    castInstructions,
    `Tone/vibe: ${vibeDescription(args.vibe)}. Let this color the personas, welcome script, and voice-matching choices.`,
    "For each character, emit name, gender, a one- or two-word ethnic/accent descriptor, bio (~7-10 words, spoken out loud in the intro), and a 4-6 sentence theatrical persona.",
    useSolo
      ? "The welcome is the host's first on-air moment, AFTER a branded station intro has already greeted the listener (\"Thanks for choosing flip.audio...\"). Do NOT re-greet with \"welcome to flip.audio.\" Jump straight in — e.g. \"Hi, I'm [name]\" or \"Alright —\" — then frame the topic with real context: 3-4 sentences covering what it is, why it matters right now, and what the listener will get from this report. End with this EXACT line as the final sentence: \"We'll be right with you after this ad.\" First-person host voice, ~75 words total."
      : isPals
      ? "The welcome is spoken by the LEAD host (the moderator role) only — single voice, AFTER a branded station intro has already greeted the listener (\"Thanks for choosing flip.audio...\"). Do NOT re-greet with \"welcome to flip.audio.\" Jump straight in — e.g. \"Hi, I'm [name] — and you'll hear my partner-in-crime [co-host name] in just a sec\" — then (a) frame the topic with real context: 2-3 sentences on what it is, why it matters, and what makes it compelling right now, and (b) briefly tease the co-host (panelist_1) by name with a one-line hint at the angle they'll bring. End the welcome with this EXACT line as the final sentence (verbatim, no paraphrasing): \"We're cracking it open right after this ad.\" First-person lead-host voice, ~75 words total."
      : "The welcome is the moderator's first on-air moment, AFTER a branded station intro has already greeted the listener (\"Thanks for choosing flip.audio...\"). Do NOT re-greet with \"welcome to flip.audio.\" Jump straight in — e.g. \"Hi, I'm [name]\" — then (a) frame the topic with real context: 2-3 sentences on what it is, why it matters, and what makes it compelling right now, and (b) briefly tease each panelist by name with a one-line hint at the angle they'll bring. End the welcome with this EXACT line as the final sentence (verbatim, no paraphrasing): \"We're gathering the panelists and we'll start shortly, right after this ad.\" First-person moderator voice, ~75 words total.",
    voiceInstructions,
    "",
    `Voice catalog (engine: ${args.engine}):`,
    formatCatalog(pool),
    FISH_TAG_GUIDANCE,
    "",
    "Emit strictly via the `emit_setup` tool.",
  ].join("\n");

  const response = await client().messages.create({
    model: SETUP_MODEL,
    max_tokens: 3072,
    system,
    tools: [toolDef],
    tool_choice: { type: "tool", name: "emit_setup" },
    messages: [{ role: "user", content: `Topic: ${args.topic}` }],
  });
  const usage = extractUsage(response);

  const block = response.content.find(
    (b) => b.type === "tool_use" && b.name === "emit_setup",
  );
  if (!block || block.type !== "tool_use") {
    throw new Error("emit_setup tool output missing from model response.");
  }
  const parsed = setupPayloadSchema.parse(block.input);

  // Validate + repair voice picks.
  const usedIds = new Set<string>();
  const panelists: Character[] = parsed.panelists.map((p, i) => {
    const forcedId = args.presetVoiceIds?.[i];
    let voice: VoiceOption | undefined;
    if (forcedId) {
      voice = VOICE_BY_ID.get(forcedId);
    } else {
      voice = VOICE_BY_ID.get(p.voice_id);
    }
    if (
      !voice ||
      !voice.engines.includes(args.engine) ||
      (!forcedId && voice.gender !== p.gender) ||
      usedIds.has(voice.id)
    ) {
      voice = pickFallbackVoice(p.gender, usedIds, pool);
    }
    usedIds.add(voice.id);
    return {
      role: p.role,
      name: p.name,
      gender: p.gender,
      ethnicity: p.ethnicity,
      bio: p.bio,
      persona: p.persona,
      voiceId: voice.id,
      voiceLabel: voice.label,
    };
  });

  return {
    topicContext: parsed.topicContext,
    panelists,
    welcomeText: parsed.welcomeText,
    outline: args.outline,
    model: SETUP_MODEL,
    usage,
  };
}

export async function generateFullNewscast(args: {
  topic: string;
  vibe: FlipcastVibe;
  engine: TtsEngine;
  outline: SceneOutline[]; // sceneIndex + targetSeconds (focus left blank)
  presetVoiceIds?: string[]; // at most one voice id for solo format
}): Promise<{
  setup: EpisodeSetup;
  scenes: { sceneIndex: number; turns: TranscriptTurn[] }[];
  model: string;
  usage: ClaudeCallUsage;
}> {
  const pool = voicesForEngine(args.engine);
  if (pool.length < 1) {
    throw new Error(`Engine ${args.engine} has no voices available.`);
  }

  if (!env.anthropicApiKey) {
    return {
      ...stubFullNewscast(args, pool),
      model: NEWSCAST_MODEL,
      usage: ZERO_USAGE,
    };
  }

  const scenesBrief = args.outline
    .map((o) => {
      const isFinal = o.sceneIndex === args.outline.length;
      const targetWords = Math.round((o.targetSeconds / 60) * 150);
      return `  Scene ${o.sceneIndex} — ${o.targetSeconds}s (~${targetWords} words total). ${
        isFinal
          ? "FINAL scene: wrap-up with closing thoughts and a sign-off. Do NOT end with a 'we'll be right back' transition. BEFORE the sign-off, the host MUST ask listeners to LIKE this episode and SHARE it with one person — worked in naturally, in the host's voice. Vary the wording each time (don't copy verbatim across episodes). Examples of the spirit: 'If this landed, hit like and send it to someone who'd disagree', 'Tap the heart if we earned it — and pass it on', 'Like it, share it, you know the move'. Never sound like a corporate read."
          : "Open with 'And we're back.' / 'Welcome back.' then deliver this beat. End with the moderator transitioning to an ad break ('we'll be right back after this short break' / 'stay with us'). NEVER specify how long the break or show is — no 'back in an hour', 'back in thirty minutes', 'see you next week', or any other time reference. The break is a few seconds; do not imply otherwise."
      }`;
    })
    .join("\n");

  const voiceInstruction = args.presetVoiceIds?.[0]
    ? `The user preselected voice id "${args.presetVoiceIds[0]}" for the anchor. Use it and match the anchor's gender to the voice.`
    : [
        "Pick one voice from the catalog below for the anchor. Rules:",
        "  1. voice.gender MUST equal the anchor's gender.",
        "  2. voice.origin should match the anchor's ethnicity as closely as possible.",
      ].join("\n");

  const system = [
    "You are producing a complete newscast episode of flip.audio in a single response.",
    "Invent ONE credible, authoritative anchor — plausible name, gender, ethnicity, short on-air bio, and a 4-6 sentence persona.",
    "Vary names widely across runs. Traditional American names (Michael Davidson, Sarah Carter, David Thompson, Jennifer Walsh, etc.) are great and often the best fit — avoid defaulting to the same distinctive non-American names. AVOID 'Dmitri Volkov', 'Amara Okafor', 'Priya Patel', 'Maya Desai'.",
    `Tone/vibe: ${vibeDescription(args.vibe)}. Let it shape word choice and energy.`,
    "",
    "Write the welcome message (host's opening after the station intro + first ads) — ~75 words, framing the topic with real context (3-4 sentences — what it is, why it matters now, what the listener will get). No re-greeting with 'welcome to flip.audio'. End with the verbatim line: \"We'll be right with you after this ad.\"",
    "",
    "Then write all scenes in order. Each scene is a monologue broken into a handful of `turns` (to allow natural pauses). Target durations:",
    scenesBrief,
    "",
    voiceInstruction,
    "",
    `Voice catalog (engine: ${args.engine}):`,
    formatCatalog(pool),
    FISH_TAG_GUIDANCE,
    "",
    "Emit strictly via the `emit_newscast` tool.",
  ].join("\n");

  const response = await client().messages.create({
    model: NEWSCAST_MODEL,
    max_tokens: 6144,
    system,
    tools: [FULL_NEWSCAST_TOOL],
    tool_choice: { type: "tool", name: "emit_newscast" },
    messages: [{ role: "user", content: `Topic: ${args.topic}` }],
  });
  const usage = extractUsage(response);

  const block = response.content.find(
    (b) => b.type === "tool_use" && b.name === "emit_newscast",
  );
  if (!block || block.type !== "tool_use") {
    throw new Error("emit_newscast tool output missing from model response.");
  }
  const parsed = fullNewscastPayloadSchema.parse(block.input);

  // Resolve the anchor's voice (presetVoiceIds > Claude's pick > fallback).
  const usedIds = new Set<string>();
  const forcedId = args.presetVoiceIds?.[0];
  let voice = forcedId ? VOICE_BY_ID.get(forcedId) : VOICE_BY_ID.get(parsed.anchor.voice_id);
  if (
    !voice ||
    !voice.engines.includes(args.engine) ||
    (!forcedId && voice.gender !== parsed.anchor.gender)
  ) {
    voice = pickFallbackVoice(parsed.anchor.gender, usedIds, pool);
  }
  usedIds.add(voice.id);

  const anchor: Character = {
    role: "moderator",
    name: parsed.anchor.name,
    gender: parsed.anchor.gender,
    ethnicity: parsed.anchor.ethnicity,
    bio: parsed.anchor.bio,
    persona: parsed.anchor.persona,
    voiceId: voice.id,
    voiceLabel: voice.label,
  };

  const setup: EpisodeSetup = {
    topicContext: parsed.topicContext,
    panelists: [anchor],
    welcomeText: parsed.welcomeText,
    outline: args.outline,
  };

  const scenes = parsed.scenes
    .slice()
    .sort((a, b) => a.sceneIndex - b.sceneIndex)
    .map((s) => ({
      sceneIndex: s.sceneIndex,
      turns: s.turns.map((t, i) => ({
        sequence: typeof t.sequence === "number" ? t.sequence : i,
        speaker: "moderator" as const,
        text: t.text,
        pauseMsAfter:
          typeof t.pauseMsAfter === "number" ? t.pauseMsAfter : 150,
        isAd: false,
      })),
    }));

  return { setup, scenes, model: NEWSCAST_MODEL, usage };
}

export async function generateScene(args: {
  topic: string;
  setup: EpisodeSetup;
  sceneIndex: number;
  totalScenes: number;
  format: FlipcastFormat;
  vibe: FlipcastVibe;
  priorScenesBrief?: string;
}): Promise<{ turns: TranscriptTurn[]; model: string; usage: ClaudeCallUsage }> {
  const sceneOutline = args.setup.outline.find(
    (o) => o.sceneIndex === args.sceneIndex,
  );
  if (!sceneOutline) {
    throw new Error(`No outline entry for scene ${args.sceneIndex}`);
  }
  const isFinal = args.sceneIndex === args.totalScenes;
  const targetSeconds = sceneOutline.targetSeconds;
  const approxWords = Math.round((targetSeconds / 60) * 150);
  const cfg = formatConfig(args.format);
  const useSolo = cfg.castSize === 1;
  const isPals = cfg.castSize === 2;

  if (!env.anthropicApiKey) {
    return {
      turns: stubSceneTurns(args, targetSeconds, isFinal, useSolo),
      model: SCENE_MODEL,
      usage: ZERO_USAGE,
    };
  }

  const castBrief = args.setup.panelists
    .map(
      (c) =>
        `- ${c.role} — ${c.name} (${c.gender ?? ""}${c.ethnicity ? `, ${c.ethnicity}` : ""}): ${c.persona}`,
    )
    .join("\n");

  const outlineBrief = args.setup.outline
    .map((o) => `  Scene ${o.sceneIndex} (${o.targetSeconds}s): ${o.focus}`)
    .join("\n");

  const formatGuidance = useSolo
    ? "This is a newscast: a single anchor delivering the material in first person. All turns use speaker 'moderator'. Write in crisp, structured news-report cadence."
    : isPals
    ? [
        "This is a TWO-host conversation between equals — a duo with chemistry, not interviewer/guest. Speakers alternate between 'moderator' (the lead host) and 'panelist_1' (the co-host). Never use 'panelist_2'.",
        "",
        "Conversation dynamics:",
        "  • Keep most turns short — one or two sentences. Many turns should be even shorter: a fragment, a one-line reaction, a single word ('Right.' / 'Wait —' / 'Exactly.' / 'Oh come on.').",
        "  • The two hosts riff together — they finish each other's thoughts, push back, react audibly, and disagree without it ever feeling combative. They're friends.",
        "  • Neither host is a moderator-of-the-other. The lead host steers gently but the co-host can also shift the topic, lob a question back, or call a beat.",
        "  • Tight back-and-forth: in a 30-second chunk you should see 6–10 short turns, not 2–3 long speeches.",
        "  • Use `[chuckle]` / `[laughing]` / `[surprised]` / `[emphasis]` for quick reactions. `[interrupting]` when one cuts the other off. Let lines trail off with em-dashes when interrupted.",
        "  • Each host's voice must be unmistakable — distinct word choice, rhythm, hooks, signature reactions.",
        "",
        "Pacing (pauseMsAfter — translated to inline silence in the audio):",
        "  • Tight cross-talk / interruption: 80–180 ms.",
        "  • Natural beat / shift of topic: 300–500 ms.",
        "  • Dramatic / thoughtful pause: 800–1500 ms. Use sparingly.",
      ].join("\n")
    : [
        "This is a three-person panel — a FAST, LIVELY conversation, not three monologues in sequence.",
        "",
        "Conversation dynamics (this is the most important thing to get right):",
        "  • Keep most turns short — one or two sentences. MANY turns should be even shorter: a fragment, a one-line reaction, a single word ('Right.' / 'Wait —' / 'Exactly.' / 'Oh come on.').",
        "  • Panelists interrupt each other, finish each other's sentences, jump in mid-thought, push back, react audibly. They don't wait to be called on.",
        "  • Let panelists go at each other directly. The moderator steers and asks pointed follow-ups but does NOT have to mediate every exchange.",
        "  • Turns stack in tight back-and-forth — in a 30-second chunk of conversation you should see 6–10 short turns, not 2–3 long speeches. Aim for a heavy ratio of short reactive turns vs longer developing ones.",
        "  • Use `[interrupting]` at the start of a turn that cuts someone off. Use `[chuckle]` / `[surprised]` / `[emphasis]` for quick reactions. Let characters trail off with em-dashes when they're being cut.",
        "  • Each character's personality must be unmistakable in word choice, rhythm, and interjections — even a 4-word turn should sound like only them.",
        "",
        "Pacing (pauseMsAfter — translated to inline silence in the audio):",
        "  • Tight cross-talk / interruption: 80–180 ms. This is the default for reactive turns.",
        "  • Natural beat / shift of topic: 300–500 ms.",
        "  • Dramatic / thoughtful pause: 800–1500 ms. Use sparingly.",
      ].join("\n");

  const openingGuidance = useSolo
    ? "Open the scene with the host welcoming listeners back from the ad break — e.g. \"And we're back.\" or \"Welcome back.\" — then dive into this scene's beat."
    : isPals
    ? [
        "OPEN the scene with the lead host (moderator) welcoming listeners back from the ad break — e.g. \"And we're back.\" — then immediately bounce a thought to the co-host (panelist_1) BY NAME, or invite their reaction to something. The co-host should answer back quickly so the back-and-forth is established within the first three turns.",
        "Example opening: \"Alright, we're back. [Co-host name], I cannot stop thinking about what you said before the break.\"",
        "Alternate which host opens vs. which one drives the topic across scenes so it doesn't feel like an interview.",
      ].join(" ")
    : [
        "OPEN the scene with the moderator welcoming listeners back from the ad break — e.g. \"And we're back.\" or \"Welcome back.\" — then hand off to one of the panelists BY NAME with a specific, pointed prompt or question that launches this scene's beat.",
        "Example opening turn: \"Welcome back. [Panelist Name], you said something before the break that I want to push on — [pointed question].\"",
        "Rotate which panelist is prompted first across scenes so both panelists get handoffs.",
      ].join(" ");

  const endingGuidance = isFinal
    ? [
        `This is the FINAL scene — about ${targetSeconds} seconds of wrap-up.`,
        useSolo
          ? "After the welcome-back opening, the host delivers closing thoughts, a short reflection, and a sign-off (thanks for listening)."
          : isPals
          ? "After the welcome-back opening, both hosts trade closing thoughts — let the co-host (panelist_1) get a real beat, not just a goodbye. The lead host (moderator) delivers the actual sign-off (thanks for listening), but the co-host can chime in with a final line."
          : "After the welcome-back opening, the moderator delivers closing thoughts, thanks the panelists by name, and a thanks-for-listening sign-off.",
        "Do NOT end with a 'we'll be right back' ad transition — this is the ending.",
        "BEFORE the final sign-off, the host (moderator role) MUST ask listeners to LIKE this episode and SHARE it with someone — work it in naturally, in their own voice. Vary the wording every time. Examples of the spirit (don't copy verbatim): 'If this hit, hit the heart and pass it to one person who'd argue with us', 'Smash like, send it to your group chat', 'If you laughed even once, that's a like and a share — you know the move', 'Tap the heart if we earned it, share it with someone who needs the take'. Match the cast's vibe, never sound like a corporate read.",
      ].join(" ")
    : [
        `This is scene ${args.sceneIndex} of ${args.totalScenes} — about ${targetSeconds} seconds.`,
        "The final line of the scene MUST be the moderator delivering a brief, natural transition to an ad break — something equivalent to 'we'll be right back after this short break' or 'stay with us, more after the break'. Intentional, not abrupt.",
        "NEVER specify how long the ad break or the show is — no 'back in an hour', 'back in thirty minutes', 'after a short commercial break of about a minute', 'see you next week', or any other time reference. The break is only a few seconds of audio; do not imply otherwise.",
      ].join(" ");

  // System prompt is split so the stable portion can be cached across scene calls
  // within the same episode (5-min TTL on ephemeral cache). formatGuidance,
  // openingGuidance, vibe, and general rules don't change between scenes.
  const stableSystem = [
    `You write one scene of a flip.audio episode using the provided cast and outline.`,
    formatGuidance,
    openingGuidance,
    `Tone/vibe: ${vibeDescription(args.vibe)}. Let it shape word choice, pacing, and energy.`,
    "Lean theatrical — vivid language, strong voice, never bland.",
    FISH_TAG_GUIDANCE,
    "Emit strictly via the `emit_scene` tool.",
  ].join("\n");

  const dynamicSystem = [
    endingGuidance,
    `Target length: roughly ${targetSeconds} seconds (~${approxWords} words total across all turns).`,
  ].join("\n");

  // User message split the same way: topic/cast/outline are stable; scene focus
  // + prior-scene summary are dynamic.
  const stableUser = [
    `Topic: ${args.topic}`,
    `Topic framing: ${args.setup.topicContext}`,
    `\nCast:\n${castBrief}`,
    `\nFull scene outline:\n${outlineBrief}`,
  ].join("\n");

  const dynamicUser = [
    `\nCurrent scene focus (scene ${args.sceneIndex}): ${sceneOutline.focus}`,
    args.priorScenesBrief
      ? `\n\nWhat has already happened this episode:\n${args.priorScenesBrief}`
      : "",
  ].join("\n");

  const response = await client().messages.create({
    model: SCENE_MODEL,
    max_tokens: 2048,
    system: [
      { type: "text", text: stableSystem, cache_control: { type: "ephemeral" } },
      { type: "text", text: dynamicSystem },
    ],
    tools: [SCENE_TOOL],
    tool_choice: { type: "tool", name: "emit_scene" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: stableUser, cache_control: { type: "ephemeral" } },
          { type: "text", text: dynamicUser },
        ],
      },
    ],
  });
  const usage = extractUsage(response);

  const block = response.content.find(
    (b) => b.type === "tool_use" && b.name === "emit_scene",
  );
  if (!block || block.type !== "tool_use") {
    throw new Error("emit_scene tool output missing from model response.");
  }
  const parsed = scenePayloadSchema.parse(block.input);
  const turns: TranscriptTurn[] = parsed.turns.map((t, i) => ({
    sequence: typeof t.sequence === "number" ? t.sequence : i,
    // Force all single-speaker turns to 'moderator' regardless of what Claude picked.
    speaker: useSolo ? "moderator" : t.speaker,
    text: t.text,
    pauseMsAfter: typeof t.pauseMsAfter === "number" ? t.pauseMsAfter : 150,
    isAd: false,
  }));
  return { turns, model: SCENE_MODEL, usage };
}

// ---------- Stubs (used when ANTHROPIC_API_KEY is not set) ----------

const STUB_NAMES: {
  gender: "male" | "female";
  name: string;
  ethnicity: string;
  bio: string;
}[] = [
  // Traditional American — male
  { gender: "male", name: "Michael Davidson", ethnicity: "American", bio: "a longtime broadcast journalist from Chicago" },
  { gender: "male", name: "David Thompson", ethnicity: "American", bio: "a former trial lawyer turned podcast host" },
  { gender: "male", name: "James O'Brien", ethnicity: "American", bio: "a Boston newsroom veteran with four decades of stories" },
  { gender: "male", name: "Christopher Walsh", ethnicity: "American", bio: "a magazine features editor from Brooklyn" },
  { gender: "male", name: "Ryan Sullivan", ethnicity: "American", bio: "a sports-radio host with a second act in culture" },
  { gender: "male", name: "Mark Johnson", ethnicity: "American", bio: "a tech columnist turned cranky observer" },
  { gender: "male", name: "Kevin Murphy", ethnicity: "American", bio: "a Texas-raised essayist with a slow-building cadence" },
  { gender: "male", name: "Scott Bradley", ethnicity: "American", bio: "an economics writer who swears he's fun at parties" },
  { gender: "male", name: "Tyler Morrison", ethnicity: "American", bio: "a former congressional staffer turned commentator" },
  { gender: "male", name: "Brandon Wheeler", ethnicity: "American", bio: "a startup founder between ventures and into opinions" },
  { gender: "male", name: "Jason Palmer", ethnicity: "American", bio: "a documentary filmmaker from Atlanta" },
  { gender: "male", name: "Patrick Lane", ethnicity: "American", bio: "a historian who broke into podcasting late" },
  { gender: "male", name: "Thomas Wright", ethnicity: "American", bio: "a former diplomat with strong coffee opinions" },
  { gender: "male", name: "Kyle Donovan", ethnicity: "American", bio: "an investigative reporter out of Philly" },
  { gender: "male", name: "Nathan Stone", ethnicity: "American", bio: "a civil-rights lawyer by day, essayist by night" },
  { gender: "male", name: "Aaron Fitzgerald", ethnicity: "American", bio: "a former Army officer turned policy wonk" },
  { gender: "male", name: "Jeffrey Baker", ethnicity: "American", bio: "a hedge-fund analyst with a literature habit" },
  { gender: "male", name: "Eric Hollis", ethnicity: "American", bio: "a Midwestern English teacher turned cultural critic" },
  { gender: "male", name: "Andrew Castellano", ethnicity: "American", bio: "a former congressional reporter from D.C." },
  { gender: "male", name: "Greg Wallace", ethnicity: "American", bio: "a veteran science writer who still sends handwritten notes" },

  // Traditional American — female
  { gender: "female", name: "Sarah Carter", ethnicity: "American", bio: "a longtime newspaper columnist from Minneapolis" },
  { gender: "female", name: "Jennifer Walsh", ethnicity: "American", bio: "a former White House correspondent" },
  { gender: "female", name: "Jessica Reynolds", ethnicity: "American", bio: "a Substack writer with a cult following" },
  { gender: "female", name: "Emily Roberts", ethnicity: "American", bio: "an economics professor who left academia for media" },
  { gender: "female", name: "Lauren Bennett", ethnicity: "American", bio: "a tech-industry reporter from San Francisco" },
  { gender: "female", name: "Rebecca Hayes", ethnicity: "American", bio: "a former ad-agency strategist with a sharp tongue" },
  { gender: "female", name: "Amanda Reed", ethnicity: "American", bio: "a memoirist turned essay-podcast host" },
  { gender: "female", name: "Megan Foster", ethnicity: "American", bio: "a former public defender now writing about justice" },
  { gender: "female", name: "Stephanie Vaughn", ethnicity: "American", bio: "a food writer from Nashville with wide-ranging tastes" },
  { gender: "female", name: "Victoria Brooks", ethnicity: "American", bio: "a Brooklyn-based critic with sharp elbows" },
  { gender: "female", name: "Angela Carter", ethnicity: "American", bio: "a political scientist with a knack for a quick story" },
  { gender: "female", name: "Melissa Frank", ethnicity: "American", bio: "a business journalist from Philadelphia" },
  { gender: "female", name: "Heather Price", ethnicity: "American", bio: "a travel writer who now covers labor" },
  { gender: "female", name: "Caroline Hughes", ethnicity: "American", bio: "a former prosecutor now reporting on crime" },
  { gender: "female", name: "Rachel Greene", ethnicity: "American", bio: "a long-form essayist from upstate New York" },
  { gender: "female", name: "Nicole Langford", ethnicity: "American", bio: "a cultural anthropologist turned podcaster" },
  { gender: "female", name: "Ashley Donovan", ethnicity: "American", bio: "a former late-night TV writer from L.A." },
  { gender: "female", name: "Kristen Moore", ethnicity: "American", bio: "a climate reporter from Denver" },
  { gender: "female", name: "Natalie Chase", ethnicity: "American", bio: "a financial-literacy educator with a cult newsletter" },
  { gender: "female", name: "Erin Sutton", ethnicity: "American", bio: "a tech critic who misses having a tv to throw things at" },

  // International variety (kept modest — traditional American is the default bias)
  { gender: "female", name: "Elena Costa", ethnicity: "Portuguese", bio: "a Lisbon historian with a podcast habit" },
  { gender: "female", name: "Sofia Rossi", ethnicity: "Italian", bio: "a Milan-based design critic" },
  { gender: "female", name: "Hannah Lindqvist", ethnicity: "Swedish", bio: "a Stockholm-based behavioral economist" },
  { gender: "female", name: "Rosa Hernandez", ethnicity: "Mexican", bio: "a bilingual culture reporter from San Antonio" },
  { gender: "female", name: "Anjali Mehta", ethnicity: "Indian-American", bio: "a science journalist from the Bay Area" },
  { gender: "male", name: "Kenji Nakamura", ethnicity: "Japanese", bio: "a Tokyo-based engineer and essayist" },
  { gender: "male", name: "Liam O'Sullivan", ethnicity: "Irish", bio: "a Dublin-based political reporter" },
  { gender: "male", name: "Marco Bellini", ethnicity: "Italian", bio: "a Rome-based opera-turned-tech writer" },
  { gender: "male", name: "Chidi Okonkwo", ethnicity: "Nigerian", bio: "a Lagos-raised economist now teaching in London" },
  { gender: "male", name: "Andre Dubois", ethnicity: "French-American", bio: "a New Orleans food historian" },
];

function stubSetup(
  args: {
    topic: string;
    format: FlipcastFormat;
    vibe: FlipcastVibe;
    engine: TtsEngine;
    outline: SceneOutline[];
    presetVoiceIds?: string[];
  },
  pool: VoiceOption[],
): EpisodeSetup {
  const cfg = formatConfig(args.format);
  const shuffled = [...STUB_NAMES].sort(() => Math.random() - 0.5);
  const roles: Character["role"][] =
    cfg.castSize === 1
      ? ["moderator"]
      : ["moderator", "panelist_1", "panelist_2"];
  const used = new Set<string>();
  const panelists: Character[] = roles.map((role, i) => {
    const pick = shuffled.shift()!;
    const forcedId = args.presetVoiceIds?.[i];
    let voice = forcedId ? VOICE_BY_ID.get(forcedId) : undefined;
    if (!voice) voice = pickFallbackVoice(pick.gender, used, pool);
    used.add(voice.id);
    return {
      role,
      name: pick.name,
      gender: pick.gender,
      ethnicity: pick.ethnicity,
      bio: pick.bio,
      persona: `Stub persona for ${pick.name} — a ${args.vibe} voice on today's topic.`,
      voiceId: voice.id,
      voiceLabel: voice.label,
    };
  });

  const mod = panelists[0]!;
  const welcomeText =
    cfg.castSize === 1
      ? `Hi, I'm ${mod.name}. Today — ${args.topic}. It's one of those stories that sounds familiar at first, but there are layers here most coverage misses. In the next few minutes I'll walk you through what's happening, why it matters right now, and the quieter consequences worth paying attention to. We'll be right with you after this ad.`
      : `Hi, I'm ${mod.name}. Today's topic — ${args.topic}. It's a subject that looks simple until you pull on a thread, and then it gets surprisingly textured. Joining me: ${panelists[1]?.name}, ${panelists[1]?.bio} — expect a from-the-trenches view. And ${panelists[2]?.name}, ${panelists[2]?.bio} — expect the uncomfortable question nobody else is asking. We're gathering the panelists and we'll start shortly, right after this ad.`;

  return {
    topicContext: `A short ${args.vibe} discussion of ${args.topic}.`,
    panelists,
    welcomeText,
    outline: args.outline,
  };
}

function stubFullNewscast(
  args: {
    topic: string;
    vibe: FlipcastVibe;
    engine: TtsEngine;
    outline: SceneOutline[];
    presetVoiceIds?: string[];
  },
  pool: VoiceOption[],
): {
  setup: EpisodeSetup;
  scenes: { sceneIndex: number; turns: TranscriptTurn[] }[];
} {
  const setup = stubSetup(
    {
      topic: args.topic,
      format: "newscast",
      vibe: args.vibe,
      engine: args.engine,
      outline: args.outline,
      presetVoiceIds: args.presetVoiceIds,
    },
    pool,
  );
  const scenes = args.outline.map((o) => ({
    sceneIndex: o.sceneIndex,
    turns: stubSceneTurns(
      {
        topic: args.topic,
        setup,
        sceneIndex: o.sceneIndex,
        totalScenes: args.outline.length,
      },
      o.targetSeconds,
      o.sceneIndex === args.outline.length,
      true,
    ),
  }));
  return { setup, scenes };
}

function stubSceneTurns(
  args: {
    topic: string;
    setup: EpisodeSetup;
    sceneIndex: number;
    totalScenes: number;
  },
  targetSeconds: number,
  isFinal: boolean,
  useSolo: boolean,
): TranscriptTurn[] {
  const mod = args.setup.panelists[0]!;
  if (useSolo) {
    if (isFinal) {
      return [
        { sequence: 0, speaker: "moderator", text: `And we're back. Before we close out — here's what stuck with me about ${args.topic}.`, pauseMsAfter: 150, isAd: false },
        { sequence: 1, speaker: "moderator", text: `Thanks for listening to flip.audio — we'll see you next time.`, pauseMsAfter: 250, isAd: false },
      ];
    }
    return [
      { sequence: 0, speaker: "moderator", text: `And we're back. Here's what matters about ${args.topic}.`, pauseMsAfter: 150, isAd: false },
      { sequence: 1, speaker: "moderator", text: `The landscape shifted quickly — and most people missed the reason why.`, pauseMsAfter: 150, isAd: false },
      { sequence: 2, speaker: "moderator", text: `Hold that thought — we'll be right back after this short break.`, pauseMsAfter: 250, isAd: false },
    ];
  }
  const p1 = args.setup.panelists[1];
  const p2 = args.setup.panelists[2];
  const leadWith = args.sceneIndex % 2 === 1 ? p1 : p2;
  const followWith = leadWith === p1 ? p2 : p1;
  if (isFinal) {
    return [
      { sequence: 0, speaker: "moderator", text: `Welcome back. ${leadWith?.name}, give me the one line you want listeners to walk away with on ${args.topic}.`, pauseMsAfter: 150, isAd: false },
      { sequence: 1, speaker: leadWith === p1 ? "panelist_1" : "panelist_2", text: `Stay curious about ${args.topic}. That's the whole game.`, pauseMsAfter: 150, isAd: false },
      { sequence: 2, speaker: followWith === p1 ? "panelist_1" : "panelist_2", text: `And read something tomorrow you wouldn't normally read.`, pauseMsAfter: 150, isAd: false },
      { sequence: 3, speaker: "moderator", text: `Beautiful. Thanks ${p1?.name}, ${p2?.name}. Thanks for listening to flip.audio.`, pauseMsAfter: 200, isAd: false },
    ];
  }
  return [
    { sequence: 0, speaker: "moderator", text: `Welcome back. ${leadWith?.name}, I want to pick up where we left off — what's the part of ${args.topic} people keep getting wrong?`, pauseMsAfter: 150, isAd: false },
    { sequence: 1, speaker: leadWith === p1 ? "panelist_1" : "panelist_2", text: `The most underrated part of ${args.topic} is how fast the goalposts move.`, pauseMsAfter: 150, isAd: false },
    { sequence: 2, speaker: followWith === p1 ? "panelist_1" : "panelist_2", text: `Push back — the fundamentals haven't changed, the hype has.`, pauseMsAfter: 150, isAd: false },
    { sequence: 3, speaker: "moderator", text: `Hold that thread — we'll be right back after this short break.`, pauseMsAfter: 250, isAd: false },
  ];
}
