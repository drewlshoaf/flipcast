import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { VOICE_BY_ID } from "@flipaudio/types";
import { synthesizeSegment } from "../src/clients/tts";

const OUT_DIR = "/app/apps/web/public/station";

// Branded station intro — played before the first ad on every Flip.audio.
const INTRO_VOICE_ID = "fa-paula";
const INTRO_TEXT =
  "Thanks for choosing Flip.audio. We're assembling your Flip.audio and will be with you shortly — right after these short ads.";

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const voice = VOICE_BY_ID.get(INTRO_VOICE_ID);
  if (!voice) throw new Error(`Unknown voice id: ${INTRO_VOICE_ID}`);

  console.log(`[intro] ${voice.label} (fish s2-pro)`);
  const mp3 = await synthesizeSegment(INTRO_TEXT, INTRO_VOICE_ID, "fish");
  const path = join(OUT_DIR, "intro.mp3");
  await writeFile(path, mp3);
  console.log(`[intro]   wrote ${path} (${(mp3.length / 1024).toFixed(1)} KB)`);
}

main().catch((err) => {
  console.error("[intro] failed:", err);
  process.exit(1);
});
