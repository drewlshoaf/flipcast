import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { FISH_VOICES, type VoiceLanguage } from "@flipcast/types";
import { synthesizeSegment } from "../src/clients/tts";

const OUT_DIR = "/app/apps/web/public/voice-samples";

// Per-voice opener tag for a bit of flair. Mix across the catalog so the
// previews don't all sound the same. "flipcast" so Fish doesn't trip
// on the literal `.` in flipcast.
const VOICE_OPENER: Record<string, string> = {
  // English
  "fa-paula": "warm",
  "fa-sarah": "excited",
  "fa-allie": "curious",
  "fa-jim": "confident",
  "fa-charlie": "low voice",
  "fa-alex": "friendly",
  // Spanish
  "fa-juan": "confident",
  "fa-valentino": "warm",
  "fa-jesus": "proud",
  "fa-maria": "delight",
  "fa-isabel": "hopeful",
  "fa-alejandra": "excited",
};

function sampleScript(
  voiceId: string,
  name: string,
  language: VoiceLanguage,
): string {
  const opener = VOICE_OPENER[voiceId] ?? "warm";
  if (language === "es") {
    return `[${opener}] Hola, me llamo ${name}, [short pause] y así sueno en flipcast.`;
  }
  return `[${opener}] Hello, my name is ${name}, [short pause] and this is what I sound like on flipcast.`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const manifest: { id: string; label: string; language: VoiceLanguage; url: string }[] = [];

  for (const voice of FISH_VOICES) {
    console.log(`[samples] ${voice.label} (${voice.id}, ${voice.language})`);
    const mp3 = await synthesizeSegment(
      sampleScript(voice.id, voice.label, voice.language),
      voice.id,
      "fish",
    );
    const outPath = join(OUT_DIR, `${voice.id}.mp3`);
    await writeFile(outPath, mp3);
    manifest.push({
      id: voice.id,
      label: voice.label,
      language: voice.language,
      url: `/voice-samples/${voice.id}.mp3`,
    });
    console.log(`[samples]   wrote ${outPath} (${(mp3.length / 1024).toFixed(1)} KB)`);
  }

  await writeFile(
    join(OUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  console.log("[samples] wrote manifest.json");
  console.log("[samples] done");
}

main().catch((err) => {
  console.error("[samples] failed:", err);
  process.exit(1);
});
