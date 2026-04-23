import { ads, createDb } from "@flipcast/server-db";
import { eq } from "drizzle-orm";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://flipcast:flipcast@postgres:5432/flipcast";
const db = createDb(databaseUrl);

interface AdSeed {
  product: string;
  voiceId: string;
  audioUrl: string;
  durationSeconds: number;
  interests: string[];
}

// Hand-curated interest tags so the rotation can target by user interest.
const SEED: AdSeed[] = [
  {
    product: "NapkinSleep Mattress",
    voiceId: "el-marcus",
    audioUrl: "/ads/ad-1.mp3",
    durationSeconds: 25,
    interests: ["wellness", "lifestyle"],
  },
  {
    product: "FarmBox Meal Kits",
    voiceId: "el-samantha",
    audioUrl: "/ads/ad-2.mp3",
    durationSeconds: 25,
    interests: ["food", "wellness"],
  },
  {
    product: "LedgerMind Finance App",
    voiceId: "el-jerry",
    audioUrl: "/ads/ad-3.mp3",
    durationSeconds: 25,
    interests: ["finance", "productivity", "business"],
  },
  {
    product: "NightShade VPN",
    voiceId: "el-marcus",
    audioUrl: "/ads/ad-4.mp3",
    durationSeconds: 25,
    interests: ["tech", "productivity"],
  },
  {
    product: "BrightKettle Coffee",
    voiceId: "el-jerry",
    audioUrl: "/ads/ad-5.mp3",
    durationSeconds: 25,
    interests: ["food", "lifestyle"],
  },
  {
    product: "Anvil Fitness",
    voiceId: "el-samantha",
    audioUrl: "/ads/ad-6.mp3",
    durationSeconds: 25,
    interests: ["wellness", "sports"],
  },
];

async function main() {
  let inserted = 0;
  let updated = 0;
  for (const ad of SEED) {
    const existing = await db.query.ads.findFirst({
      where: eq(ads.audioUrl, ad.audioUrl),
    });
    if (existing) {
      await db
        .update(ads)
        .set({
          product: ad.product,
          voiceId: ad.voiceId,
          durationSeconds: ad.durationSeconds,
          interests: ad.interests,
          active: true,
        })
        .where(eq(ads.id, existing.id));
      updated++;
      console.log(`[seed-ads] updated  ${ad.product} (${ad.audioUrl})`);
    } else {
      await db.insert(ads).values(ad);
      inserted++;
      console.log(`[seed-ads] inserted ${ad.product} (${ad.audioUrl})`);
    }
  }
  console.log(
    `[seed-ads] done — ${inserted} inserted, ${updated} updated.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed-ads] failed:", err);
  process.exit(1);
});
