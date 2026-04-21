import Link from "next/link";
import { UserChip, type SessionUser } from "@/components/auth/user-chip";
import { AdPromoCard } from "@/components/home/ad-promo-card";

const PROMPT_CHIPS = [
  "Why is matcha everywhere now?",
  "What happened with the container wars?",
  "The case for a four-day week",
  "Is AI actually changing radio?",
  "The best dinner party debates right now",
];

const USE_CASES = [
  {
    title: "Last night's headline",
    body: "Hear three takes before breakfast.",
    prompt: "the biggest headline from yesterday",
    accent: "sky" as const,
  },
  {
    title: "A niche you love",
    body: "Dive into the corner of the internet that keeps you up.",
    prompt: "an explainer on specialty coffee sourcing",
    accent: "pink" as const,
  },
  {
    title: "A debate you want",
    body: "Pit two strong voices against each other.",
    prompt: "should cities ban private cars downtown",
    accent: "mint" as const,
  },
];

const VIBE_SHOWCASE = [
  {
    label: "Serious",
    body: "Measured and weighty.",
    accent: "bg-sky-100 text-sky-700",
  },
  {
    label: "Playful",
    body: "Bright and witty.",
    accent: "bg-pink-100 text-pink-700",
  },
  {
    label: "Dramatic",
    body: "Tense and cinematic.",
    accent: "bg-violet-100 text-violet-700",
  },
  {
    label: "Cozy",
    body: "Warm and easygoing.",
    accent: "bg-emerald-100 text-emerald-700",
  },
];

const EXPLAINERS = [
  {
    label: "Topic first",
    body: "Start with the thing you actually want to hear about. No forms.",
    chip: "chip-sky",
  },
  {
    label: "Tap the shape",
    body: "Format and vibe are choices, not configuration.",
    chip: "chip-pink",
  },
  {
    label: "Player is the editor",
    body: "Preview, outline, and remix live inside the player.",
    chip: "chip-mint",
  },
  {
    label: "Made for you",
    body: "Every flip.audio is produced on demand, about what you said.",
    chip: "chip-slate",
  },
];

function studioHref(topic?: string): string {
  if (!topic) return "/studio";
  return `/studio?topic=${encodeURIComponent(topic)}`;
}

const ACCENT_MAP = {
  sky: "from-sky-400/40 to-sky-200/0",
  pink: "from-pink-400/40 to-pink-200/0",
  mint: "from-emerald-400/40 to-emerald-200/0",
} as const;

interface HomePageProps {
  sessionUser: SessionUser | null;
}

export function HomePage({ sessionUser }: HomePageProps) {
  return (
    <div className="mx-auto max-w-[1200px] px-6 py-6 md:px-10">
      {/* Masthead */}
      <header className="mb-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-gradient shadow-glow">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M7 5v14l12-7-12-7z"
                fill="white"
              />
            </svg>
          </span>
          <span className="text-lg font-semibold tracking-tight text-ink-900">
            flip.audio
          </span>
        </div>
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

      {/* Hero */}
      <section className="mb-16 grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div>
          <span className="chip chip-pink mb-5">
            New · personalized, on-demand podcast
          </span>
          <h1 className="text-5xl font-semibold leading-[1.02] tracking-tight text-ink-900 md:text-6xl">
            Make the show
            <br />
            <span className="bg-brand-gradient bg-clip-text text-transparent">
              first.
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-500">
            The podcast doesn't exist until you ask for it. Drop a topic — a
            headline, a hot take, something you can't stop thinking about — and
            flip.audio produces a ~7 minute episode you can play right now.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={studioHref()}
              className="inline-flex h-12 items-center rounded-full bg-brand-gradient px-7 text-base font-semibold text-white shadow-glow transition hover:scale-[1.02]"
            >
              Start a flip
            </Link>
            <Link
              href={studioHref()}
              className="inline-flex h-12 items-center rounded-full bg-white/80 px-7 text-base font-medium text-ink-700 ring-1 ring-slate-200 transition hover:bg-white"
            >
              See how it works
            </Link>
          </div>

          <div className="mt-8">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">
              Try one of these
            </div>
            <div className="flex flex-wrap gap-2">
              {PROMPT_CHIPS.map((p) => (
                <Link
                  key={p}
                  href={studioHref(p)}
                  className="rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-ink-700 ring-1 ring-slate-200 transition hover:bg-white hover:text-ink-900 hover:shadow-card"
                >
                  {p}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Ad promo + preview stack */}
        <div>
          <AdPromoCard />
          <PreviewCard />
        </div>
      </section>

      {/* Use cases */}
      <section className="mb-16">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-ink-900">
              What do you want to hear about?
            </h2>
            <p className="mt-2 max-w-xl text-base text-ink-500">
              Three good starting points. Each one opens the Studio with the
              topic already filled in.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {USE_CASES.map((u) => (
            <Link
              key={u.title}
              href={studioHref(u.prompt)}
              className="group relative overflow-hidden rounded-3xl bg-white/80 p-6 ring-1 ring-slate-200 transition hover:shadow-cardHover"
            >
              <div
                className={`pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-gradient-to-br ${ACCENT_MAP[u.accent]} blur-2xl`}
              />
              <h3 className="text-xl font-semibold tracking-tight text-ink-900">
                {u.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">
                {u.body}
              </p>
              <div className="mt-5 inline-flex items-center text-sm font-semibold text-ink-900">
                Open with topic
                <span
                  aria-hidden
                  className="ml-2 transition group-hover:translate-x-0.5"
                >
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Vibe showcase */}
      <section className="mb-16">
        <div className="mb-6">
          <h2 className="text-3xl font-semibold tracking-tight text-ink-900">
            Pick the mood.
          </h2>
          <p className="mt-2 text-base text-ink-500">
            Four vibes. Each one changes the word choice, pacing, and energy.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {VIBE_SHOWCASE.map((v) => (
            <div
              key={v.label}
              className="rounded-3xl bg-white/70 p-5 ring-1 ring-slate-200/70 transition hover:shadow-card"
            >
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${v.accent}`}
              >
                {v.label}
              </span>
              <p className="mt-3 text-sm leading-relaxed text-ink-500">
                {v.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Explainers */}
      <section className="mb-16">
        <div className="mb-6">
          <h2 className="text-3xl font-semibold tracking-tight text-ink-900">
            Go from idea to episode.
          </h2>
          <p className="mt-2 text-base text-ink-500">
            Four ways flip.audio is built for fast, joyful creation.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {EXPLAINERS.map((e) => (
            <div
              key={e.label}
              className="rounded-3xl bg-white/70 p-5 ring-1 ring-slate-200/70"
            >
              <span className={`chip ${e.chip} mb-3`}>{e.label}</span>
              <p className="text-sm leading-relaxed text-ink-500">{e.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mb-12">
        <div className="relative overflow-hidden rounded-[40px] bg-white/70 p-10 ring-1 ring-slate-200/70 md:p-14">
          <div className="pointer-events-none absolute inset-0 bg-brand-gradient-soft" />
          <div className="relative grid grid-cols-1 items-center gap-8 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <h2 className="text-4xl font-semibold tracking-tight text-ink-900">
                Your player is also your editor.
              </h2>
              <p className="mt-3 max-w-xl text-base text-ink-500">
                Hit generate. Hear the intro while the rest produces. Remix
                with one tap. No forms, no files, no queue.
              </p>
            </div>
            <Link
              href={studioHref()}
              className="inline-flex h-14 items-center rounded-full bg-brand-gradient px-8 text-base font-semibold text-white shadow-glow transition hover:scale-[1.02]"
            >
              Start a flip
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200/70 pt-6 text-xs text-ink-400">
        <span>flip.audio — on-demand podcasts, one topic at a time.</span>
      </footer>
    </div>
  );
}

function PreviewCard() {
  return (
    <div className="glass relative overflow-hidden rounded-[32px] p-6 shadow-cardHover">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="chip chip-sky">Preview</span>
          <span className="chip chip-mint">~7 min</span>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
          Live
        </span>
      </div>

      <div className="mb-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-pink-600">
          Scene 1
        </div>
        <div className="mt-1 text-xl font-semibold tracking-tight text-ink-900">
          Why is matcha suddenly everywhere?
        </div>
      </div>

      <div className="rounded-2xl bg-white/70 p-4 ring-1 ring-slate-200/70">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-gradient shadow-glow">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M7 5v14l12-7-12-7z" fill="white" />
            </svg>
          </span>
          <div className="flex-1">
            <div className="h-2 overflow-hidden rounded-full bg-slate-200/70">
              <div className="h-full w-[42%] rounded-full bg-brand-gradient" />
            </div>
            <div className="mt-2 flex justify-between text-[11px] font-medium text-ink-400">
              <span>2:58</span>
              <span>7:08</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-sky-50 p-3 ring-1 ring-sky-100">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-600">
            Format
          </div>
          <div className="mt-1 text-sm font-semibold text-ink-900">Panel</div>
        </div>
        <div className="rounded-xl bg-pink-50 p-3 ring-1 ring-pink-100">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-pink-600">
            Vibe
          </div>
          <div className="mt-1 text-sm font-semibold text-ink-900">
            Playful
          </div>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-100">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-600">
            Voices
          </div>
          <div className="mt-1 text-sm font-semibold text-ink-900">3</div>
        </div>
      </div>
    </div>
  );
}
