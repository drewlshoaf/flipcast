import Link from "next/link";
import { UserChip, type SessionUser } from "@/components/auth/user-chip";
import { SurpriseMe } from "@/components/home/surprise-me";
import {
  ARC_BUBBLES,
  LEFT_RAIL,
  RIGHT_RAIL,
  NEAR_CENTER,
  BOTTOM_ARC,
  v2BubbleClass,
  type PlacedBubble,
} from "@/components/home/bubbles-v2";
import { getDictionary } from "@/lib/i18n/server";
import { loadHomePromptConcepts } from "@/lib/prompt-engine";

function studioHref(topic?: string): string {
  if (!topic) return "/studio";
  return `/studio?topic=${encodeURIComponent(topic)}`;
}

// Replace only the `text` field of each bubble with an engine-generated
// prompt, preserving position/size/accent/tilt from the hand-tuned layout.
// Zones are filled in priority order (most-visible rails first) so if the
// engine pool is smaller than the total slot count, low-traffic spots keep
// their static fallback text.
function hydrateBubbles<T extends { text: string }>(
  slots: T[],
  engineTexts: string[],
  offset: number,
): T[] {
  return slots.map((slot, i) => {
    const text = engineTexts[offset + i];
    return text ? { ...slot, text } : slot;
  });
}

// Premium glossy play button. Layers several background gradients so it
// reads as a dimensional object rather than a flat pink circle:
//   - base:  pink → magenta → purple radial (top-left highlight)
//   - warm:  cool teal/mint wash along the lower-right edge
//   - sheen: soft white highlight near the upper-left
//   - aura:  blurred conic gradient ring that picks up blue/pink/mint/purple
const PLAY_BASE_GRADIENT =
  "radial-gradient(circle at 30% 22%, #fde9f3 0%, #f9a8d4 18%, #ec4899 42%, #c026d3 72%, #7c3aed 100%)";
const PLAY_TEAL_WASH =
  "radial-gradient(circle at 82% 88%, rgba(45,212,191,0.55) 0%, rgba(45,212,191,0) 52%)";
const PLAY_HIGHLIGHT =
  "radial-gradient(circle at 28% 20%, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 34%)";
const PLAY_AURA =
  "conic-gradient(from 210deg at 50% 50%, #f472b6, #a855f7, #38bdf8, #34d399, #f472b6)";

function PlacedPill({ b }: { b: PlacedBubble }) {
  return (
    <div
      className="pointer-events-auto absolute z-0 hover:z-10"
      style={{
        left: `${b.x}%`,
        top: `${b.y}%`,
        transform: `translate(-50%, -50%) rotate(${b.tilt ?? 0}deg)`,
      }}
    >
      <Link
        href={studioHref(b.text)}
        className={`inline-flex max-w-[170px] cursor-pointer items-center rounded-full text-center font-medium leading-tight ring-1 shadow-card transition hover:-translate-y-0.5 hover:scale-[1.04] hover:shadow-cardHover ${v2BubbleClass(b)}`}
      >
        {b.text}
      </Link>
    </div>
  );
}

interface HomePageV2Props {
  sessionUser: SessionUser | null;
}

export async function HomePageV2({ sessionUser }: HomePageV2Props) {
  const t = getDictionary();

  // Pull the engine pool. On failure the static layouts stand in as a
  // fallback so the hero is never empty.
  let engineTexts: string[] = [];
  try {
    const pool = await loadHomePromptConcepts({ locale: "en" });
    engineTexts = pool.concepts.map((c) => c.prompt_concept);
  } catch {
    /* keep static fallbacks */
  }

  // Hydration order = visibility priority. Rails and arc are above the fold
  // on desktop; near-center satellites are next; bottom arc last.
  const staticArc = ARC_BUBBLES;
  const staticLeft = LEFT_RAIL;
  const staticRight = RIGHT_RAIL;
  const staticNearCenter = NEAR_CENTER;
  const staticBottomArc = BOTTOM_ARC;

  let cursor = 0;
  const leftRail = hydrateBubbles(staticLeft, engineTexts, cursor);
  cursor += staticLeft.length;
  const rightRail = hydrateBubbles(staticRight, engineTexts, cursor);
  cursor += staticRight.length;
  const arc: PlacedBubble[] = hydrateBubbles(staticArc, engineTexts, cursor);
  cursor += staticArc.length;
  const nearCenter: PlacedBubble[] = hydrateBubbles(
    staticNearCenter,
    engineTexts,
    cursor,
  );
  cursor += staticNearCenter.length;
  const bottomArc: PlacedBubble[] = hydrateBubbles(
    staticBottomArc,
    engineTexts,
    cursor,
  );

  return (
    <div className="mx-auto max-w-[1320px] px-6 pt-8 pb-16 md:px-10">
      {/* Top banner */}
      <header className="mb-8 flex items-center justify-between gap-4 md:mb-12">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-gradient shadow-glow">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M7 5v14l12-7-12-7z" fill="white" />
            </svg>
          </span>
          <span className="text-lg font-semibold tracking-tight text-ink-900">
            flipcast
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          <UserChip user={sessionUser} loginNext="/studio" />
        </div>
      </header>

      {/* Hero stage */}
      <section className="relative mx-auto min-h-[720px] overflow-visible md:min-h-[780px]">
        {/* Atmospheric hero glow behind the read zone */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[42%] -z-0 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-80 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.55) 45%, rgba(255,255,255,0) 72%)",
          }}
        />

        {/* Topic rails + arc + satellites (md+ only; mobile gets a compact row below) */}
        <div className="pointer-events-none absolute inset-0 hidden md:block">
          {arc.map((b) => (
            <PlacedPill key={`arc-${b.text}`} b={b} />
          ))}
          {leftRail.map((b) => (
            <PlacedPill key={`l-${b.text}`} b={b} />
          ))}
          {rightRail.map((b) => (
            <PlacedPill key={`r-${b.text}`} b={b} />
          ))}
          {nearCenter.map((b) => (
            <PlacedPill key={`nc-${b.text}`} b={b} />
          ))}
          {bottomArc.map((b) => (
            <PlacedPill key={`ba-${b.text}`} b={b} />
          ))}
        </div>

        {/* Center-stage hero — protected read lane */}
        <div className="relative z-10 mx-auto flex max-w-[640px] flex-col items-center px-4 pt-24 text-center md:pt-40">
          {/* Premium play button */}
          <Link
            href={studioHref()}
            aria-label={t.home.startFlipAria}
            className="group relative grid h-40 w-40 place-items-center rounded-full transition hover:scale-[1.03] active:scale-[0.98] md:h-48 md:w-48"
          >
            {/* Outer multicolor aura */}
            <span
              aria-hidden
              className="absolute -inset-5 rounded-full opacity-60 blur-2xl transition group-hover:opacity-80"
              style={{ background: PLAY_AURA }}
            />
            {/* Base gradient body — layered backgrounds */}
            <span
              aria-hidden
              className="absolute inset-0 rounded-full shadow-[0_24px_60px_-18px_rgba(236,72,153,0.55),0_12px_28px_-10px_rgba(124,58,237,0.35)] ring-1 ring-white/60"
              style={{
                backgroundImage: [PLAY_HIGHLIGHT, PLAY_TEAL_WASH, PLAY_BASE_GRADIENT].join(", "),
              }}
            />
            {/* Inner sheen ring */}
            <span
              aria-hidden
              className="absolute inset-[6px] rounded-full ring-1 ring-white/40"
            />
            <svg
              className="relative z-10 ml-2 drop-shadow-[0_2px_6px_rgba(0,0,0,0.2)] md:ml-3"
              width="52"
              height="52"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <path d="M7 5v14l12-7-12-7z" fill="white" />
            </svg>
          </Link>

          <h1 className="mt-10 text-4xl font-semibold leading-[1.02] tracking-tight text-ink-900 md:text-6xl">
            <span className="bg-brand-gradient bg-clip-text text-transparent">
              {t.home.headlineLead}
            </span>{" "}
            {t.home.headlineTail}
          </h1>

          <p className="mt-5 max-w-md text-base leading-relaxed text-ink-500 md:text-lg">
            {t.home.subhead}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={studioHref()}
              className="inline-flex h-12 items-center rounded-full bg-brand-gradient px-7 text-base font-semibold text-white shadow-glow transition hover:scale-[1.02]"
            >
              {t.home.startFlip}
            </Link>
            <SurpriseMe />
          </div>
        </div>

      </section>

      {/* Mobile-only compact topic row (replaces absolute rails) */}
      <section className="mt-10 md:hidden">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">
          {t.home.tryOneOfThese}
        </div>
        <div className="flex flex-wrap gap-2">
          {[...arc, ...leftRail.slice(0, 4), ...rightRail.slice(0, 4)].map(
            (b) => (
              <Link
                key={`m-${b.text}`}
                href={studioHref(b.text)}
                className={`inline-flex max-w-[170px] items-center rounded-full text-center font-medium leading-tight ring-1 shadow-card transition hover:-translate-y-0.5 hover:shadow-cardHover ${v2BubbleClass(b)}`}
              >
                {b.text}
              </Link>
            ),
          )}
        </div>
      </section>

    </div>
  );
}
