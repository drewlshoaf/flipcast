// Renders the chemistry preview MP3 for every voice group in the catalog.
// Each script is a tiny multi-speaker exchange (~7-8s) that mixes crosstalk,
// laughter, sarcasm, or straight conduction, and ends with one host saying
// the brand line ("This is how we sound on flipcast." / "Así sonamos en
// flipcast."). Output paths line up with the previewUrl convention used by
// the studio's group cards.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  VOICE_BY_ID,
  VOICE_GROUPS,
  type VoiceGroup,
  type VoiceOption,
} from "@flipcast/types";
import { synthesizeWithFish, synthesizeWithFishMulti } from "../src/clients/fish";

const OUT_DIR = "/app/apps/web/public/voice-groups";

// Hand-written multi-speaker scripts keyed by group id. Speaker 0/1/2 map to
// voiceIds[0/1/2] in voice-groups.ts. Tags use Fish S2 Pro vocabulary; the
// final speaker turn always contains the brand line so it lands cleanly.
const SCRIPTS: Record<string, string> = {
  // -------- Pals (EN) --------
  "pals-en-1":
    "<|speaker:0|>Did you ever finish that thing?\n" +
    "<|speaker:1|>[chuckle] Honestly... no.\n" +
    "<|speaker:0|>Anyway. This is how we sound on flipcast.",

  "pals-en-2":
    "<|speaker:0|>So I figured I'd ask you first.\n" +
    "<|speaker:1|>[chuckle] Smart move.\n" +
    "<|speaker:0|>This is how we sound on flipcast.",

  "pals-en-3":
    "<|speaker:0|>[excited] Okay but hear me out —\n" +
    "<|speaker:1|>[low voice] I'm always listening.\n" +
    "<|speaker:0|>[chuckle] This is how we sound on flipcast.",

  // -------- Panel (EN) --------
  "panel-en-1":
    "<|speaker:0|>[warm] Welcome in. We've got two of my favorite people.\n" +
    "<|speaker:1|>[excited] Hi, hi, hi.\n" +
    "<|speaker:2|>[curious] Are we going somewhere spicy today?\n" +
    "<|speaker:0|>[chuckle] This is how we sound on flipcast.",

  "panel-en-2":
    "<|speaker:0|>[friendly] Alright, the gang's all here.\n" +
    "<|speaker:1|>[excited] [chuckle] Finally.\n" +
    "<|speaker:2|>[low voice] Took you long enough.\n" +
    "<|speaker:0|>[delight] This is how we sound on flipcast.",

  "panel-en-3":
    "<|speaker:0|>Boys, what'd I miss?\n" +
    "<|speaker:1|>Not much, honestly.\n" +
    "<|speaker:2|>[chuckle] He's being modest.\n" +
    "<|speaker:0|>This is how we sound on flipcast.",

  // -------- Pals (ES) --------
  "pals-es-1":
    "<|speaker:0|>Te lo digo en serio.\n" +
    "<|speaker:1|>[chuckle] Y yo te digo que no.\n" +
    "<|speaker:0|>Pues vamos a ver.\n" +
    "<|speaker:1|>Así sonamos en flipcast.",

  "pals-es-2":
    "<|speaker:0|>¿Y qué le dijiste?\n" +
    "<|speaker:1|>Lo que tú le hubieras dicho.\n" +
    "<|speaker:0|>[chuckle] Eso me imaginé. Así sonamos en flipcast.",

  "pals-es-3":
    "<|speaker:0|>[curious] ¿Crees que tiene sentido?\n" +
    "<|speaker:1|>[low voice] Más del que parece.\n" +
    "<|speaker:0|>[delight] Así sonamos en flipcast.",

  // -------- Panel (ES) --------
  "panel-es-1":
    "<|speaker:0|>[confident] Bienvenidas a la conversación de hoy.\n" +
    "<|speaker:1|>[excited] ¡Vamos!\n" +
    "<|speaker:2|>[chuckle] Esto se va a poner bueno.\n" +
    "<|speaker:0|>[delight] Así sonamos en flipcast.",

  "panel-es-2":
    "<|speaker:0|>[confident] Caballeros, tema serio hoy.\n" +
    "<|speaker:1|>[chuckle] Siempre dices lo mismo.\n" +
    "<|speaker:2|>[curious] Esta vez sí lo es, ¿no?\n" +
    "<|speaker:0|>[confident] Así sonamos en flipcast.",

  "panel-es-3":
    "<|speaker:0|>Aquí estamos los tres.\n" +
    "<|speaker:1|>Y como siempre, llego tarde.\n" +
    "<|speaker:2|>[chuckle] No es para tanto. Empezamos.\n" +
    "<|speaker:0|>Así sonamos en flipcast.",
};

function voicesFor(group: VoiceGroup): VoiceOption[] {
  return group.voiceIds.map((id) => {
    const v = VOICE_BY_ID.get(id);
    if (!v) throw new Error(`Unknown voice id: ${id}`);
    return v;
  });
}

// Some Fish reference clips (Valentino's especially) are long enough that
// combining them in a single multi-speaker call exceeds Fish's per-request
// reference budget. Fallback: parse the `<|speaker:N|>` script into per-turn
// segments, render each with its single voice, and raw-concat the mp3s.
// MP3 frame headers self-sync, so byte concat plays correctly in browsers.
async function renderPerSpeakerThenConcat(
  script: string,
  voices: VoiceOption[],
): Promise<Buffer> {
  const TOKEN_RE = /<\|speaker:(\d+)\|>/g;
  type Turn = { speakerIdx: number; text: string };
  const turns: Turn[] = [];
  let match: RegExpExecArray | null;
  let lastIdx = -1;
  let lastSpeaker = 0;
  let lastEnd = 0;

  while ((match = TOKEN_RE.exec(script)) !== null) {
    if (lastIdx >= 0) {
      const text = script.slice(lastEnd, match.index).trim();
      if (text) turns.push({ speakerIdx: lastSpeaker, text });
    }
    lastSpeaker = Number(match[1]);
    lastEnd = TOKEN_RE.lastIndex;
    lastIdx++;
  }
  if (lastEnd < script.length) {
    const text = script.slice(lastEnd).trim();
    if (text) turns.push({ speakerIdx: lastSpeaker, text });
  }

  const buffers: Buffer[] = [];
  for (const turn of turns) {
    const voice = voices[turn.speakerIdx];
    if (!voice) {
      throw new Error(
        `Per-speaker fallback: no voice at index ${turn.speakerIdx}`,
      );
    }
    const mp3 = await synthesizeWithFish(turn.text, voice, "fish");
    buffers.push(mp3);
  }
  return Buffer.concat(buffers);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  let i = 0;
  for (const group of VOICE_GROUPS) {
    i++;
    const script = SCRIPTS[group.id];
    if (!script) {
      console.warn(
        `[group-intros] ${i}/${VOICE_GROUPS.length}: ${group.id} — no script, skipping`,
      );
      continue;
    }
    const voices = voicesFor(group);
    const labels = voices.map((v) => v.label).join(" + ");
    console.log(
      `[group-intros] ${i}/${VOICE_GROUPS.length}: ${group.id} — ${labels}`,
    );
    try {
      let mp3: Buffer;
      try {
        mp3 = await synthesizeWithFishMulti(script, voices);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Reference audio too long")) {
          console.warn(
            `[group-intros]   multi failed (reference too long), falling back to per-speaker concat`,
          );
          mp3 = await renderPerSpeakerThenConcat(script, voices);
        } else {
          throw err;
        }
      }
      const outPath = join(OUT_DIR, `${group.id}.mp3`);
      await writeFile(outPath, mp3);
      console.log(
        `[group-intros]   wrote ${outPath} (${(mp3.length / 1024).toFixed(1)} KB)`,
      );
    } catch (err) {
      console.error(
        `[group-intros]   FAILED ${group.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  console.log("[group-intros] done");
}

main().catch((err) => {
  console.error("[group-intros] failed:", err);
  process.exit(1);
});
