import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { VOICE_BY_ID, type TtsEngine } from "@flipaudio/types";
import { synthesizeSegment } from "../src/clients/tts";

const OUT_DIR = "/app/apps/web/public/ads";

interface AdSpec {
  index: number;
  product: string;
  voiceId: string;
  engine: TtsEngine;
  text: string;
}

// Each ad targets ~25 seconds (~60-65 words). Voices rotate across the six
// Fish Audio s2-pro voices so no two consecutive ads share a reader.
const ADS: AdSpec[] = [
  {
    index: 1,
    product: "NapkinSleep Mattress",
    voiceId: "fa-jim",
    engine: "fish",
    text:
      "Real talk — I spent years sleeping like I'd lost a bet. Pillow wars, midnight thermostat battles, the works. Then I switched to a Napkin mattress. Cooling foam, pressure-mapped support, a three-hundred-sixty-five-night return policy — zero regret. I actually look forward to Sundays now. Head to flip dot audio and enter promo code NAPKIN for twenty percent off. Sweet dreams.",
  },
  {
    index: 2,
    product: "FarmBox Meal Kits",
    voiceId: "fa-paula",
    engine: "fish",
    text:
      "Last Tuesday I ate dry cereal standing over the kitchen sink. Not my finest hour. FarmBox meal kits fixed it — farm-fresh ingredients, twenty-minute recipes, and no more weeknight panic at six-thirty. They even pre-measure the spices, which is honestly emotional support. Go to flip dot audio and enter promo code FARMBOX to get your first four meals free.",
  },
  {
    index: 3,
    product: "LedgerMind Finance App",
    voiceId: "fa-alex",
    engine: "fish",
    text:
      "Seventy percent of us have no idea where last month's money actually went. Terrifying, right? LedgerMind is the finance app that fixes it — automatic categorization, scary-accurate forecasts, and zero shame notifications at two in the morning. You can finally see what's going on without hating yourself. Head to flip dot audio and enter promo code LEDGER for three months free.",
  },
  {
    index: 4,
    product: "NightShade VPN",
    voiceId: "fa-charlie",
    engine: "fish",
    text:
      "Quick question — when did you last actually read a privacy policy? Right, exactly. NightShade VPN handles the hard part for you. Military-grade encryption, a strict no-logs policy, and it runs faster on bad hotel wifi than the hotel itself. Two clicks and you're covered on every device. Go to flip dot audio and enter promo code NIGHTSHADE for two months free.",
  },
  {
    index: 5,
    product: "BrightKettle Coffee",
    voiceId: "fa-sarah",
    engine: "fish",
    text:
      "I can spot a bad cup of coffee from across the room. Stale, burned, just sad. BrightKettle fixes that — small-batch beans, roasted the morning they ship, and on your doorstep within forty-eight hours of roast. Tastes like someone who actually cares about coffee made it. Head to flip dot audio and enter promo code BRIGHTKETTLE for fifteen dollars off your first bag.",
  },
  {
    index: 6,
    product: "Anvil Fitness",
    voiceId: "fa-allie",
    engine: "fish",
    text:
      "Quick gym confession — I avoided strength training for years because every app felt like a spreadsheet. Anvil Fitness fixed it for me. Ten-minute routines, coach-designed, and built around your actual schedule, not some fantasy version of your life. You just show up. Go to flip dot audio and enter promo code ANVIL — your first month is free.",
  },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const ad of ADS) {
    const voice = VOICE_BY_ID.get(ad.voiceId);
    if (!voice) throw new Error(`Unknown voice id: ${ad.voiceId}`);
    console.log(
      `[ads] ${ad.index}/${ADS.length}: ${ad.product} — ${voice.label} (${ad.engine})`,
    );
    const mp3 = await synthesizeSegment(ad.text, ad.voiceId, ad.engine);
    const outPath = join(OUT_DIR, `ad-${ad.index}.mp3`);
    await writeFile(outPath, mp3);
    console.log(
      `[ads]   wrote ${outPath} (${(mp3.length / 1024).toFixed(1)} KB)`,
    );
  }

  const manifest = ADS.map((ad) => ({
    index: ad.index,
    product: ad.product,
    voice: VOICE_BY_ID.get(ad.voiceId)?.label ?? ad.voiceId,
    engine: ad.engine,
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
