// Pre-recorded ad pool metadata. Ad audio files live at /ads/ad-{index}.mp3
// and are selected via /api/ads/rotation at playback. Kept in sync with
// apps/worker/scripts/generate-ads.ts so the admin view can report
// character counts without pulling in worker-only deps.
export type AdAccent =
  | "indigo"
  | "emerald"
  | "amber"
  | "violet"
  | "orange"
  | "slate";

export interface AdMeta {
  index: number;
  product: string;
  // All voices involved in the read, in `<|speaker:N|>` order. Single-voice
  // ads have length 1.
  voiceIds: string[];
  targetSeconds: number;
  // Promo code we want listeners to enter on flip.audio. Duplicated from
  // the ad script so the UI can render it as a prominent chip.
  promoCode: string;
  // Visual accent for the in-player ad card. Fallback when imageUrl is null.
  accent: AdAccent;
  // Optional brand artwork. When null, the player renders a gradient +
  // typography card using `accent`.
  imageUrl: string | null;
  text: string;
}

export const AD_POOL: AdMeta[] = [
  {
    index: 1,
    product: "NapkinSleep Mattress",
    voiceIds: ["fa-jim", "fa-sarah"],
    targetSeconds: 25,
    promoCode: "SLEEP",
    accent: "indigo",
    imageUrl: null,
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
    index: 2,
    product: "FarmBox Meal Kits",
    voiceIds: ["fa-paula"],
    targetSeconds: 25,
    promoCode: "FARM",
    accent: "emerald",
    imageUrl: null,
    text:
      "[sigh] Last Tuesday I ate dry cereal [pause] standing over the kitchen sink. Not my finest hour. [short pause] FarmBox meal kits fixed it. [emphasis] Farm-fresh ingredients, twenty-minute recipes, and no more weeknight panic at six-thirty. They even pre-measure the spices — which is, honestly, [chuckle] emotional support. Go to flip dot audio, promo code FARM. Your first four meals are on the house.",
  },
  {
    index: 3,
    product: "LedgerMind Finance App",
    voiceIds: ["fa-alex"],
    targetSeconds: 25,
    promoCode: "LEDGER",
    accent: "amber",
    imageUrl: null,
    text:
      "[confident] Seventy percent of us have no idea where last month's money actually went. [pause] Terrifying, right? [short pause] LedgerMind is the finance app that fixes it. Automatic categorization, [emphasis] scary-accurate forecasts, and zero shame notifications at two a-m. [chuckle] You finally see what's going on without hating yourself. Flip dot audio, promo code LEDGER. Three months free.",
  },
  {
    index: 4,
    product: "NightShade VPN",
    voiceIds: ["fa-charlie", "fa-allie"],
    targetSeconds: 25,
    promoCode: "SHADE",
    accent: "violet",
    imageUrl: null,
    text:
      "<|speaker:0|>[curious] Quick question. When did you last actually read a privacy policy?\n" +
      "<|speaker:1|>[laughing] Never. Why would I?\n" +
      "<|speaker:0|>[emphasis] Exactly. That's why NightShade VPN exists. Military-grade encryption, strict no-logs policy, and it runs [pause] faster on bad hotel wifi than the hotel itself.\n" +
      "<|speaker:1|>[surprised] Seriously?\n" +
      "<|speaker:0|>Two clicks, every device, covered. [short pause] Flip dot audio, promo code SHADE. Two months free.\n" +
      "<|speaker:1|>[delight] Okay, sign me up.",
  },
  {
    index: 5,
    product: "BrightKettle Coffee",
    voiceIds: ["fa-sarah"],
    targetSeconds: 25,
    promoCode: "BREW",
    accent: "orange",
    imageUrl: null,
    text:
      "[emphasis] I can spot a bad cup of coffee from across the room. [pause] Stale, burned — [sigh] just sad. [short pause] BrightKettle fixes it. Small-batch beans, roasted the morning they ship, on your doorstep within forty-eight hours of roast. [delight] Tastes like someone who actually cares about coffee made it. Flip dot audio, promo code BREW. Fifteen dollars off your first bag.",
  },
  {
    index: 6,
    product: "Anvil Fitness",
    voiceIds: ["fa-allie"],
    targetSeconds: 25,
    promoCode: "LIFT",
    accent: "slate",
    imageUrl: null,
    text:
      "[chuckle] Gym confession — [short pause] I avoided strength training for years. Every app felt like a spreadsheet. [pause] Then Anvil Fitness fixed it. [emphasis] Ten-minute routines, coach-designed, built around your actual schedule — not some fantasy version of your life. You just show up. [confident] Flip dot audio, promo code LIFT. Your first month is free.",
  },
];

export const AD_BY_INDEX = new Map(AD_POOL.map((a) => [a.index, a]));

// When the plan allocates N ad slots, the player cycles through the rotation
// returned by /api/ads/rotation (random 5-of-6). For reporting purposes we
// use the deterministic fallback order: slot i → ad-{i+1}.
export function adForSlot(slotIndex: number): AdMeta {
  const poolSize = AD_POOL.length;
  const ad = AD_POOL[slotIndex % poolSize];
  if (!ad) throw new Error(`No ad for slot ${slotIndex}`);
  return ad;
}
