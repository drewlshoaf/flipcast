import { VOICE_BY_ID, type TtsEngine } from "@flipcast/types";
import { synthesizeWithPolly } from "./polly";
import { synthesizeWithFish } from "./fish";

export async function synthesizeSegment(
  text: string,
  voiceId: string,
  engine: TtsEngine,
  speed?: number,
): Promise<Buffer> {
  const voice = VOICE_BY_ID.get(voiceId);
  if (!voice) throw new Error(`Unknown voice id: ${voiceId}`);
  if (!voice.engines.includes(engine)) {
    throw new Error(
      `Voice ${voice.label} does not support the ${engine} engine.`,
    );
  }

  if (voice.provider === "fish") {
    return synthesizeWithFish(text, voice, engine, speed);
  }
  // Polly: speed is ignored (legacy static asset generator only).
  return synthesizeWithPolly(text, voice, engine);
}
