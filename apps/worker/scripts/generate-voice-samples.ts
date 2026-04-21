import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { FISH_VOICES } from "@flipaudio/types";
import { synthesizeSegment } from "../src/clients/tts";

const OUT_DIR = "/app/apps/web/public/voice-samples";

const SAMPLE_SCRIPT = (name: string) =>
  `Hi, I'm ${name}. This is what I sound like when I'm hosting a flip.audio.`;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const manifest: { id: string; label: string; url: string }[] = [];

  for (const voice of FISH_VOICES) {
    console.log(`[samples] ${voice.label} (${voice.id})`);
    const mp3 = await synthesizeSegment(
      SAMPLE_SCRIPT(voice.label),
      voice.id,
      "fish",
    );
    const outPath = join(OUT_DIR, `${voice.id}.mp3`);
    await writeFile(outPath, mp3);
    manifest.push({
      id: voice.id,
      label: voice.label,
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
