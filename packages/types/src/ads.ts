// Pre-recorded ad pool metadata. Ad audio files live at /ads/ad-{index}.mp3
// and are selected via /api/ads/rotation at playback. Kept in sync with
// apps/worker/scripts/generate-ads.ts so the admin view can report
// character counts without pulling in worker-only deps.
export interface AdMeta {
  index: number;
  product: string;
  voiceId: string;
  targetSeconds: number;
  text: string;
}

export const AD_POOL: AdMeta[] = [
  {
    index: 1,
    product: "NapkinSleep Mattress",
    voiceId: "fa-jim",
    targetSeconds: 25,
    text:
      "Real talk — I spent years sleeping like I'd lost a bet. Pillow wars, midnight thermostat battles, the works. Then I switched to a Napkin mattress. Cooling foam, pressure-mapped support, a three-hundred-sixty-five-night return policy — zero regret. I actually look forward to Sundays now. Head to flipcast dot app and enter promo code NAPKIN for twenty percent off. Sweet dreams.",
  },
  {
    index: 2,
    product: "FarmBox Meal Kits",
    voiceId: "fa-paula",
    targetSeconds: 25,
    text:
      "Last Tuesday I ate dry cereal standing over the kitchen sink. Not my finest hour. FarmBox meal kits fixed it — farm-fresh ingredients, twenty-minute recipes, and no more weeknight panic at six-thirty. They even pre-measure the spices, which is honestly emotional support. Go to flipcast dot app and enter promo code FARMBOX to get your first four meals free.",
  },
  {
    index: 3,
    product: "LedgerMind Finance App",
    voiceId: "fa-alex",
    targetSeconds: 25,
    text:
      "Seventy percent of us have no idea where last month's money actually went. Terrifying, right? LedgerMind is the finance app that fixes it — automatic categorization, scary-accurate forecasts, and zero shame notifications at two in the morning. You can finally see what's going on without hating yourself. Head to flipcast dot app and enter promo code LEDGER for three months free.",
  },
  {
    index: 4,
    product: "NightShade VPN",
    voiceId: "fa-charlie",
    targetSeconds: 25,
    text:
      "Quick question — when did you last actually read a privacy policy? Right, exactly. NightShade VPN handles the hard part for you. Military-grade encryption, a strict no-logs policy, and it runs faster on bad hotel wifi than the hotel itself. Two clicks and you're covered on every device. Go to flipcast dot app and enter promo code NIGHTSHADE for two months free.",
  },
  {
    index: 5,
    product: "BrightKettle Coffee",
    voiceId: "fa-sarah",
    targetSeconds: 25,
    text:
      "I can spot a bad cup of coffee from across the room. Stale, burned, just sad. BrightKettle fixes that — small-batch beans, roasted the morning they ship, and on your doorstep within forty-eight hours of roast. Tastes like someone who actually cares about coffee made it. Head to flipcast dot app and enter promo code BRIGHTKETTLE for fifteen dollars off your first bag.",
  },
  {
    index: 6,
    product: "Anvil Fitness",
    voiceId: "fa-allie",
    targetSeconds: 25,
    text:
      "Quick gym confession — I avoided strength training for years because every app felt like a spreadsheet. Anvil Fitness fixed it for me. Ten-minute routines, coach-designed, and built around your actual schedule, not some fantasy version of your life. You just show up. Go to flipcast dot app and enter promo code ANVIL — your first month is free.",
  },
];

export const AD_BY_INDEX = new Map(AD_POOL.map((a) => [a.index, a]));

// When the plan allocates N ad slots, the player cycles through the rotation
// returned by /api/ads/rotation (random 5-of-6). For reporting purposes we
// use the deterministic fallback order: slot i → ad-{i+1}. This gives a
// stable, reproducible per-flipcast character count.
export function adForSlot(slotIndex: number): AdMeta {
  const poolSize = AD_POOL.length;
  const ad = AD_POOL[slotIndex % poolSize];
  if (!ad) throw new Error(`No ad for slot ${slotIndex}`);
  return ad;
}
