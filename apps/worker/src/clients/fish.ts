import {
  resolveProviderVoiceId,
  type TtsEngine,
  type VoiceOption,
} from "@flipaudio/types";
import { env } from "../env";

const FISH_ENDPOINT = "https://api.fish.audio/v1/tts";
const DEFAULT_MODEL = "s2-pro";

// Process-wide cap on in-flight Fish Audio requests. Fish doesn't publish a
// documented concurrency limit — the default here is conservative. Tune via
// FISH_AUDIO_MAX_CONCURRENT.
const MAX_IN_FLIGHT = env.fishAudioMaxConcurrent;
let inFlight = 0;
const waiters: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (inFlight < MAX_IN_FLIGHT) {
    inFlight++;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  inFlight++;
}

function releaseSlot(): void {
  inFlight--;
  const next = waiters.shift();
  if (next) next();
}

function clampSpeed(speed: number | undefined): number | undefined {
  if (typeof speed !== "number" || !Number.isFinite(speed)) return undefined;
  // Fish supports 0.5–2.0.
  return Math.min(2.0, Math.max(0.5, speed));
}

export async function synthesizeWithFish(
  text: string,
  voice: VoiceOption,
  engine: TtsEngine,
  speed?: number,
): Promise<Buffer> {
  if (!env.fishAudioApiKey) {
    throw new Error("FISH_AUDIO is not set; cannot synthesize with Fish Audio.");
  }
  if (engine !== "fish") {
    throw new Error(`Fish client received unsupported engine "${engine}".`);
  }

  const body: Record<string, unknown> = {
    text,
    reference_id: resolveProviderVoiceId(voice),
    model: DEFAULT_MODEL,
    format: "mp3",
    mp3_bitrate: 128,
  };
  const clampedSpeed = clampSpeed(speed);
  if (clampedSpeed != null) {
    body.prosody = { speed: clampedSpeed };
  }

  await acquireSlot();
  try {
    const res = await fetch(FISH_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.fishAudioApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `Fish Audio TTS failed (${res.status}): ${errText.slice(0, 500)}`,
      );
    }
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } finally {
    releaseSlot();
  }
}
