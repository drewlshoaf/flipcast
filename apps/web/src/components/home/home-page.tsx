import Link from "next/link";
import { UserChip, type SessionUser } from "@/components/auth/user-chip";
import { BUBBLES, bubbleClass } from "@/components/home/topic-bubbles";
import { SurpriseMe } from "@/components/home/surprise-me";
import {
  SAMPLE_PROMPTS,
  PROMPT_TILE_CLASS,
  PROMPT_DOT_CLASS,
} from "@/lib/sample-prompts";

function studioHref(topic?: string): string {
  if (!topic) return "/studio";
  return `/studio?topic=${encodeURIComponent(topic)}`;
}

interface HomePageProps {
  sessionUser: SessionUser | null;
}

export function HomePage({ sessionUser }: HomePageProps) {
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
            flip.audio
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href={studioHref()}
            className="hidden h-10 items-center gap-2 rounded-full bg-ink-900 px-5 text-sm font-semibold text-white transition hover:scale-[1.02] sm:inline-flex"
          >
            Open Studio
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
          {BUBBLES.map((b) => (
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

        {/* Central read zone */}
        <div className="relative z-10 mx-auto flex max-w-[640px] flex-col items-center px-4 pt-2 text-center md:pt-10">
          {/* Big pink play button */}
          <Link
            href={studioHref()}
            aria-label="Start a flip"
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
              You
            </span>{" "}
            pick the show.
          </h1>

          <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-500 md:text-lg">
            Drop a topic — a headline, a hot take, something you can't stop
            thinking about — and flip.audio produces an episode you can play
            right now.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={studioHref()}
              className="inline-flex h-12 items-center rounded-full bg-brand-gradient px-7 text-base font-semibold text-white shadow-glow transition hover:scale-[1.02]"
            >
              Start a flip
            </Link>
            <SurpriseMe />
          </div>
        </div>
      </section>

      {/* Mobile-only fallback chip row, since the bubble field is hidden */}
      <section className="mb-12 md:hidden">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">
          Try one of these
        </div>
        <div className="flex flex-wrap gap-2">
          {BUBBLES.slice(0, 8).map((b) => (
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
      <section className="mb-12">
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink-900 md:text-3xl">
              More to start from.
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Tap any prompt — the studio opens with it filled in.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {SAMPLE_PROMPTS.map((p) => (
            <Link
              key={p.text}
              href={studioHref(p.text)}
              className={`group flex items-center gap-3 rounded-2xl p-4 text-left text-sm font-medium text-ink-700 ring-1 transition hover:-translate-y-0.5 hover:shadow-card ${PROMPT_TILE_CLASS[p.accent]}`}
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

      <footer className="border-t border-slate-200/70 pt-6 text-xs text-ink-400">
        <span>flip.audio — on-demand podcasts, one topic at a time.</span>
      </footer>
    </div>
  );
}
