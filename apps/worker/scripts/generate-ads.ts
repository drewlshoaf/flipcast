import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { VOICE_BY_ID, type TtsEngine, type VoiceOption } from "@flipaudio/types";
import { synthesizeSegment } from "../src/clients/tts";
import { synthesizeWithFishMulti } from "../src/clients/fish";

const OUT_DIR = "/app/apps/web/public/ads";

type AdSpec =
  | {
      kind: "single";
      index: number;
      product: string;
      promoCode: string;
      voiceId: string;
      engine: TtsEngine;
      text: string;
    }
  | {
      kind: "multi";
      index: number;
      product: string;
      promoCode: string;
      // Speaker 0, 1, … in order. Text must use <|speaker:N|> tokens.
      voiceIds: string[];
      engine: TtsEngine;
      text: string;
    };

// Each ad targets ~25 seconds. Tags use the full Fish S2 Pro vocabulary.
// Multi-speaker ads 1 + 4 use `<|speaker:N|>` tokens; the voiceIds array
// order maps to speaker N. Promo codes are short + spellable so they read
// cleanly after the TTS says them.
const ADS: AdSpec[] = [
  {
    kind: "multi",
    index: 1,
    product: "NapkinSleep Mattress",
    promoCode: "SLEEP",
    voiceIds: ["fa-jim", "fa-sarah"],
    engine: "fish",
    text:
      "<|speaker:0|>[exhale] Okay, [short pause] I'm done. Pillow wars, thermostat fights, three-a-m tossing — it's killing me.\n" +
      "<|speaker:1|>[chuckle] Same. Until I switched to a Napkin mattress. Cooling foam, pressure-mapped support, [emphasis] three hundred and sixty-five nights to return it.\n" +
      "<|speaker:0|>[surprised] Three sixty-five?\n" +
      "<|speaker:1|>[confident] Three sixty-five. [pause] And I actually look forward to Sundays now.\n" +
      "<|speaker:0|>[relieved] Where do I—\n" +
      "<|speaker:1|>Flip dot audio. Promo code SLEEP. Twenty percent off.\n" +
      "<|speaker:0|>[sigh] Sweet dreams.",
  },
  {
    kind: "single",
    index: 2,
    product: "FarmBox Meal Kits",
    promoCode: "FARM",
    voiceId: "fa-paula",
    engine: "fish",
    text:
      "[sigh] Last Tuesday I ate dry cereal [pause] standing over the kitchen sink. Not my finest hour. [short pause] FarmBox meal kits fixed it. [emphasis] Farm-fresh ingredients, twenty-minute recipes, and no more weeknight panic at six-thirty. They even pre-measure the spices — which is, honestly, [chuckle] emotional support. Go to flip dot audio, promo code FARM. Your first four meals are on the house.",
  },
  {
    kind: "single",
    index: 3,
    product: "LedgerMind Finance App",
    promoCode: "LEDGER",
    voiceId: "fa-alex",
    engine: "fish",
    text:
      "[confident] Seventy percent of us have no idea where last month's money actually went. [pause] Terrifying, right? [short pause] LedgerMind is the finance app that fixes it. Automatic categorization, [emphasis] scary-accurate forecasts, and zero shame notifications at two a-m. [chuckle] You finally see what's going on without hating yourself. Flip dot audio, promo code LEDGER. Three months free.",
  },
  {
    kind: "multi",
    index: 4,
    product: "NightShade VPN",
    promoCode: "SHADE",
    voiceIds: ["fa-charlie", "fa-allie"],
    engine: "fish",
    text:
      "<|speaker:0|>[curious] Quick question. When did you last actually read a privacy policy?\n" +
      "<|speaker:1|>[laughing] Never. Why would I?\n" +
      "<|speaker:0|>[emphasis] Exactly. That's why NightShade VPN exists. Military-grade encryption, strict no-logs policy, and it runs [pause] faster on bad hotel wifi than the hotel itself.\n" +
      "<|speaker:1|>[surprised] Seriously?\n" +
      "<|speaker:0|>Two clicks, every device, covered. [short pause] Flip dot audio, promo code SHADE. Two months free.\n" +
      "<|speaker:1|>[delight] Okay, sign me up.",
  },
  {
    kind: "single",
    index: 5,
    product: "BrightKettle Coffee",
    promoCode: "BREW",
    voiceId: "fa-sarah",
    engine: "fish",
    text:
      "[emphasis] I can spot a bad cup of coffee from across the room. [pause] Stale, burned — [sigh] just sad. [short pause] BrightKettle fixes it. Small-batch beans, roasted the morning they ship, on your doorstep within forty-eight hours of roast. [delight] Tastes like someone who actually cares about coffee made it. Flip dot audio, promo code BREW. Fifteen dollars off your first bag.",
  },
  {
    kind: "single",
    index: 6,
    product: "Anvil Fitness",
    promoCode: "LIFT",
    voiceId: "fa-allie",
    engine: "fish",
    text:
      "[chuckle] Gym confession — [short pause] I avoided strength training for years. Every app felt like a spreadsheet. [pause] Then Anvil Fitness fixed it. [emphasis] Ten-minute routines, coach-designed, built around your actual schedule — not some fantasy version of your life. You just show up. [confident] Flip dot audio, promo code LIFT. Your first month is free.",
  },
];

function voiceOrDie(id: string): VoiceOption {
  const v = VOICE_BY_ID.get(id);
  if (!v) throw new Error(`Unknown voice id: ${id}`);
  return v;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const ad of ADS) {
    const outPath = join(OUT_DIR, `ad-${ad.index}.mp3`);
    let mp3: Buffer;
    let voiceLabel: string;
    if (ad.kind === "multi") {
      const voices = ad.voiceIds.map(voiceOrDie);
      voiceLabel = voices.map((v) => v.label).join(" + ");
      console.log(
        `[ads] ${ad.index}/${ADS.length}: ${ad.product} — ${voiceLabel} (fish · multi)`,
      );
      mp3 = await synthesizeWithFishMulti(ad.text, voices);
    } else {
      const voice = voiceOrDie(ad.voiceId);
      voiceLabel = voice.label;
      console.log(
        `[ads] ${ad.index}/${ADS.length}: ${ad.product} — ${voiceLabel} (${ad.engine})`,
      );
      mp3 = await synthesizeSegment(ad.text, ad.voiceId, ad.engine);
    }
    await writeFile(outPath, mp3);
    console.log(
      `[ads]   wrote ${outPath} (${(mp3.length / 1024).toFixed(1)} KB)`,
    );
  }

  const manifest = ADS.map((ad) => ({
    index: ad.index,
    product: ad.product,
    promoCode: ad.promoCode,
    voice:
      ad.kind === "multi"
        ? ad.voiceIds
            .map((id) => VOICE_BY_ID.get(id)?.label ?? id)
            .join(" + ")
        : VOICE_BY_ID.get(ad.voiceId)?.label ?? ad.voiceId,
    engine: ad.engine,
    kind: ad.kind,
    url: `/ads/ad-${ad.index}.mp3`,
    targetSeconds: 25,
  }));
  await writeFile(
    join(OUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  console.log("[ads] wrote manifest.json");
  console.log("[ads] done");
}

main().catch((err) => {
  console.error("[ads] failed:", err);
  process.exit(1);
});
