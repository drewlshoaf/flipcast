"use client";

import { useEffect, useRef, useState } from "react";
import type {
  SceneOutline,
  SequenceItem,
  SequencePlan,
} from "@flipcast/types";

interface Props {
  plan: SequencePlan | null;
  currentItem: SequenceItem | null;
  currentSrc: string | null;
  currentIndex: number;
  isWaiting: boolean;
  isFinished: boolean;
  hasStarted: boolean;
  onEnded: () => void;
  submitting: boolean;
  onGenerate: () => void;
  canGenerate: boolean;
  formatLabel: string;
  vibeLabel: string;
  castSize: number;
  outline: SceneOutline[] | null;
  topicContext: string | null;
  requestId: string | null;
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function labelForItem(item: SequenceItem, totalAds: number): string {
  if (item.kind === "station_intro") return "Station intro";
  if (item.kind === "ad")
    return `Ad break ${item.adIndex + 1} of ${Math.min(totalAds, 6)}`;
  if (item.kind === "welcome") return "Welcome in";
  if (item.kind === "scene")
    return item.isFinal
      ? `Scene ${item.sceneIndex} — closing`
      : `Scene ${item.sceneIndex}`;
  return "";
}

function itemTypeLabel(item: SequenceItem): string {
  if (item.kind === "station_intro") return "INTRO";
  if (item.kind === "ad") return "AD";
  if (item.kind === "welcome") return "WELCOME";
  if (item.kind === "scene") return item.isFinal ? "CLOSING" : "SCENE";
  return "";
}

export function PreviewPlayer(props: Props) {
  const {
    plan,
    currentItem,
    currentSrc,
    currentIndex,
    isWaiting,
    isFinished,
    hasStarted,
    onEnded,
    submitting,
    onGenerate,
    canGenerate,
    formatLabel,
    vibeLabel,
    castSize,
    outline,
    topicContext,
    requestId,
  } = props;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  function handlePopOut() {
    if (!requestId || typeof window === "undefined") return;
    // Pause the studio tab so the two don't fight for audio.
    audioRef.current?.pause();
    window.open(`/player/${requestId}`, "_blank", "noopener,noreferrer");
  }

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    setTime(0);
    setDuration(0);
    if (currentSrc) {
      a.play().catch(() => {
        /* autoplay may be blocked until user gesture */
      });
    }
  }, [currentSrc]);

  function togglePlay() {
    const a = audioRef.current;
    if (!a || !currentSrc) return;
    if (a.paused) {
      a.play().catch(() => void 0);
    } else {
      a.pause();
    }
  }

  function onSeek(e: React.MouseEvent<HTMLDivElement>) {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    a.currentTime = pct * duration;
  }

  const progressPct = duration > 0 ? (time / duration) * 100 : 0;
  const showWaiting = hasStarted && isWaiting;
  const showGenerateCTA = !hasStarted;

  const estMinutes = plan ? Math.round(plan.estimatedSeconds / 60) : 7;

  return (
    <section className="glass overflow-hidden rounded-[32px] p-7 shadow-card">
      {/* Header row */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
            Preview
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">
            Your Flipcast
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip chip-sky">~{estMinutes} min</span>
          <span className="chip chip-pink">{formatLabel}</span>
          <span className="chip chip-mint">{vibeLabel}</span>
          <span className="chip chip-slate">
            {castSize} voice{castSize > 1 ? "s" : ""}
          </span>
          {requestId && (
            <button
              type="button"
              onClick={handlePopOut}
              title="Open this Flipcast in a new tab and keep listening"
              className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-full bg-white/80 px-3 text-xs font-medium text-ink-700 ring-1 ring-slate-200 transition hover:bg-white hover:shadow-card"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <path
                  d="M14 4h6v6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M20 4l-9 9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M19 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Pop out
            </button>
          )}
        </div>
      </div>

      {/* Now-playing line */}
      <div className="mb-4 flex items-center gap-3">
        <div
          className={`inline-flex h-2.5 w-2.5 rounded-full ${
            showGenerateCTA
              ? "bg-slate-300"
              : isFinished
                ? "bg-emerald-400"
                : showWaiting
                  ? "bg-pink-400 animate-pulse-soft"
                  : "bg-sky-400"
          }`}
        />
        <div className="text-sm text-ink-500">
          {showGenerateCTA ? (
            <span>Set a topic + format, then generate.</span>
          ) : isFinished ? (
            <span>Finished. Remix or generate again.</span>
          ) : currentItem ? (
            <span>
              <span className="mr-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-ink-500">
                {itemTypeLabel(currentItem)}
              </span>
              <span className="font-medium text-ink-700">
                {labelForItem(currentItem, plan?.totalAds ?? 0)}
              </span>
              {showWaiting && (
                <span className="ml-2 text-pink-600">generating…</span>
              )}
            </span>
          ) : null}
        </div>
      </div>

      {/* Player bar */}
      <div className="rounded-3xl bg-white/70 p-5 ring-1 ring-slate-200/70">
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!currentSrc}
            className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full bg-brand-gradient text-white shadow-glow transition hover:scale-[1.03] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <rect x="6" y="5" width="4" height="14" rx="1" fill="white" />
                <rect x="14" y="5" width="4" height="14" rx="1" fill="white" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M7 5v14l12-7-12-7z" fill="white" />
              </svg>
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div
              className="group relative h-2.5 cursor-pointer overflow-hidden rounded-full bg-slate-200/70"
              onClick={onSeek}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-brand-gradient"
                style={{ width: `${progressPct}%` }}
              />
              {showWaiting && !currentSrc && (
                <div className="absolute inset-0 overflow-hidden">
                  <div className="h-full w-1/3 -translate-x-full animate-shimmer-bar bg-gradient-to-r from-transparent via-white/70 to-transparent" />
                </div>
              )}
            </div>
            <div className="mt-2 flex justify-between text-xs font-medium text-ink-400">
              <span>{formatTime(time)}</span>
              <span>
                {plan
                  ? `${currentIndex + 1} of ${plan.items.length}`
                  : "—"}
              </span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        <audio
          ref={audioRef}
          src={currentSrc ?? undefined}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onEnded={() => {
            setPlaying(false);
            onEnded();
          }}
        />
      </div>

      {/* Outline */}
      {plan && (
        <div className="mt-5 rounded-3xl bg-white/60 p-5 ring-1 ring-slate-200/70">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
              Episode flow
            </div>
          </div>
          <ol className="flex flex-col gap-1.5">
            {plan.items.map((item, i) => {
              const active = hasStarted && i === currentIndex;
              const past = hasStarted && i < currentIndex;
              return (
                <li
                  key={i}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                    active
                      ? "bg-brand-gradient-soft ring-1 ring-sky-200/70 text-ink-900"
                      : past
                        ? "text-ink-400"
                        : "text-ink-700"
                  }`}
                >
                  <span className="w-8 text-[11px] font-semibold tracking-widest text-ink-400">
                    {itemTypeLabel(item)}
                  </span>
                  <span
                    className={`flex-1 ${active ? "font-medium" : ""}`}
                  >
                    {labelForItem(item, plan.totalAds)}
                  </span>
                  {item.kind === "scene" && outline && (
                    <span className="hidden text-xs text-ink-400 md:inline">
                      {outline.find((o) => o.sceneIndex === item.sceneIndex)
                        ?.focus ?? ""}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          {topicContext && (
            <p className="mt-4 border-t border-slate-200/70 pt-4 text-sm leading-relaxed text-ink-500">
              {topicContext}
            </p>
          )}
        </div>
      )}

      {/* Generate CTA */}
      {showGenerateCTA && (
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || submitting}
          className="mt-6 w-full rounded-full bg-brand-gradient px-6 py-4 text-base font-semibold text-white shadow-glow transition hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Starting up…" : "Generate Flipcast"}
        </button>
      )}
    </section>
  );
}
