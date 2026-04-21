"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AD_BY_INDEX,
  type AdAccent,
  type Character,
  type SequenceItem,
  type SequencePlan,
  type TranscriptTurn,
} from "@flipcast/types";
import { AdPromoCard } from "@/components/home/ad-promo-card";

type Stage = "idle" | "playing" | "waiting" | "finished";

interface EpisodeModalProps {
  open: boolean;
  onClose: () => void;
  topic: string;
  plan: SequencePlan | null;
  stage: Stage;
  playbackIndex: number;
  currentItem: SequenceItem | null;
  currentSrc: string | null;
  welcomeText: string | null;
  characters: Character[] | null;
  sceneTurns: Record<number, TranscriptTurn[]>;
  onEnded: () => void;
}

const AD_GRADIENTS: Record<AdAccent, { bg: string; chip: string; pill: string }> = {
  indigo: {
    bg: "bg-gradient-to-br from-indigo-500 via-indigo-600 to-slate-900",
    chip: "bg-white/15 text-white",
    pill: "bg-white text-indigo-700",
  },
  emerald: {
    bg: "bg-gradient-to-br from-emerald-400 via-emerald-600 to-teal-800",
    chip: "bg-white/15 text-white",
    pill: "bg-white text-emerald-700",
  },
  amber: {
    bg: "bg-gradient-to-br from-amber-400 via-amber-600 to-orange-800",
    chip: "bg-white/20 text-white",
    pill: "bg-white text-amber-700",
  },
  violet: {
    bg: "bg-gradient-to-br from-violet-500 via-violet-700 to-slate-900",
    chip: "bg-white/15 text-white",
    pill: "bg-white text-violet-700",
  },
  orange: {
    bg: "bg-gradient-to-br from-orange-400 via-orange-600 to-rose-800",
    chip: "bg-white/20 text-white",
    pill: "bg-white text-orange-700",
  },
  slate: {
    bg: "bg-gradient-to-br from-slate-500 via-slate-700 to-slate-900",
    chip: "bg-white/15 text-white",
    pill: "bg-white text-slate-800",
  },
};

function itemTypeLabel(item: SequenceItem): string {
  if (item.kind === "station_intro") return "INTRO";
  if (item.kind === "ad") return "AD";
  if (item.kind === "welcome") return "WELCOME";
  return item.isFinal ? "CLOSING" : "SCENE";
}

function itemTitle(item: SequenceItem, totalAds: number): string {
  if (item.kind === "station_intro") return "Station intro";
  if (item.kind === "ad") return `Ad break ${item.adIndex + 1} of ${totalAds}`;
  if (item.kind === "welcome") return "Welcome in";
  return item.isFinal
    ? `Scene ${item.sceneIndex} — closing`
    : `Scene ${item.sceneIndex}`;
}

export function EpisodeModal(props: EpisodeModalProps) {
  const {
    open,
    onClose,
    topic,
    plan,
    stage,
    playbackIndex,
    currentItem,
    currentSrc,
    welcomeText,
    characters,
    sceneTurns,
    onEnded,
  } = props;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Reset timing when the src rotates so the progress bar doesn't snap weird.
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
  }, [currentSrc]);

  // Lock the body scroll while the modal is open so the rest of the page
  // genuinely feels "locked".
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const isWaiting =
    stage === "waiting" || (!!currentItem && !currentSrc) || stage === "idle";
  const isFinished = stage === "finished";

  const progressPercent = useMemo(() => {
    if (!plan) return 0;
    if (isFinished) return 100;
    const total = plan.items.length;
    const within = duration > 0 ? currentTime / duration : 0;
    const pct = ((playbackIndex + within) / total) * 100;
    return Math.max(0, Math.min(100, pct));
  }, [plan, isFinished, duration, currentTime, playbackIndex]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
    >
      <div className="glass relative flex max-h-[92vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[32px] shadow-cardHover">
        {/* Close — only available once the episode has finished playing. */}
        {isFinished && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close player"
            className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/80 text-ink-700 ring-1 ring-slate-200 transition hover:bg-white hover:shadow-card"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}

        {/* Scroll body */}
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-7">
          {/* Header */}
          <header>
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`inline-flex h-2.5 w-2.5 rounded-full ${
                  isFinished
                    ? "bg-emerald-400"
                    : isWaiting
                      ? "bg-pink-400 animate-pulse-soft"
                      : "bg-sky-400"
                }`}
                aria-hidden
              />
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
                {isFinished ? "Done" : isWaiting ? "Generating" : "Playing"}
              </span>
              {plan && (
                <span className="ml-auto font-mono text-xs text-ink-400">
                  {Math.min(playbackIndex + 1, plan.items.length)} / {plan.items.length}
                </span>
              )}
            </div>
            <h2 className="line-clamp-2 text-xl font-semibold tracking-tight text-ink-900">
              {topic}
            </h2>
          </header>

          {/* Progress — passive, not scrubbable */}
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200/70">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-brand-gradient transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
            {isWaiting && (
              <div className="absolute inset-0 overflow-hidden">
                <div className="h-full w-1/3 -translate-x-full animate-shimmer-bar bg-gradient-to-r from-transparent via-white/60 to-transparent" />
              </div>
            )}
          </div>

          {/* Now-playing panel */}
          <NowPlaying
            item={currentItem}
            totalAds={plan?.totalAds ?? 0}
            welcomeText={welcomeText}
            characters={characters}
            sceneTurns={sceneTurns}
          />

          {/* Always-visible promo box */}
          <AdPromoCard />
        </div>

        {/* key={currentSrc} forces autoplay on each new item. */}
        <audio
          key={currentSrc ?? "idle"}
          ref={audioRef}
          src={currentSrc ?? undefined}
          autoPlay
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onEnded={onEnded}
        />
      </div>
    </div>
  );
}

function NowPlaying({
  item,
  totalAds,
  welcomeText,
  characters,
  sceneTurns,
}: {
  item: SequenceItem | null;
  totalAds: number;
  welcomeText: string | null;
  characters: Character[] | null;
  sceneTurns: Record<number, TranscriptTurn[]>;
}) {
  if (!item) {
    return (
      <div className="rounded-3xl bg-white/60 p-5 text-sm text-ink-500 ring-1 ring-slate-200/70">
        Getting your Flipcast ready…
      </div>
    );
  }

  if (item.kind === "station_intro" || item.kind === "welcome") {
    return (
      <WelcomePanel
        kind={item.kind}
        welcomeText={welcomeText}
        characters={characters}
      />
    );
  }

  if (item.kind === "ad") {
    return <AdPanel slotIndex={item.adIndex} totalAds={totalAds} />;
  }

  return <ScenePanel item={item} turns={sceneTurns[item.sceneIndex] ?? []} />;
}

function WelcomePanel({
  kind,
  welcomeText,
  characters,
}: {
  kind: "station_intro" | "welcome";
  welcomeText: string | null;
  characters: Character[] | null;
}) {
  const showWelcomeText = kind === "welcome" && !!welcomeText;
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl bg-white/70 p-5 ring-1 ring-slate-200/70">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
          {kind === "station_intro" ? "Station intro" : "Welcome"}
        </div>
        {kind === "station_intro" && (
          <p className="text-base leading-relaxed text-ink-700">
            Thanks for choosing Flipcast. We're assembling your Flipcast and
            will be with you shortly — right after these short ads.
          </p>
        )}
        {showWelcomeText && (
          <p className="whitespace-pre-line text-base leading-relaxed text-ink-700">
            {welcomeText}
          </p>
        )}
        {!showWelcomeText && kind === "welcome" && (
          <p className="text-sm italic text-ink-400">
            Writing the welcome…
          </p>
        )}
      </div>

      {characters && characters.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
            Cast
          </div>
          <div className="grid grid-cols-1 gap-2">
            {characters.map((c) => (
              <div
                key={c.role}
                className="rounded-2xl bg-white/70 p-3 ring-1 ring-slate-200/70"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-ink-900">
                    {c.name}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-pink-600">
                    {c.role === "moderator"
                      ? "Moderator"
                      : c.role === "panelist_1"
                        ? "Panelist"
                        : "Panelist"}
                  </span>
                  <span className="ml-auto text-[11px] text-ink-400">
                    {c.voiceLabel}
                  </span>
                </div>
                {c.bio && (
                  <div className="mt-1 text-xs italic text-ink-500">
                    {c.bio}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AdPanel({
  slotIndex,
  totalAds,
}: {
  slotIndex: number;
  totalAds: number;
}) {
  // Deterministic mapping: slot i → ad-{i+1}. Matches the fallback the player
  // uses when /api/ads/rotation hasn't answered yet.
  const ad = AD_BY_INDEX.get((slotIndex % 6) + 1);
  if (!ad) return null;
  const palette = AD_GRADIENTS[ad.accent];

  return (
    <div className={`overflow-hidden rounded-3xl ${palette.bg} p-6 text-white shadow-cardHover`}>
      <div className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em]">
        <span className={`rounded-full px-2.5 py-1 ${palette.chip}`}>
          Ad break
        </span>
        <span className="text-white/60">
          {slotIndex + 1} / {totalAds}
        </span>
      </div>
      {ad.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ad.imageUrl}
          alt={ad.product}
          className="mb-4 h-36 w-full rounded-2xl object-cover ring-1 ring-white/20"
        />
      ) : (
        <div className="mb-4 h-24 rounded-2xl bg-white/10 ring-1 ring-white/20" aria-hidden />
      )}
      <div className="text-2xl font-semibold tracking-tight">{ad.product}</div>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs uppercase tracking-[0.14em] text-white/70">
          Promo code
        </span>
        <span
          className={`rounded-full px-3 py-1 font-mono text-sm font-bold tracking-wider ${palette.pill}`}
        >
          {ad.promoCode}
        </span>
      </div>
      <div className="mt-3 text-xs text-white/70">
        Enter it in the box below to redeem.
      </div>
    </div>
  );
}

function ScenePanel({
  item,
  turns,
}: {
  item: Extract<SequenceItem, { kind: "scene" }>;
  turns: TranscriptTurn[];
}) {
  return (
    <div className="rounded-3xl bg-white/70 p-5 ring-1 ring-slate-200/70">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-600">
        {itemTypeLabel(item)}
      </div>
      <div className="text-base font-semibold text-ink-900">
        {itemTitle(item, 0).replace(/^Scene /, "Scene ")}
      </div>
      {turns.length === 0 ? (
        <p className="mt-3 text-sm italic text-ink-400">
          Writing this scene…
        </p>
      ) : (
        <div className="mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto pr-1 text-sm leading-relaxed text-ink-700">
          {turns.map((t) => (
            <p key={t.sequence}>{t.text}</p>
          ))}
        </div>
      )}
    </div>
  );
}
