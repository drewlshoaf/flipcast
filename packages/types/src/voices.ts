export type TtsEngine =
  | "neural"
  | "long-form"
  | "generative"
  | "standard"
  | "fish";

/** @deprecated use TtsEngine */
export type PollyEngine = TtsEngine;

export type TtsProvider = "polly" | "fish";

export type VoiceOrigin =
  | "american"
  | "british"
  | "german"
  | "french"
  | "spanish"
  | "generic";

export type VoiceLanguage = "en";

export interface VoiceOption {
  id: string;
  label: string;
  gender: "male" | "female" | "neutral";
  engines: TtsEngine[];
  provider: TtsProvider;
  origin: VoiceOrigin;
  language: VoiceLanguage;
  providerVoiceId?: string;
  /** Ad-read voices are excluded from the user-facing scene voice picker. */
  adOnly?: boolean;
}

export const LANGUAGES: { id: VoiceLanguage; label: string; emoji: string }[] = [
  { id: "en", label: "English", emoji: "🇺🇸" },
];

export const VOICES: VoiceOption[] = [
  // --- AWS Polly (kept for legacy Polly ad scripts, not user-exposed) ---
  { id: "Joanna", label: "Joanna", gender: "female", engines: ["neural"], provider: "polly", origin: "american", language: "en" },
  { id: "Matthew", label: "Matthew", gender: "male", engines: ["neural", "generative"], provider: "polly", origin: "american", language: "en" },
  { id: "Ruth", label: "Ruth", gender: "female", engines: ["neural", "long-form", "generative"], provider: "polly", origin: "american", language: "en" },
  { id: "Stephen", label: "Stephen", gender: "male", engines: ["neural", "long-form", "generative"], provider: "polly", origin: "american", language: "en" },
  { id: "Kendra", label: "Kendra", gender: "female", engines: ["neural"], provider: "polly", origin: "american", language: "en" },
  { id: "Kimberly", label: "Kimberly", gender: "female", engines: ["neural"], provider: "polly", origin: "american", language: "en" },
  { id: "Salli", label: "Salli", gender: "female", engines: ["neural"], provider: "polly", origin: "american", language: "en" },
  { id: "Joey", label: "Joey", gender: "male", engines: ["neural"], provider: "polly", origin: "american", language: "en" },
  { id: "Ivy", label: "Ivy", gender: "female", engines: ["neural"], provider: "polly", origin: "american", language: "en" },
  { id: "Justin", label: "Justin", gender: "male", engines: ["neural"], provider: "polly", origin: "american", language: "en" },
  { id: "Danielle", label: "Danielle", gender: "female", engines: ["long-form", "generative"], provider: "polly", origin: "american", language: "en" },
  { id: "Gregory", label: "Gregory", gender: "male", engines: ["long-form", "generative"], provider: "polly", origin: "american", language: "en" },

  // --- Fish Audio scene voices (s2-pro model). reference_id is the Fish voice id. ---
  { id: "fa-paula", label: "Paula", gender: "female", engines: ["fish"], provider: "fish", origin: "american", language: "en", providerVoiceId: "c2623f0c075b4492ac367989aee1576f" },
  { id: "fa-sarah", label: "Sarah", gender: "female", engines: ["fish"], provider: "fish", origin: "american", language: "en", providerVoiceId: "933563129e564b19a115bedd57b7406a" },
  { id: "fa-allie", label: "Allie", gender: "female", engines: ["fish"], provider: "fish", origin: "american", language: "en", providerVoiceId: "59e9dc1cb20c452584788a2690c80970" },
  { id: "fa-jim", label: "Jim", gender: "male", engines: ["fish"], provider: "fish", origin: "american", language: "en", providerVoiceId: "d8a1340984ee4b63ad1ffae27a6a4339" },
  { id: "fa-charlie", label: "Charlie", gender: "male", engines: ["fish"], provider: "fish", origin: "american", language: "en", providerVoiceId: "fb7ec16ca51a45a5a4db881244d7990a" },
  { id: "fa-alex", label: "Alex", gender: "male", engines: ["fish"], provider: "fish", origin: "american", language: "en", providerVoiceId: "c85fb11f91f84312a4bd16756f298ae2" },
];

export const FISH_VOICES: VoiceOption[] = VOICES.filter(
  (v) => v.provider === "fish" && !v.adOnly,
);

export const VOICE_IDS = new Set(VOICES.map((v) => v.id));
export const VOICE_BY_ID = new Map(VOICES.map((v) => [v.id, v] as const));

export function voicesForEngine(engine: TtsEngine): VoiceOption[] {
  return VOICES.filter((v) => v.engines.includes(engine));
}

export function resolveProviderVoiceId(voice: VoiceOption): string {
  return voice.providerVoiceId ?? voice.id;
}

// Pick the station-intro voice gender from the cast. Female-majority casts
// (or ties with at least one female) get the female intro; otherwise male.
// Unknown ids are skipped, so a partial pick still produces a sensible answer.
export function pickStationIntroGender(
  voiceIds: readonly string[],
): "male" | "female" {
  let f = 0;
  let m = 0;
  for (const id of voiceIds) {
    const v = VOICE_BY_ID.get(id);
    if (v?.gender === "female") f++;
    else if (v?.gender === "male") m++;
  }
  return f >= m && f > 0 ? "female" : "male";
}

// Path to the gendered station intro mp3 for the cast picks. English-only.
// Locale param kept on the signature for backward-compat with existing
// callers but is ignored.
export function stationIntroUrl(
  _locale: "en",
  voiceIds: readonly string[],
): string {
  const gender = pickStationIntroGender(voiceIds);
  return `/station/intro-${gender}.mp3`;
}

// ---------------- Format + vibe catalog ----------------

export const AVAILABLE_FORMATS = [
  {
    id: "newscast",
    label: "Solo",
    description: "A single host delivering a clean, authoritative report.",
    castSize: 1,
    engine: "fish" as const,
  },
  {
    id: "pals",
    label: "Pals",
    description: "Two co-hosts riffing as equals — banter, not interview.",
    castSize: 2,
    engine: "fish" as const,
  },
  {
    id: "panel",
    label: "Panel",
    description: "Three distinct voices debating the topic.",
    castSize: 3,
    engine: "fish" as const,
  },
] as const;

export type FlipcastFormat = (typeof AVAILABLE_FORMATS)[number]["id"];

export function formatConfig(format: FlipcastFormat) {
  const cfg = AVAILABLE_FORMATS.find((f) => f.id === format);
  if (!cfg) throw new Error(`Unknown format: ${format}`);
  return cfg;
}

/** UI catalog — includes unreleased formats as disabled cards. */
export type UiFormatAccent = "sky" | "pink" | "mint";
export const UI_FORMATS: {
  id: string;
  label: string;
  description: string;
  accent: UiFormatAccent;
  disabled: boolean;
}[] = [
  {
    id: "newscast",
    label: "Solo",
    description: "One host. Clean, authoritative delivery.",
    accent: "pink",
    disabled: false,
  },
  {
    id: "pals",
    label: "Pals",
    description: "Two co-hosts. Banter and chemistry.",
    accent: "mint",
    disabled: false,
  },
  {
    id: "panel",
    label: "Panel",
    description: "Three voices. Contrast and debate.",
    accent: "sky",
    disabled: false,
  },
];

export const AVAILABLE_VIBES = [
  { id: "curious", label: "Curious", description: "Inquisitive and probing." },
  { id: "playful", label: "Playful", description: "Bright and witty." },
  { id: "sincere", label: "Sincere", description: "Earnest and direct." },
  { id: "relaxed", label: "Relaxed", description: "Warm and easygoing." },
] as const;

export type FlipcastVibe = (typeof AVAILABLE_VIBES)[number]["id"];
export const VIBE_IDS = AVAILABLE_VIBES.map((v) => v.id) as readonly FlipcastVibe[];

// ---------------- Sequence planning ----------------

export const AD_SECONDS = 25;
export const WELCOME_ESTIMATE_SECONDS = 30;
export const MID_SCENE_SECONDS = 120;
export const CLOSING_SCENE_SECONDS = 60;
export const AD_INVENTORY = 6;
export const STATION_INTRO_SECONDS = 10;

export const MIN_LENGTH_MINUTES = 4;
export const MAX_LENGTH_MINUTES = 15;
export const DEFAULT_LENGTH_MINUTES = 10;

export const LENGTH_PRESETS = [
  { id: "short", label: "Short", minutes: 5, description: "~5 minutes — a quick hit." },
  { id: "long", label: "Long", minutes: 10, description: "~10 minutes — a full episode." },
  { id: "longer", label: "Longer", minutes: 15, description: "~15 minutes — a deep dive." },
] as const;

export type FlipcastLength = (typeof LENGTH_PRESETS)[number]["id"];

export function lengthPreset(id: FlipcastLength) {
  const preset = LENGTH_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Unknown length preset: ${id}`);
  return preset;
}

// Speed is scoped to 0.7–1.2 (1.0 = normal).
export const MIN_SPEED = 0.7;
export const MAX_SPEED = 1.2;
export const SPEED_STEP = 0.05;
export const FALLBACK_SPEED = 1.0;

export type SequenceItem =
  | { kind: "station_intro" }
  | { kind: "ad"; adIndex: number }
  | { kind: "welcome" }
  | {
      kind: "scene";
      sceneIndex: number;
      targetSeconds: number;
      isFinal: boolean;
    };

export interface SequencePlan {
  items: SequenceItem[];
  totalScenes: number;
  totalAds: number;
  estimatedSeconds: number;
}

/** Fixed flipcast playback sequence — never plays 3 ads in a row:
 *   station_intro (~10s) → ad (25s) → ad (25s) → welcome (~30s)
 *   → ad (25s) → scene 1 (120s) → ad (25s) → scene 2 (120s)
 *   → ad (25s) → scene 3 (60s, final)
 * Total: ~465s (~7:45). The `_lengthMinutes` parameter is currently ignored;
 * it's preserved in the signature so the request schema stays stable while
 * we iterate on sequencing.
 */
export function planSequence(_lengthMinutes?: number): SequencePlan {
  const items: SequenceItem[] = [];
  let adCounter = 0;
  const pushAd = () => {
    items.push({ kind: "ad", adIndex: adCounter % AD_INVENTORY });
    adCounter++;
  };

  items.push({ kind: "station_intro" });
  pushAd();
  pushAd();
  items.push({ kind: "welcome" });
  pushAd();
  items.push({
    kind: "scene",
    sceneIndex: 1,
    targetSeconds: MID_SCENE_SECONDS,
    isFinal: false,
  });
  pushAd();
  items.push({
    kind: "scene",
    sceneIndex: 2,
    targetSeconds: MID_SCENE_SECONDS,
    isFinal: false,
  });
  pushAd();
  items.push({
    kind: "scene",
    sceneIndex: 3,
    targetSeconds: CLOSING_SCENE_SECONDS,
    isFinal: true,
  });

  const estimatedSeconds =
    STATION_INTRO_SECONDS +
    adCounter * AD_SECONDS +
    WELCOME_ESTIMATE_SECONDS +
    2 * MID_SCENE_SECONDS +
    CLOSING_SCENE_SECONDS;

  return {
    items,
    totalScenes: 3,
    totalAds: adCounter,
    estimatedSeconds,
  };
}
