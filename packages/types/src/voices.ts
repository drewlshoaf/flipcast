export type TtsEngine =
  | "neural"
  | "long-form"
  | "generative"
  | "standard"
  | "elevenlabs"
  | "elevenlabs-flash"
  | "elevenlabs-narration";

/** @deprecated use TtsEngine */
export type PollyEngine = TtsEngine;

export type TtsProvider = "polly" | "elevenlabs";

export type VoiceOrigin =
  | "american"
  | "british"
  | "german"
  | "french"
  | "generic";

export interface VoiceOption {
  id: string;
  label: string;
  gender: "male" | "female" | "neutral";
  engines: TtsEngine[];
  provider: TtsProvider;
  origin: VoiceOrigin;
  providerVoiceId?: string;
}

const ELEVEN_ENGINES: TtsEngine[] = [
  "elevenlabs",
  "elevenlabs-flash",
  "elevenlabs-narration",
];

export const VOICES: VoiceOption[] = [
  // --- AWS Polly (kept so ads generator still works, not user-exposed) ---
  { id: "Joanna", label: "Joanna", gender: "female", engines: ["neural"], provider: "polly", origin: "american" },
  { id: "Matthew", label: "Matthew", gender: "male", engines: ["neural", "generative"], provider: "polly", origin: "american" },
  { id: "Ruth", label: "Ruth", gender: "female", engines: ["neural", "long-form", "generative"], provider: "polly", origin: "american" },
  { id: "Stephen", label: "Stephen", gender: "male", engines: ["neural", "long-form", "generative"], provider: "polly", origin: "american" },
  { id: "Kendra", label: "Kendra", gender: "female", engines: ["neural"], provider: "polly", origin: "american" },
  { id: "Kimberly", label: "Kimberly", gender: "female", engines: ["neural"], provider: "polly", origin: "american" },
  { id: "Salli", label: "Salli", gender: "female", engines: ["neural"], provider: "polly", origin: "american" },
  { id: "Joey", label: "Joey", gender: "male", engines: ["neural"], provider: "polly", origin: "american" },
  { id: "Ivy", label: "Ivy", gender: "female", engines: ["neural"], provider: "polly", origin: "american" },
  { id: "Justin", label: "Justin", gender: "male", engines: ["neural"], provider: "polly", origin: "american" },
  { id: "Danielle", label: "Danielle", gender: "female", engines: ["long-form", "generative"], provider: "polly", origin: "american" },
  { id: "Gregory", label: "Gregory", gender: "male", engines: ["long-form", "generative"], provider: "polly", origin: "american" },

  // --- ElevenLabs (user-facing voice pool) ---
  { id: "el-lauren", label: "Lauren", gender: "female", engines: ELEVEN_ENGINES, provider: "elevenlabs", origin: "american", providerVoiceId: "DODLEQrClDo8wCz460ld" },
  { id: "el-jon", label: "Jon", gender: "male", engines: ELEVEN_ENGINES, provider: "elevenlabs", origin: "american", providerVoiceId: "sB7vwSCyX0tQmU24cW2C" },
  { id: "el-elise", label: "Elise", gender: "female", engines: ELEVEN_ENGINES, provider: "elevenlabs", origin: "french", providerVoiceId: "EST9Ui6982FZPSi7gCHi" },
  { id: "el-michael", label: "Michael", gender: "male", engines: ELEVEN_ENGINES, provider: "elevenlabs", origin: "american", providerVoiceId: "ljX1ZrXuDIIRVcmiVSyR" },
  { id: "el-josef", label: "Josef", gender: "male", engines: ELEVEN_ENGINES, provider: "elevenlabs", origin: "german", providerVoiceId: "QF9HJC7XWnue5c9W3LkY" },
  { id: "el-jessica", label: "Jessica", gender: "female", engines: ELEVEN_ENGINES, provider: "elevenlabs", origin: "american", providerVoiceId: "gIc8QsaPK81pJ73KJ6Oc" },
  { id: "el-hans", label: "Hans", gender: "male", engines: ELEVEN_ENGINES, provider: "elevenlabs", origin: "german", providerVoiceId: "4yye0QE5YPsKbMOCGGlj" },
  { id: "el-chris", label: "Chris", gender: "male", engines: ELEVEN_ENGINES, provider: "elevenlabs", origin: "american", providerVoiceId: "B5wiYbiNK3GCUhkdcM4n" },
];

export const ELEVENLABS_VOICES: VoiceOption[] = VOICES.filter(
  (v) => v.provider === "elevenlabs",
);

export const VOICE_IDS = new Set(VOICES.map((v) => v.id));
export const VOICE_BY_ID = new Map(VOICES.map((v) => [v.id, v] as const));

export function voicesForEngine(engine: TtsEngine): VoiceOption[] {
  return VOICES.filter((v) => v.engines.includes(engine));
}

export function resolveProviderVoiceId(voice: VoiceOption): string {
  return voice.providerVoiceId ?? voice.id;
}

// ---------------- Format + vibe catalog ----------------

export const AVAILABLE_FORMATS = [
  {
    id: "panel",
    label: "Panel Discussion",
    description: "Three distinct voices debating the topic.",
    castSize: 3,
    engine: "elevenlabs" as const,
  },
  {
    id: "newscast",
    label: "News Anchor",
    description: "A single anchor delivering a crisp news-style report.",
    castSize: 1,
    engine: "elevenlabs" as const,
  },
] as const;

export type FlipcastFormat = (typeof AVAILABLE_FORMATS)[number]["id"];

export function formatConfig(format: FlipcastFormat) {
  const cfg = AVAILABLE_FORMATS.find((f) => f.id === format);
  if (!cfg) throw new Error(`Unknown format: ${format}`);
  return cfg;
}

export const AVAILABLE_VIBES = [
  { id: "serious", label: "Serious", description: "Measured, thoughtful, weighty." },
  { id: "playful", label: "Playful", description: "Lighthearted, witty, casual." },
  { id: "dramatic", label: "Dramatic", description: "High-stakes, vivid, emotionally heightened." },
  { id: "informative", label: "Informative", description: "Clear, authoritative, teacherly." },
  { id: "heated", label: "Heated", description: "Sharp disagreements, strong opinions." },
  { id: "chill", label: "Chill", description: "Relaxed, conversational, easygoing." },
  { id: "conspiratorial", label: "Conspiratorial", description: "Curious, suspicious, digging for the real story." },
  { id: "inspirational", label: "Inspirational", description: "Uplifting, motivating, forward-looking." },
] as const;

export type FlipcastVibe = (typeof AVAILABLE_VIBES)[number]["id"];
export const VIBE_IDS = AVAILABLE_VIBES.map((v) => v.id) as readonly FlipcastVibe[];

// ---------------- Sequence planning ----------------

export const AD_SECONDS = 15;
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

// ElevenLabs accepts voice_settings.speed between 0.7 and 1.2 (1.0 = normal).
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

/** Fixed Flipcast playback sequence:
 *   station_intro (~10s) → 3 × ad (15s) → welcome (~30s) → ad (15s)
 *   → scene 1 (120s) → ad (15s) → scene 2 (120s) → ad (15s) → scene 3 (60s, final)
 * Total: ~430s (~7:10). The `_lengthMinutes` parameter is currently ignored;
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
    3 * AD_SECONDS +
    WELCOME_ESTIMATE_SECONDS +
    AD_SECONDS +
    MID_SCENE_SECONDS +
    AD_SECONDS +
    MID_SCENE_SECONDS +
    AD_SECONDS +
    CLOSING_SCENE_SECONDS;

  return {
    items,
    totalScenes: 3,
    totalAds: adCounter,
    estimatedSeconds,
  };
}
