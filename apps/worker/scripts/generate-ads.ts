import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { VOICE_BY_ID, type TtsEngine, type VoiceOption } from "@flipcast/types";
import { synthesizeSegment } from "../src/clients/tts";
import { synthesizeWithFishMulti } from "../src/clients/fish";

const OUT_DIR_EN = "/app/apps/web/public/ads";
const OUT_DIR_ES = "/app/apps/web/public/ads/es";

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
//
// Two parallel pools: ADS (English voices + scripts) and ADS_ES (Spanish
// voices + scripts). Same 6 products, same promo codes, same image assets.
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
      "<|speaker:1|>Flipcast dot app. Promo code SLEEP. Twenty percent off.\n" +
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
      "[sigh] Last Tuesday I ate dry cereal [pause] standing over the kitchen sink. Not my finest hour. [short pause] FarmBox meal kits fixed it. [emphasis] Farm-fresh ingredients, twenty-minute recipes, and no more weeknight panic at six-thirty. They even pre-measure the spices — which is, honestly, [chuckle] emotional support. Go to flipcast dot app, promo code FARM. Your first four meals are on the house.",
  },
  {
    kind: "single",
    index: 3,
    product: "LedgerMind Finance App",
    promoCode: "LEDGER",
    voiceId: "fa-alex",
    engine: "fish",
    text:
      "[confident] Seventy percent of us have no idea where last month's money actually went. [pause] Terrifying, right? [short pause] LedgerMind is the finance app that fixes it. Automatic categorization, [emphasis] scary-accurate forecasts, and zero shame notifications at two a-m. [chuckle] You finally see what's going on without hating yourself. Flipcast dot app, promo code LEDGER. Three months free.",
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
      "<|speaker:0|>Two clicks, every device, covered. [short pause] Flipcast dot app, promo code SHADE. Two months free.\n" +
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
      "[emphasis] I can spot a bad cup of coffee from across the room. [pause] Stale, burned — [sigh] just sad. [short pause] BrightKettle fixes it. Small-batch beans, roasted the morning they ship, on your doorstep within forty-eight hours of roast. [delight] Tastes like someone who actually cares about coffee made it. Flipcast dot app, promo code BREW. Fifteen dollars off your first bag.",
  },
  {
    kind: "single",
    index: 6,
    product: "Anvil Fitness",
    promoCode: "LIFT",
    voiceId: "fa-allie",
    engine: "fish",
    text:
      "[chuckle] Gym confession — [short pause] I avoided strength training for years. Every app felt like a spreadsheet. [pause] Then Anvil Fitness fixed it. [emphasis] Ten-minute routines, coach-designed, built around your actual schedule — not some fantasy version of your life. You just show up. [confident] Flipcast dot app, promo code LIFT. Your first month is free.",
  },
];

const ADS_ES: AdSpec[] = [
  {
    kind: "multi",
    index: 1,
    product: "NapkinSleep Mattress",
    promoCode: "SLEEP",
    voiceIds: ["fa-juan", "fa-maria"],
    engine: "fish",
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
    kind: "single",
    index: 2,
    product: "FarmBox Meal Kits",
    promoCode: "FARM",
    voiceId: "fa-isabel",
    engine: "fish",
    text:
      "[sigh] El martes pasado cené cereal seco [pause] parada frente al fregadero. No fue mi mejor momento. [short pause] Los kits FarmBox lo arreglaron. [emphasis] Ingredientes del día, recetas de veinte minutos, y se acabó el pánico a las seis y media. Hasta miden las especias — lo cual, honestamente, [chuckle] es apoyo emocional. Entra a flipcast punto app, código FARM. Tus primeras cuatro comidas van por la casa.",
  },
  {
    kind: "single",
    index: 3,
    product: "LedgerMind Finance App",
    promoCode: "LEDGER",
    voiceId: "fa-valentino",
    engine: "fish",
    text:
      "[confident] El setenta por ciento no tenemos idea en qué se fue la plata del mes pasado. [pause] Aterrador, ¿no? [short pause] LedgerMind es la app de finanzas que lo arregla. Categorización automática, [emphasis] proyecciones alucinantes, y cero notificaciones de culpa a las dos de la mañana. [chuckle] Al fin entiendes tus gastos sin odiarte. Flipcast punto app, código LEDGER. Tres meses gratis.",
  },
  {
    kind: "multi",
    index: 4,
    product: "NightShade VPN",
    promoCode: "SHADE",
    voiceIds: ["fa-jesus", "fa-alejandra"],
    engine: "fish",
    text:
      "<|speaker:0|>[curious] Rápido. ¿Cuándo leíste una política de privacidad de verdad?\n" +
      "<|speaker:1|>[laughing] Nunca. ¿Para qué?\n" +
      "<|speaker:0|>[emphasis] Exacto. Por eso existe NightShade VPN. Encriptación nivel militar, política estricta de cero registros, y corre [pause] más rápido en wifi de hotel que el hotel mismo.\n" +
      "<|speaker:1|>[surprised] ¿En serio?\n" +
      "<|speaker:0|>Dos clics, todos tus dispositivos, protegidos. [short pause] Flipcast punto app, código SHADE. Dos meses gratis.\n" +
      "<|speaker:1|>[delight] Listo, me apunto.",
  },
  {
    kind: "single",
    index: 5,
    product: "BrightKettle Coffee",
    promoCode: "BREW",
    voiceId: "fa-maria",
    engine: "fish",
    text:
      "[emphasis] Huelo un mal café desde el otro lado de la sala. [pause] Rancio, quemado — [sigh] triste. [short pause] BrightKettle lo arregla. Granos de lote pequeño, tostados la mañana que los envían, en tu puerta en menos de cuarenta y ocho horas del tueste. [delight] Sabe como si alguien que ama el café lo hubiera preparado. Flipcast punto app, código BREW. Quince dólares de descuento en tu primera bolsa.",
  },
  {
    kind: "single",
    index: 6,
    product: "Anvil Fitness",
    promoCode: "LIFT",
    voiceId: "fa-alejandra",
    engine: "fish",
    text:
      "[chuckle] Confesión de gimnasio — [short pause] evité entrenar fuerza por años. Cada app parecía una hoja de cálculo. [pause] Hasta que llegó Anvil Fitness. [emphasis] Rutinas de diez minutos, diseñadas por coaches, pensadas para tu agenda real — no una versión fantasía de tu vida. Solo te presentas. [confident] Flipcast punto app, código LIFT. Tu primer mes es gratis.",
  },
];

function voiceOrDie(id: string): VoiceOption {
  const v = VOICE_BY_ID.get(id);
  if (!v) throw new Error(`Unknown voice id: ${id}`);
  return v;
}

// Fish S2 Pro sometimes clips the final clause when the script ends on a
// terminal period (promo codes + CTAs were getting dropped). A trailing
// pause tag forces Fish to render the last words fully before cutting.
const TAIL_GUARD = "\n[pause]";

async function renderPool(
  pool: AdSpec[],
  outDir: string,
  tag: string,
  urlPrefix: string,
): Promise<void> {
  await mkdir(outDir, { recursive: true });
  for (const ad of pool) {
    const outPath = join(outDir, `ad-${ad.index}.mp3`);
    const textWithTail = ad.text + TAIL_GUARD;
    let mp3: Buffer;
    let voiceLabel: string;
    if (ad.kind === "multi") {
      const voices = ad.voiceIds.map(voiceOrDie);
      voiceLabel = voices.map((v) => v.label).join(" + ");
      console.log(
        `[ads:${tag}] ${ad.index}/${pool.length}: ${ad.product} — ${voiceLabel} (fish · multi)`,
      );
      mp3 = await synthesizeWithFishMulti(textWithTail, voices);
    } else {
      const voice = voiceOrDie(ad.voiceId);
      voiceLabel = voice.label;
      console.log(
        `[ads:${tag}] ${ad.index}/${pool.length}: ${ad.product} — ${voiceLabel} (${ad.engine})`,
      );
      mp3 = await synthesizeSegment(textWithTail, ad.voiceId, ad.engine);
    }
    await writeFile(outPath, mp3);
    console.log(
      `[ads:${tag}]   wrote ${outPath} (${(mp3.length / 1024).toFixed(1)} KB)`,
    );
  }

  const manifest = pool.map((ad) => ({
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
    url: `${urlPrefix}/ad-${ad.index}.mp3`,
    targetSeconds: 25,
  }));
  await writeFile(
    join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  console.log(`[ads:${tag}] wrote manifest.json`);
}

async function main() {
  const only = process.env.ADS_LOCALE; // optional: "en" or "es"
  if (!only || only === "en") {
    await renderPool(ADS, OUT_DIR_EN, "en", "/ads");
  }
  if (!only || only === "es") {
    await renderPool(ADS_ES, OUT_DIR_ES, "es", "/ads/es");
  }
  console.log("[ads] done");
}

main().catch((err) => {
  console.error("[ads] failed:", err);
  process.exit(1);
});
