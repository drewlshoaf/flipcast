import Link from "next/link";
import { UserChip, type SessionUser } from "@/components/auth/user-chip";
import { PROMPTS, promptClass } from "@/components/home/prompts";
import { SurpriseMe } from "@/components/home/surprise-me";

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

      {/* Hero with prompt field */}
      <section className="relative mx-auto mb-4 min-h-[520px] overflow-visible">
        {/* Prompt field — hidden on small screens to keep things calm */}
        <div className="pointer-events-none absolute inset-0 hidden md:block">
          {PROMPTS.map((p) => (
            <Link
              key={p.text}
              href={studioHref(p.text)}
              className={`pointer-events-auto absolute inline-flex items-center rounded-full font-medium ring-1 shadow-card transition hover:-translate-y-0.5 hover:shadow-cardHover ${promptClass(p)}`}
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                transform: `translate(-50%, -50%) rotate(${p.tilt ?? 0}deg)`,
              }}
            >
              {p.text}
            </Link>
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

      {/* Mobile-only fallback prompt row — hero's prompt field is hidden below md */}
      <section className="mb-12 md:hidden">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">
          Prompts
        </div>
        <div className="flex flex-wrap gap-2">
          {PROMPTS.slice(0, 8).map((p) => (
            <Link
              key={p.text}
              href={studioHref(p.text)}
              className={`inline-flex items-center rounded-full font-medium ring-1 shadow-card transition hover:shadow-cardHover ${promptClass(p)}`}
            >
              {p.text}
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
