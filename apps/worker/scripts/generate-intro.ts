import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { VOICE_BY_ID } from "@flipcast/types";
import { synthesizeSegment } from "../src/clients/tts";

const OUT_DIR = "/app/apps/web/public/station";

// Branded station intro — played before the first ad on every flipcast.
// Two genders so the intro voice can match the cast (a female-majority
// cast gets the female intro, otherwise male). Output paths:
//   /station/intro-male.mp3, /station/intro-female.mp3
// The trailing [pause] is a Fish S2 Pro tail guard — prevents the synth
// from clipping the final clause.
const INTROS = [
  {
    gender: "male",
    voiceId: "fa-charlie",
    text:
      "[excited] Welcome to flipcast — [short pause] where YOU make the show. [confident] We're spinning yours up right now — [short pause] enjoy a quick word from our sponsors.\n[pause]",
  },
  {
    gender: "female",
    voiceId: "fa-paula",
    text:
      "[excited] Welcome to flipcast — [short pause] where YOU make the show. [confident] We're spinning yours up right now — [short pause] enjoy a quick word from our sponsors.\n[pause]",
  },
] as const;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const intro of INTROS) {
    const voice = VOICE_BY_ID.get(intro.voiceId);
    if (!voice) throw new Error(`Unknown voice id: ${intro.voiceId}`);

    console.log(`[intro:${intro.gender}] ${voice.label} (fish s2-pro)`);
    const mp3 = await synthesizeSegment(intro.text, intro.voiceId, "fish");
    const path = join(OUT_DIR, `intro-${intro.gender}.mp3`);
    await writeFile(path, mp3);
    console.log(
      `[intro:${intro.gender}]   wrote ${path} (${(mp3.length / 1024).toFixed(1)} KB)`,
    );
  }
}

main().catch((err) => {
  console.error("[intro] failed:", err);
  process.exit(1);
});
