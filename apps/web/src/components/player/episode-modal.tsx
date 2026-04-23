"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AD_BY_INDEX,
  type AdAccent,
  type Character,
  type SequenceItem,
  type SequencePlan,
  type SpeakerRole,
  type TranscriptTurn,
} from "@flipcast/types";
import { AdPromoCard } from "@/components/home/ad-promo-card";
import { EndPanel } from "@/components/player/end-panel";
import { PlayerActions } from "@/components/player/player-actions";
import { useT } from "@/lib/i18n/client";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Stage = "idle" | "playing" | "waiting" | "finished";

interface EpisodeModalProps {
  open: boolean;
  onClose: () => void;
  topic: string;
  // Cast id for the post-flip rate/share panel.
  requestId: string | null;
  plan: SequencePlan | null;
  stage: Stage;
  playbackIndex: number;
  currentItem: SequenceItem | null;
  currentSrc: string | null;
  characters: Character[] | null;
  sceneTurns: Record<number, TranscriptTurn[]>;
  // URLs of the ads in the order they'll be played. Used by the ad card +
  // promo code so the visual matches the audio rather than the old
  // deterministic slot→ad-{i+1} guess.
  adRotation: string[] | null;
  onEnded: () => void;
  onError?: () => void;
  adminView?: boolean;
  canSkipToNextScene?: boolean;
  canSkipToEnd?: boolean;
  onSkipToNextScene?: () => void;
  onSkipToEnd?: () => void;
}

// Resolve the ad metadata for a given plan ad-slot index. Prefers the live
// rotation that's actually playing; falls back to the deterministic
// slot→ad-{i+1} mapping if rotation hasn't arrived yet (matches
// srcForItem's fallback so visual == audio).
function resolveAdForSlot(
  slotIndex: number,
  rotation: string[] | null,
): ReturnType<typeof AD_BY_INDEX.get> {
  let adNumber: number;
  if (rotation && rotation.length > 0) {
    const url = rotation[slotIndex % rotation.length] ?? "";
    const match = url.match(/ad-(\d+)\.mp3/);
    adNumber = match ? Number(match[1]) : (slotIndex % 6) + 1;
  } else {
    adNumber = (slotIndex % 6) + 1;
  }
  return AD_BY_INDEX.get(adNumber);
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

export function EpisodeModal(props: EpisodeModalProps) {
  const t = useT();
  const {
    open,
    onClose,
    topic,
    requestId,
    plan,
    stage,
    playbackIndex,
    currentItem,
    currentSrc,
    characters,
    sceneTurns,
    adRotation,
    onEnded,
    onError,
    adminView,
    canSkipToNextScene,
    canSkipToEnd,
    onSkipToNextScene,
    onSkipToEnd,
  } = props;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [paused, setPaused] = useState(false);

  // Reset timing + resume from paused when the src rotates so the progress
  // bar doesn't snap weird and the next item doesn't inherit a paused state.
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setPaused(false);
  }, [currentSrc]);

  function togglePause() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().catch(() => {
        /* autoplay policy may block — user gesture should be enough */
      });
    } else {
      a.pause();
    }
  }

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

  // When the flipcast finishes the EndPanel takes over with a rate/share
  // prompt; user closes the modal explicitly. (Previously we auto-closed
  // after 1.2s, which skipped the chance to capture feedback or share.)

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

  // If an ad is currently playing, surface its promo code so the AdPromoCard
  // below can auto-fill its input with it.
  const currentPromoCode = useMemo<string | null>(() => {
    if (!currentItem || currentItem.kind !== "ad") return null;
    const ad = resolveAdForSlot(currentItem.adIndex, adRotation);
    return ad?.promoCode ?? null;
  }, [currentItem, adRotation]);

  // Which character is speaking right now.
  // - Welcome segment: always the moderator (single voice, single block).
  // - Scene: estimate by mapping the audio's currentTime/duration fraction
  //   to a cumulative character-length across the scene's turns. Rough but
  //   good enough without real per-turn timestamps.
  // - Other items (station intro, ad, pre-cast): no one in the cast is
  //   speaking, so we return null and no card gets the indicator.
  const currentSpeaker = useMemo<SpeakerRole | null>(() => {
    if (!currentItem) return null;
    if (currentItem.kind === "welcome") return "moderator";
    if (currentItem.kind !== "scene") return null;
    const turns = sceneTurns[currentItem.sceneIndex] ?? [];
    if (turns.length === 0) return null;
    if (duration <= 0) return turns[0]?.speaker ?? null;
    const totalChars = turns.reduce((s, t) => s + t.text.length, 0);
    if (totalChars === 0) return turns[0]?.speaker ?? null;
    const frac = currentTime / duration;
    let acc = 0;
    for (const t of turns) {
      acc += t.text.length / totalChars;
      if (frac <= acc) return t.speaker;
    }
    return turns[turns.length - 1]?.speaker ?? null;
  }, [currentItem, currentTime, duration, sceneTurns]);

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
                {isFinished
                  ? t.player.statusDone
                  : isWaiting
                    ? t.player.statusGenerating
                    : t.player.statusPlaying}
              </span>
              {adminView && plan && (
                <span className="ml-auto font-mono text-xs text-ink-400">
                  {Math.min(playbackIndex + 1, plan.items.length)} / {plan.items.length}
                </span>
              )}
            </div>
            <div className="flex items-start justify-between gap-3">
              <h2 className="line-clamp-2 text-xl font-semibold tracking-tight text-ink-900">
                {topic}
              </h2>
              {requestId && (
                <PlayerActions
                  requestId={requestId}
                  topic={topic}
                  size="compact"
                />
              )}
            </div>
          </header>

          {/* Progress — passive, not scrubbable */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={togglePause}
              disabled={!currentSrc}
              aria-label={paused ? t.player.playAria : t.player.pauseAria}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-gradient text-white shadow-glow transition hover:scale-[1.04] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {paused ? (
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                  <path d="M7 5v14l12-7-12-7z" fill="white" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                  <rect x="6" y="5" width="4" height="14" rx="1" fill="white" />
                  <rect x="14" y="5" width="4" height="14" rx="1" fill="white" />
                </svg>
              )}
            </button>
            <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200/70">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-brand-gradient transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
              {isWaiting && !paused && (
                <div className="absolute inset-0 overflow-hidden">
                  <div className="h-full w-1/3 -translate-x-full animate-shimmer-bar bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                </div>
              )}
            </div>
          </div>

          {/* Admin-only skip buttons. Only rendered when there's an actual
              target to jump to. */}
          {adminView && (canSkipToNextScene || canSkipToEnd) && (
            <div className="flex flex-wrap gap-2">
              {canSkipToNextScene && (
                <button
                  type="button"
                  onClick={onSkipToNextScene}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-4 py-1.5 text-xs font-semibold text-ink-700 ring-1 ring-slate-200 transition hover:bg-white hover:shadow-card"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
                    <path d="M5 5v14l9-7-9-7z" fill="currentColor" />
                    <rect x="16" y="5" width="2" height="14" fill="currentColor" />
                  </svg>
                  {t.player.skipToNextScene}
                </button>
              )}
              {canSkipToEnd && (
                <button
                  type="button"
                  onClick={onSkipToEnd}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-4 py-1.5 text-xs font-semibold text-ink-700 ring-1 ring-slate-200 transition hover:bg-white hover:shadow-card"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
                    <path d="M4 5v14l8-7-8-7z" fill="currentColor" />
                    <path d="M12 5v14l8-7-8-7z" fill="currentColor" />
                  </svg>
                  {t.player.skipToEnd}
                </button>
              )}
            </div>
          )}

          {/* Now-playing panel */}
          <NowPlaying
            item={currentItem}
            totalAds={plan?.totalAds ?? 0}
            characters={characters}
            currentSpeaker={currentSpeaker}
            paused={paused}
            adRotation={adRotation}
            t={t}
          />

          {/* Admin-only: full transcript with the active turn highlighted. */}
          {adminView && (
            <TranscriptPanel
              sceneTurns={sceneTurns}
              characters={characters}
              currentItem={currentItem}
              currentSpeaker={currentSpeaker}
              t={t}
            />
          )}

          {/* End-of-flip rate + share panel. Replaces the old auto-close
              and gives users a place to react and share. */}
          {isFinished && requestId && (
            <EndPanel
              requestId={requestId}
              topic={topic}
              variant="overlay"
              onDismiss={onClose}
            />
          )}

          {/* Always-visible promo box. Auto-fills with the current ad's code
              while an ad is playing. */}
          {!isFinished && <AdPromoCard prefill={currentPromoCode} />}
        </div>

        {/* key={currentSrc} forces autoplay on each new item. onError advances
            past a broken track so a bad asset can't hang the whole episode. */}
        <audio
          key={currentSrc ?? "idle"}
          ref={audioRef}
          src={currentSrc ?? undefined}
          autoPlay
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onEnded={onEnded}
          onError={() => onError?.()}
        />
      </div>
    </div>
  );
}

function NowPlaying({
  item,
  totalAds,
  characters,
  currentSpeaker,
  paused,
  adRotation,
  t,
}: {
  item: SequenceItem | null;
  totalAds: number;
  characters: Character[] | null;
  currentSpeaker: SpeakerRole | null;
  paused: boolean;
  adRotation: string[] | null;
  t: Dictionary;
}) {
  if (item && item.kind === "ad") {
    return (
      <AdPanel
        slotIndex={item.adIndex}
        totalAds={totalAds}
        adRotation={adRotation}
        t={t}
      />
    );
  }
  return (
    <CastPanel
      characters={characters}
      currentSpeaker={currentSpeaker}
      paused={paused}
      t={t}
    />
  );
}

function CastPanel({
  characters,
  currentSpeaker,
  paused,
  t,
}: {
  characters: Character[] | null;
  currentSpeaker: SpeakerRole | null;
  paused: boolean;
  t: Dictionary;
}) {
  if (!characters || characters.length === 0) {
    return (
      <div className="rounded-3xl bg-white/60 p-5 text-sm italic text-ink-400 ring-1 ring-slate-200/70">
        {t.player.castingPlaceholder}
      </div>
    );
  }
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
        {t.player.castHeader}
      </div>
      <div className="grid grid-cols-1 gap-2">
        {characters.map((c) => {
          const isSpeaking = c.role === currentSpeaker;
          return (
            <div
              key={c.role}
              className={`rounded-2xl p-3 ring-1 transition ${
                isSpeaking
                  ? "bg-pink-50/70 ring-2 ring-pink-300 shadow-card"
                  : "bg-white/70 ring-slate-200/70"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-ink-900">
                  {c.name}
                </span>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${
                    c.role === "moderator" ? "text-pink-600" : "text-sky-600"
                  }`}
                >
                  {c.role === "moderator" ? t.player.moderator : t.player.panelist}
                </span>
                {isSpeaking ? (
                  <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-pink-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                    <span
                      className={`grid h-3 w-3 place-items-center rounded-full bg-white/25 ${
                        paused ? "" : "animate-pulse-soft"
                      }`}
                      aria-hidden
                    >
                      <svg width="6" height="6" viewBox="0 0 24 24">
                        <path d="M7 5v14l12-7-12-7z" fill="white" />
                      </svg>
                    </span>
                    {t.player.speaking}
                  </span>
                ) : (
                  <span className="ml-auto text-[11px] text-ink-400">
                    {c.voiceLabel}
                  </span>
                )}
              </div>
              {c.bio && (
                <div className="mt-1 text-xs italic text-ink-500">{c.bio}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdPanel({
  slotIndex,
  totalAds,
  adRotation,
  t,
}: {
  slotIndex: number;
  totalAds: number;
  adRotation: string[] | null;
  t: Dictionary;
}) {
  // Resolve the ad that's *actually* being played at this slot so the card
  // and promo code match the audio.
  const ad = resolveAdForSlot(slotIndex, adRotation);
  if (!ad) return null;
  const palette = AD_GRADIENTS[ad.accent];

  return (
    <div className={`overflow-hidden rounded-3xl ${palette.bg} p-6 text-white shadow-cardHover`}>
      <div className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em]">
        <span className={`rounded-full px-2.5 py-1 ${palette.chip}`}>
          {t.player.adBreak}
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
          {t.player.promoCodeLabel}
        </span>
        <span
          className={`rounded-full px-3 py-1 font-mono text-sm font-bold tracking-wider ${palette.pill}`}
        >
          {ad.promoCode}
        </span>
      </div>
      <div className="mt-3 text-xs text-white/70">
        {t.player.promoCodeHint}
      </div>
    </div>
  );
}

// Admin-only transcript rail. Shows the current scene's turns (or all scenes
// collapsed when no scene is active) with the current speaker highlighted.
// Tags like [excited] are preserved inline so admins can debug the markup.
function TranscriptPanel({
  sceneTurns,
  characters,
  currentItem,
  currentSpeaker,
  t,
}: {
  sceneTurns: Record<number, TranscriptTurn[]>;
  characters: Character[] | null;
  currentItem: SequenceItem | null;
  currentSpeaker: SpeakerRole | null;
  t: Dictionary;
}) {
  // All hooks must be called unconditionally before any early return, or
  // React throws "Rendered more hooks than during the previous render" when
  // sceneTurns goes from empty to populated.
  const activeRef = useRef<HTMLDivElement | null>(null);
  const currentSceneIndex =
    currentItem && currentItem.kind === "scene"
      ? currentItem.sceneIndex
      : null;

  // Auto-scroll the active turn into view when the speaker changes.
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [currentSpeaker, currentSceneIndex]);

  const sceneKeys = Object.keys(sceneTurns)
    .map((k) => Number(k))
    .sort((a, b) => a - b);
  if (sceneKeys.length === 0) return null;

  const characterByRole = new Map(
    (characters ?? []).map((c) => [c.role, c] as const),
  );

  return (
    <section className="rounded-3xl bg-white/70 p-4 ring-1 ring-slate-200/70">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
          {t.player.transcriptHeader}
        </h3>
        <span className="chip chip-pink text-[10px]">admin</span>
      </div>
      <div className="max-h-64 overflow-y-auto pr-1">
        {sceneKeys.map((idx) => {
          const turns = sceneTurns[idx] ?? [];
          const isActiveScene = idx === currentSceneIndex;
          return (
            <div key={idx} className="mb-3 last:mb-0">
              <div
                className={`mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                  isActiveScene ? "text-sky-600" : "text-ink-400"
                }`}
              >
                {t.player.sceneLabel} {idx}
              </div>
              <div className="flex flex-col gap-1.5">
                {turns.map((t) => {
                  const char = characterByRole.get(t.speaker);
                  const isActive =
                    isActiveScene && t.speaker === currentSpeaker;
                  const speakerIdx =
                    t.speaker === "moderator"
                      ? 0
                      : t.speaker === "panelist_1"
                        ? 1
                        : 2;
                  return (
                    <div
                      key={t.sequence}
                      ref={isActive ? activeRef : null}
                      className={`rounded-xl px-3 py-2 text-xs leading-snug transition ${
                        isActive
                          ? "bg-brand-gradient-soft text-ink-900 ring-1 ring-sky-200"
                          : "bg-white/60 text-ink-700 ring-1 ring-slate-200/70"
                      }`}
                    >
                      <div
                        className={`mb-0.5 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] ${
                          isActive ? "text-pink-600" : "text-ink-400"
                        }`}
                      >
                        <span className="font-mono normal-case tracking-normal text-ink-500">
                          {`<|speaker:${speakerIdx}|>`}
                        </span>
                        <span>·</span>
                        <span>{char ? char.name : t.speaker}</span>
                      </div>
                      <div>{t.text}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
