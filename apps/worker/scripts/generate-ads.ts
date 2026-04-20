import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { VOICE_BY_ID, type TtsEngine } from "@flipcast/types";
import { synthesizeSegment } from "../src/clients/tts";

const OUT_DIR = "/app/apps/web/public/ads";

interface AdSpec {
  index: number;
  product: string;
  voiceId: string;
  engine: TtsEngine;
  text: string;
}

// Each ad is ~38 words (~15 seconds at ElevenLabs Flash pace).
// Flash v2.5 is the faster ElevenLabs model; works well for ad reads.
const ADS: AdSpec[] = [
  {
    index: 1,
    product: "NapkinSleep Mattress",
    voiceId: "el-jon",
    engine: "elevenlabs-flash",
    text:
      "Real talk — I was sleeping like I'd lost a bet. Then I tried a Napkin mattress. Cooling foam, three-sixty-five-night return, zero regret. Napkinsleep dot com, code flipcast, twenty percent off. Sweet dreams.",
  },
  {
    index: 2,
    product: "FarmBox Meal Kits",
    voiceId: "el-jessica",
    engine: "elevenlabs-flash",
    text:
      "Last Tuesday I ate cereal for dinner standing over the sink. Not my finest hour. FarmBox fixes it — fresh ingredients, twenty-minute recipes. Farmboxmeals dot com slash podcast, code flipcast, four free meals.",
  },
  {
    index: 3,
    product: "LedgerMind Finance App",
    voiceId: "el-michael",
    engine: "elevenlabs-flash",
    text:
      "Seventy percent of us don't know where last month's money went. Terrifying. LedgerMind fixes it — automatic categorization, scary-accurate forecasts, zero shame notifications. Ledgermind dot app, code flipcast, three months free.",
  },
  {
    index: 4,
    product: "NightShade VPN",
    voiceId: "el-lauren",
    engine: "elevenlabs-flash",
    text:
      "When did you last actually read a privacy policy? Exactly. NightShade VPN handles the hard part — military-grade encryption, no logs, faster on bad wifi. Nightshadevpn dot com, code flipcast, two months free.",
  },
  {
    index: 5,
    product: "BrightKettle Coffee",
    voiceId: "el-chris",
    engine: "elevenlabs-flash",
    text:
      "I can spot a bad cup of coffee from across the room. BrightKettle roasts small-batch beans, ships within forty-eight hours of roast. Brightkettle dot com, code flipcast, fifteen dollars off your first bag.",
  },
  {
    index: 6,
    product: "Anvil Fitness",
    voiceId: "el-elise",
    engine: "elevenlabs-flash",
    text:
      "Gym pep talk — I avoided strength training for years because every app felt like a spreadsheet. Then I found Anvil. Ten-minute routines, coach-designed. Anvilfitness dot com, code flipcast, first month free.",
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
    targetSeconds: 15,
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
