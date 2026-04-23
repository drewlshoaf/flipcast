import Link from "next/link";
import { UserChip, type SessionUser } from "@/components/auth/user-chip";
import { AdPromoCard } from "@/components/home/ad-promo-card";
import { BUBBLES, bubbleClass, type Bubble } from "@/components/home/topic-bubbles";
import { SurpriseMe } from "@/components/home/surprise-me";
import {
  SAMPLE_PROMPTS,
  PROMPT_TILE_CLASS,
  PROMPT_DOT_CLASS,
  type PromptAccent,
  type SamplePrompt,
} from "@/lib/sample-prompts";
import { getDictionary } from "@/lib/i18n/server";
import { loadHomePromptConcepts } from "@/lib/prompt-engine";

function studioHref(topic?: string): string {
  if (!topic) return "/studio";
  return `/studio?topic=${encodeURIComponent(topic)}`;
}

interface HomePageProps {
  sessionUser: SessionUser | null;
}

// Engine concepts share the same tile shape as the legacy SAMPLE_PROMPTS,
// so we rotate through five accents for visual variety. Fallback to the
// static list on any engine failure so this surface is never empty.
const PROMPT_ACCENTS: PromptAccent[] = [
  "sky",
  "pink",
  "mint",
  "violet",
  "amber",
];

async function resolveHomePrompts(): Promise<SamplePrompt[]> {
  try {
    const engine = await loadHomePromptConcepts({ locale: "en" });
    if (engine.concepts.length === 0) return SAMPLE_PROMPTS;
    return engine.concepts.slice(0, 16).map((c, i) => ({
      text: c.prompt_concept,
      accent: PROMPT_ACCENTS[i % PROMPT_ACCENTS.length]!,
    }));
  } catch {
    return SAMPLE_PROMPTS;
  }
}

export async function HomePage({ sessionUser }: HomePageProps) {
  const t = getDictionary();
  const bubbles: Bubble[] = BUBBLES;
  const prompts: SamplePrompt[] = await resolveHomePrompts();

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-6 md:px-10">
      {/* Top nav */}
      <header className="mb-10 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-gradient shadow-glow">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M7 5v14l12-7-12-7z" fill="white" />
            </svg>
          </span>
          <span className="text-lg font-semibold tracking-tight text-ink-900">
            flipcast
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href={studioHref()}
            className="hidden h-10 items-center gap-2 rounded-full bg-ink-900 px-5 text-sm font-semibold text-white transition hover:scale-[1.02] sm:inline-flex"
          >
            {t.home.openStudio}
            <span aria-hidden>→</span>
          </Link>
          <UserChip user={sessionUser} loginNext="/studio" />
        </div>
      </header>

      {/* Hero with bubble field */}
      <section className="relative mx-auto mb-4 min-h-[520px] overflow-visible">
        {/* Bubble field — hidden on small screens to keep things calm.
            Positioning (translate + rotate) lives on the wrapper and hover
            styles live on the <Link>; otherwise the inline `transform`
            overrides Tailwind's hover:-translate-y-0.5 utility and the
            chips feel dead. */}
        <div className="pointer-events-none absolute inset-0 hidden md:block">
          {bubbles.map((b) => (
            <div
              key={b.text}
              className="pointer-events-auto absolute z-0 hover:z-10"
              style={{
                left: `${b.x}%`,
                top: `${b.y}%`,
                transform: `translate(-50%, -50%) rotate(${b.tilt ?? 0}deg)`,
              }}
            >
              <Link
                href={studioHref(b.text)}
                className={`inline-flex cursor-pointer items-center rounded-full font-medium ring-1 shadow-card transition hover:-translate-y-0.5 hover:scale-[1.04] hover:shadow-cardHover ${bubbleClass(b)}`}
              >
                {b.text}
              </Link>
            </div>
          ))}
        </div>

        {/* Soft white glow behind the central read zone */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/55 blur-2xl" />

        {/* Ad promo code tile, top-right of the hero. */}
        <div className="pointer-events-auto absolute right-0 top-0 z-20 hidden w-[380px] md:block">
          <AdPromoCard />
        </div>

        {/* Central read zone */}
        <div className="relative z-10 mx-auto flex max-w-[640px] flex-col items-center px-4 pt-2 text-center md:pt-10">
          {/* Big pink play button */}
          <Link
            href={studioHref()}
            aria-label={t.home.startFlipAria}
            className="group relative grid h-32 w-32 place-items-center rounded-full bg-gradient-to-br from-pink-400 via-pink-500 to-rose-500 shadow-glow ring-1 ring-pink-300/60 transition hover:scale-[1.04] active:scale-[0.98] md:h-40 md:w-40"
          >
            <span className="absolute inset-0 rounded-full bg-pink-300 opacity-30 blur-xl transition group-hover:opacity-50" />
            <svg
              className="relative ml-2 md:ml-3"
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <path d="M7 5v14l12-7-12-7z" fill="white" />
            </svg>
          </Link>

          <h1 className="mt-8 text-4xl font-semibold leading-[1.05] tracking-tight text-ink-900 md:text-6xl">
            <span className="bg-brand-gradient bg-clip-text text-transparent">
              {t.home.headlineLead}
            </span>{" "}
            {t.home.headlineTail}
          </h1>

          <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-500 md:text-lg">
            {t.home.subhead}
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
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

      {/* Mobile-only fallback chip row */}
      <section className="mb-12 md:hidden">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">
          {t.home.tryOneOfThese}
        </div>
        <div className="flex flex-wrap gap-2">
          {bubbles.slice(0, 8).map((b) => (
            <Link
              key={b.text}
              href={studioHref(b.text)}
              className={`inline-flex items-center rounded-full font-medium ring-1 shadow-card transition hover:shadow-cardHover ${bubbleClass(b)}`}
            >
              {b.text}
            </Link>
          ))}
        </div>
      </section>

      {/* More sample prompts */}
      <section className="mb-12 mt-6 md:-ml-3">
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink-900 md:text-3xl">
              {t.home.moreTitle}
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              {t.home.moreSubtitle}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {prompts.map((p) => (
            <Link
              key={p.text}
              href={studioHref(p.text)}
              className={`group flex items-center gap-3 rounded-2xl p-4 text-left text-base font-medium text-ink-700 ring-1 transition hover:-translate-y-0.5 hover:shadow-card md:text-lg ${PROMPT_TILE_CLASS[p.accent]}`}
            >
              <span
                className={`inline-block h-2 w-2 shrink-0 rounded-full ${PROMPT_DOT_CLASS[p.accent]}`}
                aria-hidden
              />
              <span className="leading-snug">{p.text}</span>
              <span
                className="ml-auto text-ink-400 transition group-hover:translate-x-0.5"
                aria-hidden
              >
                →
              </span>
            </Link>
          ))}
        </div>
      </section>

    </div>
  );
}
