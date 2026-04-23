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
  // Promo code we want listeners to enter on flipcast. Duplicated from
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
    imageUrl: "/ads/images/SLEEP.png",
    text:
      "<|speaker:0|>[exhale] Okay, [short pause] I'm done. Pillow wars, thermostat fights, three-a-m tossing — it's killing me.\n" +
      "<|speaker:1|>[chuckle] Same. Until I switched to a Napkin mattress. Cooling foam, pressure-mapped support, [emphasis] three hundred and sixty-five nights to return it.\n" +
      "<|speaker:0|>[surprised] Three sixty-five?\n" +
      "<|speaker:1|>[confident] Three sixty-five. [pause] And I actually look forward to Sundays now.\n" +
      "<|speaker:0|>[relieved] Where do I—\n" +
      "<|speaker:1|>Flipcast dot app. Promo code SLEEP. Twenty percent off.\n" +
      "<|speaker:0|>[sigh] Sweet dreams.",
  },
  {
    index: 2,
    product: "FarmBox Meal Kits",
    voiceIds: ["fa-paula"],
    targetSeconds: 25,
    promoCode: "FARM",
    accent: "emerald",
    imageUrl: "/ads/images/FARM.png",
    text:
      "[sigh] Last Tuesday I ate dry cereal [pause] standing over the kitchen sink. Not my finest hour. [short pause] FarmBox meal kits fixed it. [emphasis] Farm-fresh ingredients, twenty-minute recipes, and no more weeknight panic at six-thirty. They even pre-measure the spices — which is, honestly, [chuckle] emotional support. Go to flipcast dot app, promo code FARM. Your first four meals are on the house.",
  },
  {
    index: 3,
    product: "LedgerMind Finance App",
    voiceIds: ["fa-alex"],
    targetSeconds: 25,
    promoCode: "LEDGER",
    accent: "amber",
    imageUrl: "/ads/images/LEDGER.png",
    text:
      "[confident] Seventy percent of us have no idea where last month's money actually went. [pause] Terrifying, right? [short pause] LedgerMind is the finance app that fixes it. Automatic categorization, [emphasis] scary-accurate forecasts, and zero shame notifications at two a-m. [chuckle] You finally see what's going on without hating yourself. Flipcast dot app, promo code LEDGER. Three months free.",
  },
  {
    index: 4,
    product: "NightShade VPN",
    voiceIds: ["fa-charlie", "fa-allie"],
    targetSeconds: 25,
    promoCode: "SHADE",
    accent: "violet",
    imageUrl: "/ads/images/SHADE.png",
    text:
      "<|speaker:0|>[curious] Quick question. When did you last actually read a privacy policy?\n" +
      "<|speaker:1|>[laughing] Never. Why would I?\n" +
      "<|speaker:0|>[emphasis] Exactly. That's why NightShade VPN exists. Military-grade encryption, strict no-logs policy, and it runs [pause] faster on bad hotel wifi than the hotel itself.\n" +
      "<|speaker:1|>[surprised] Seriously?\n" +
      "<|speaker:0|>Two clicks, every device, covered. [short pause] Flipcast dot app, promo code SHADE. Two months free.\n" +
      "<|speaker:1|>[delight] Okay, sign me up.",
  },
  {
    index: 5,
    product: "BrightKettle Coffee",
    voiceIds: ["fa-sarah"],
    targetSeconds: 25,
    promoCode: "BREW",
    accent: "orange",
    imageUrl: "/ads/images/BREW.png",
    text:
      "[emphasis] I can spot a bad cup of coffee from across the room. [pause] Stale, burned — [sigh] just sad. [short pause] BrightKettle fixes it. Small-batch beans, roasted the morning they ship, on your doorstep within forty-eight hours of roast. [delight] Tastes like someone who actually cares about coffee made it. Flipcast dot app, promo code BREW. Fifteen dollars off your first bag.",
  },
  {
    index: 6,
    product: "Anvil Fitness",
    voiceIds: ["fa-allie"],
    targetSeconds: 25,
    promoCode: "LIFT",
    accent: "slate",
    imageUrl: "/ads/images/LIFT.png",
    text:
      "[chuckle] Gym confession — [short pause] I avoided strength training for years. Every app felt like a spreadsheet. [pause] Then Anvil Fitness fixed it. [emphasis] Ten-minute routines, coach-designed, built around your actual schedule — not some fantasy version of your life. You just show up. [confident] Flipcast dot app, promo code LIFT. Your first month is free.",
  },
];

export const AD_BY_INDEX = new Map(AD_POOL.map((a) => [a.index, a]));

// Spanish-locale ad pool. Same products + promo codes + accents + imageUrls
// as the English pool; scripts rewritten in Spanish and voiced by the
// Spanish Fish voices. Files live at /ads/es/ad-{index}.mp3.
export const AD_POOL_ES: AdMeta[] = [
  {
    index: 1,
    product: "NapkinSleep Mattress",
    voiceIds: ["fa-juan", "fa-maria"],
    targetSeconds: 25,
    promoCode: "SLEEP",
    accent: "indigo",
    imageUrl: "/ads/images/SLEEP.png",
    text:
      "<|speaker:0|>[exhale] A ver, [short pause] ya no puedo. Peleas por la almohada, el termostato, me despierto a las tres de la mañana — me está matando.\n" +
      "<|speaker:1|>[chuckle] Igual yo. Hasta que cambié al colchón Napkin. Espuma refrescante, soporte inteligente, [emphasis] trescientas sesenta y cinco noches para devolverlo.\n" +
      "<|speaker:0|>[surprised] ¿Trescientas sesenta y cinco?\n" +
      "<|speaker:1|>[confident] Trescientas sesenta y cinco. [pause] Y ahora hasta espero los domingos.\n" +
      "<|speaker:0|>[relieved] ¿Dónde lo—\n" +
      "<|speaker:1|>Flipcast punto app. Código SLEEP. Veinte por ciento de descuento.\n" +
      "<|speaker:0|>[sigh] Dulces sueños.",
  },
  {
    index: 2,
    product: "FarmBox Meal Kits",
    voiceIds: ["fa-isabel"],
    targetSeconds: 25,
    promoCode: "FARM",
    accent: "emerald",
    imageUrl: "/ads/images/FARM.png",
    text:
      "[sigh] El martes pasado cené cereal seco [pause] parada frente al fregadero. No fue mi mejor momento. [short pause] Los kits FarmBox lo arreglaron. [emphasis] Ingredientes del día, recetas de veinte minutos, y se acabó el pánico a las seis y media. Hasta miden las especias — lo cual, honestamente, [chuckle] es apoyo emocional. Entra a flipcast punto app, código FARM. Tus primeras cuatro comidas van por la casa.",
  },
  {
    index: 3,
    product: "LedgerMind Finance App",
    voiceIds: ["fa-valentino"],
    targetSeconds: 25,
    promoCode: "LEDGER",
    accent: "amber",
    imageUrl: "/ads/images/LEDGER.png",
    text:
      "[confident] El setenta por ciento no tenemos idea en qué se fue la plata del mes pasado. [pause] Aterrador, ¿no? [short pause] LedgerMind es la app de finanzas que lo arregla. Categorización automática, [emphasis] proyecciones alucinantes, y cero notificaciones de culpa a las dos de la mañana. [chuckle] Al fin entiendes tus gastos sin odiarte. Flipcast punto app, código LEDGER. Tres meses gratis.",
  },
  {
    index: 4,
    product: "NightShade VPN",
    voiceIds: ["fa-jesus", "fa-alejandra"],
    targetSeconds: 25,
    promoCode: "SHADE",
    accent: "violet",
    imageUrl: "/ads/images/SHADE.png",
    text:
      "<|speaker:0|>[curious] Rápido. ¿Cuándo leíste una política de privacidad de verdad?\n" +
      "<|speaker:1|>[laughing] Nunca. ¿Para qué?\n" +
      "<|speaker:0|>[emphasis] Exacto. Por eso existe NightShade VPN. Encriptación nivel militar, política estricta de cero registros, y corre [pause] más rápido en wifi de hotel que el hotel mismo.\n" +
      "<|speaker:1|>[surprised] ¿En serio?\n" +
      "<|speaker:0|>Dos clics, todos tus dispositivos, protegidos. [short pause] Flipcast punto app, código SHADE. Dos meses gratis.\n" +
      "<|speaker:1|>[delight] Listo, me apunto.",
  },
  {
    index: 5,
    product: "BrightKettle Coffee",
    voiceIds: ["fa-maria"],
    targetSeconds: 25,
    promoCode: "BREW",
    accent: "orange",
    imageUrl: "/ads/images/BREW.png",
    text:
      "[emphasis] Huelo un mal café desde el otro lado de la sala. [pause] Rancio, quemado — [sigh] triste. [short pause] BrightKettle lo arregla. Granos de lote pequeño, tostados la mañana que los envían, en tu puerta en menos de cuarenta y ocho horas del tueste. [delight] Sabe como si alguien que ama el café lo hubiera preparado. Flipcast punto app, código BREW. Quince dólares de descuento en tu primera bolsa.",
  },
  {
    index: 6,
    product: "Anvil Fitness",
    voiceIds: ["fa-alejandra"],
    targetSeconds: 25,
    promoCode: "LIFT",
    accent: "slate",
    imageUrl: "/ads/images/LIFT.png",
    text:
      "[chuckle] Confesión de gimnasio — [short pause] evité entrenar fuerza por años. Cada app parecía una hoja de cálculo. [pause] Hasta que llegó Anvil Fitness. [emphasis] Rutinas de diez minutos, diseñadas por coaches, pensadas para tu agenda real — no una versión fantasía de tu vida. Solo te presentas. [confident] Flipcast punto app, código LIFT. Tu primer mes es gratis.",
  },
];

export const AD_BY_INDEX_ES = new Map(AD_POOL_ES.map((a) => [a.index, a]));

export function adPoolForLocale(locale: "en" | "es"): AdMeta[] {
  return locale === "es" ? AD_POOL_ES : AD_POOL;
}

export function adByIndexFor(locale: "en" | "es"): Map<number, AdMeta> {
  return locale === "es" ? AD_BY_INDEX_ES : AD_BY_INDEX;
}

// When the plan allocates N ad slots, the player cycles through the rotation
// returned by /api/ads/rotation (random 5-of-6). For reporting purposes we
// use the deterministic fallback order: slot i → ad-{i+1}.
export function adForSlot(slotIndex: number): AdMeta {
  const poolSize = AD_POOL.length;
  const ad = AD_POOL[slotIndex % poolSize];
  if (!ad) throw new Error(`No ad for slot ${slotIndex}`);
  return ad;
}
