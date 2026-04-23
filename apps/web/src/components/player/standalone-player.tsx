"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  planSequence,
  stationIntroUrl,
  type SequenceItem,
  type SequencePlan,
  type SseEvent,
} from "@flipcast/types";
import { EndPanel } from "@/components/player/end-panel";
import { PlayerActions } from "@/components/player/player-actions";
import { useT } from "@/lib/i18n/client";

interface FlipcastRow {
  id: string;
  topic: string;
  format: string;
  locale: string | null;
  status: string;
  topicContext: string | null;
  welcomeAudioUrl: string | null;
  scene1AudioUrl: string | null;
  scene2AudioUrl: string | null;
  scene3AudioUrl: string | null;
  scene4AudioUrl: string | null;
  moderatorVoiceId: string | null;
  panelist1VoiceId: string | null;
  panelist2VoiceId: string | null;
  errorMessage: string | null;
}

type Stage = "loading" | "idle" | "playing" | "waiting" | "finished" | "error";

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

import type { Dictionary } from "@/lib/i18n/dictionaries";

function labelForItem(
  item: SequenceItem,
  totalAds: number,
  t: Dictionary,
): string {
  if (item.kind === "station_intro") return t.standalone.stationIntro;
  if (item.kind === "ad")
    return t.standalone.adBreak
      .replace("{index}", String(item.adIndex + 1))
      .replace("{total}", String(Math.min(totalAds, 6)));
  if (item.kind === "welcome") return t.standalone.welcomeIn;
  if (item.kind === "scene")
    return item.isFinal
      ? t.standalone.sceneClosing.replace("{n}", String(item.sceneIndex))
      : t.standalone.scene.replace("{n}", String(item.sceneIndex));
  return "";
}

function itemTypeLabel(item: SequenceItem, t: Dictionary): string {
  if (item.kind === "station_intro") return t.standalone.typeIntro;
  if (item.kind === "ad") return t.standalone.typeAd;
  if (item.kind === "welcome") return t.standalone.typeWelcome;
  if (item.kind === "scene")
    return item.isFinal ? t.standalone.typeClosing : t.standalone.typeScene;
  return "";
}

const FORMAT_LABEL: Record<string, string> = {
  newscast: "Solo",
  pals: "Pals",
  panel: "Panel",
};

interface Props {
  requestId: string;
  isAdmin?: boolean;
}

interface TranscriptTurnMini {
  sequence: number;
  speaker: string;
  text: string;
}
interface TranscriptCharacter {
  role: string;
  name: string;
  voiceLabel?: string;
}

export function StandalonePlayer({ requestId, isAdmin = false }: Props) {
  const t = useT();
  const [row, setRow] = useState<FlipcastRow | null>(null);
  const [plan, setPlan] = useState<SequencePlan | null>(null);
  const [welcomeUrl, setWelcomeUrl] = useState<string | null>(null);
  const [sceneUrls, setSceneUrls] = useState<Record<number, string>>({});
  const [adRotation, setAdRotation] = useState<string[] | null>(null);
  const [stage, setStage] = useState<Stage>("loading");
  const [index, setIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryToast, setRetryToast] = useState<string | null>(null);
  const [sceneTurns, setSceneTurns] = useState<
    Record<number, TranscriptTurnMini[]>
  >({});
  const [characters, setCharacters] = useState<TranscriptCharacter[] | null>(
    null,
  );

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/flipcasts/${requestId}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setErrorMsg(data?.error ?? t.standalone.notFound);
          setStage("error");
          return;
        }
        const data = (await res.json()) as FlipcastRow;
        if (cancelled) return;
        setRow(data);
        setPlan(planSequence());
        if (data.welcomeAudioUrl) setWelcomeUrl(data.welcomeAudioUrl);
        const scenes: Record<number, string> = {};
        if (data.scene1AudioUrl) scenes[1] = data.scene1AudioUrl;
        if (data.scene2AudioUrl) scenes[2] = data.scene2AudioUrl;
        if (data.scene3AudioUrl) scenes[3] = data.scene3AudioUrl;
        if (data.scene4AudioUrl) scenes[4] = data.scene4AudioUrl;
        setSceneUrls(scenes);
        setStage("idle");
        if (data.status === "failed") {
          setErrorMsg(data.errorMessage ?? "Generation failed.");
          setStage("error");
        }
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(
          err instanceof Error ? err.message : "Could not load cast.",
        );
        setStage("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  // Admin-only: load scene turns + characters for the transcript rail.
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    async function loadTranscript() {
      try {
        const res = await fetch(`/api/flipcasts/${requestId}/transcript`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          sceneTurns?: Record<number, TranscriptTurnMini[]>;
          characters?: TranscriptCharacter[] | null;
        };
        if (cancelled) return;
        if (data.sceneTurns) setSceneTurns(data.sceneTurns);
        if (data.characters) setCharacters(data.characters);
      } catch {
        /* transcript is a nice-to-have; ignore fetch errors */
      }
    }
    void loadTranscript();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, requestId]);

  // Fresh ad rotation per playback (interest-targeted if signed in).
  useEffect(() => {
    let cancelled = false;
    async function loadAds() {
      try {
        const res = await fetch("/api/ads/rotation?count=5", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { ads?: { url: string }[] };
        if (cancelled) return;
        if (Array.isArray(data.ads)) {
          setAdRotation(data.ads.map((a) => a.url));
        }
      } catch {
        /* keep static fallback */
      }
    }
    void loadAds();
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  // SSE — only if not yet complete
  useEffect(() => {
    if (!row) return;
    if (row.status === "complete" || row.status === "failed") return;
    const es = new EventSource(`/api/flipcasts/${requestId}/stream`);
    esRef.current = es;
    es.onmessage = (m) => {
      try {
        const evt = JSON.parse(m.data) as SseEvent;
        if (evt.event === "welcome_ready") {
          const url = (evt.data?.url as string | undefined) ?? null;
          if (url) setWelcomeUrl(url);
        }
        if (evt.event === "scene_ready") {
          const data = evt.data as
            | { sceneIndex?: number; url?: string }
            | undefined;
          if (data?.sceneIndex && data?.url) {
            setSceneUrls((prev) => ({
              ...prev,
              [data.sceneIndex as number]: data.url as string,
            }));
          }
        }
        if (evt.event === "synth_retry") {
          setRetryToast(
            evt.message ?? "Having a moment with the audio engine — retrying.",
          );
          window.setTimeout(() => setRetryToast(null), 2400);
        }
        if (evt.event === "complete") es.close();
        if (evt.event === "failed" || evt.event === "moderation_rejected") {
          setErrorMsg(evt.message ?? "Generation failed.");
          setStage("error");
          es.close();
        }
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [requestId, row?.status]);

  function srcForItem(item: SequenceItem): string | null {
    if (item.kind === "station_intro") {
      const castVoiceIds = [
        row?.moderatorVoiceId,
        row?.panelist1VoiceId,
        row?.panelist2VoiceId,
      ].filter((v): v is string => !!v);
      return stationIntroUrl("en", castVoiceIds);
    }
    if (item.kind === "ad") {
      if (adRotation && adRotation.length > 0) {
        return adRotation[item.adIndex % adRotation.length] ?? null;
      }
      return row?.locale === "es"
        ? `/ads/es/ad-${item.adIndex + 1}.mp3`
        : `/ads/ad-${item.adIndex + 1}.mp3`;
    }
    if (item.kind === "welcome") return welcomeUrl;
    if (item.kind === "scene") return sceneUrls[item.sceneIndex] ?? null;
    return null;
  }

  const currentItem = plan ? plan.items[index] ?? null : null;
  const currentSrc = currentItem ? srcForItem(currentItem) : null;

  // Resume from waiting → playing when the next asset arrives
  useEffect(() => {
    if (stage !== "waiting" || !plan) return;
    const item = plan.items[index];
    if (item && srcForItem(item)) {
      setStage("playing");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcomeUrl, sceneUrls, stage, plan, index]);

  // Autoplay when src changes and stage is playing
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    setTime(0);
    setDuration(0);
    if (stage === "playing" && currentSrc) {
      a.play().catch(() => void 0);
    }
  }, [currentSrc, stage]);

  function startPlayback() {
    if (!plan) return;
    setIndex(0);
    setStage("playing");
  }

  function togglePlay() {
    if (stage === "idle" || stage === "finished") {
      startPlayback();
      return;
    }
    const a = audioRef.current;
    if (!a || !currentSrc) return;
    if (a.paused) a.play().catch(() => void 0);
    else a.pause();
  }

  function handleEnded() {
    if (!plan) return;
    setPlaying(false);
    const next = index + 1;
    if (next >= plan.items.length) {
      setStage("finished");
      return;
    }
    setIndex(next);
    const item = plan.items[next]!;
    if (srcForItem(item)) {
      setStage("playing");
    } else {
      setStage("waiting");
    }
  }

  function skip(delta: number) {
    if (!plan) return;
    const next = Math.max(0, Math.min(plan.items.length - 1, index + delta));
    if (next === index) return;
    setIndex(next);
    const item = plan.items[next]!;
    if (srcForItem(item)) setStage("playing");
    else setStage("waiting");
  }

  function onSeek(e: React.MouseEvent<HTMLDivElement>) {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    a.currentTime = pct * duration;
  }

  const progressPct = duration > 0 ? (time / duration) * 100 : 0;
  const totalSec = plan?.estimatedSeconds ?? 0;
  const estMinutes = Math.round(totalSec / 60);

  // Header renders regardless of stage
  const formatLabel = row ? FORMAT_LABEL[row.format] ?? row.format : "";

  return (
    <div className="mx-auto flex min-h-screen max-w-[860px] flex-col px-6 py-6 md:px-10">
      {/* Masthead */}
      <header className="mb-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-gradient shadow-glow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M7 5v14l12-7-12-7z" fill="white" />
            </svg>
          </span>
          <span className="text-base font-semibold tracking-tight text-ink-900">
            flipcast
          </span>
        </Link>
        <Link
          href="/studio"
          className="inline-flex h-10 items-center rounded-full bg-white/70 px-4 text-sm font-medium text-ink-700 ring-1 ring-slate-200 transition hover:bg-white"
        >
          Make another
        </Link>
      </header>

      {stage === "loading" && (
        <div className="glass rounded-3xl p-10 text-center text-ink-500 shadow-card">
          {t.standalone.loadingCast}
        </div>
      )}

      {stage === "error" && (
        <div className="rounded-3xl bg-rose-50 p-6 text-rose-700 ring-1 ring-rose-200">
          <div className="text-sm font-semibold">Couldn't play this cast.</div>
          <p className="mt-1 text-sm">{errorMsg}</p>
        </div>
      )}

      {row && stage !== "loading" && stage !== "error" && plan && (
        <main className="flex flex-1 flex-col">
          {/* Topic heading */}
          <div className="mb-6">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="chip chip-sky">~{estMinutes} min</span>
              <span className="chip chip-pink">{formatLabel}</span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-4xl font-semibold leading-tight tracking-tight text-ink-900">
                {row.topic}
              </h1>
              <PlayerActions requestId={requestId} topic={row.topic} />
            </div>
            {row.topicContext && (
              <p className="mt-3 text-base leading-relaxed text-ink-500">
                {row.topicContext}
              </p>
            )}
          </div>

          {/* Player card */}
          <section className="glass rounded-[36px] p-7 shadow-cardHover">
            <div className="mb-5 flex items-center gap-3">
              <div
                className={`inline-flex h-2.5 w-2.5 rounded-full ${
                  stage === "finished"
                    ? "bg-emerald-400"
                    : stage === "waiting"
                      ? "bg-pink-400 animate-pulse-soft"
                      : stage === "idle"
                        ? "bg-slate-300"
                        : "bg-sky-400"
                }`}
              />
              <div className="text-sm text-ink-500">
                {stage === "idle" ? (
                  <span>{t.standalone.readyToPlay}</span>
                ) : stage === "finished" ? (
                  <span>{t.standalone.finished}</span>
                ) : currentItem ? (
                  <span>
                    <span className="mr-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-ink-500">
                      {itemTypeLabel(currentItem, t)}
                    </span>
                    <span className="font-medium text-ink-700">
                      {labelForItem(currentItem, plan.totalAds, t)}
                    </span>
                    {stage === "waiting" && (
                      <span className="ml-2 text-pink-600">{t.standalone.generating}</span>
                    )}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-slate-200/70">
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  onClick={() => skip(-1)}
                  disabled={index === 0}
                  className="grid h-11 w-11 place-items-center rounded-full bg-white/80 text-ink-700 ring-1 ring-slate-200 transition hover:bg-white disabled:opacity-40"
                  aria-label={t.standalone.previousAria}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M18 5v14l-11-7 11-7z"
                      fill="currentColor"
                    />
                    <rect x="5" y="5" width="2" height="14" fill="currentColor" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={togglePlay}
                  className="relative grid h-20 w-20 shrink-0 place-items-center rounded-full bg-brand-gradient text-white shadow-glow transition hover:scale-[1.03] active:scale-[0.98]"
                  aria-label={playing ? t.player.pauseAria : t.player.playAria}
                >
                  {playing ? (
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                      <rect x="6" y="5" width="4" height="14" rx="1" fill="white" />
                      <rect x="14" y="5" width="4" height="14" rx="1" fill="white" />
                    </svg>
                  ) : (
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                      <path d="M7 5v14l12-7-12-7z" fill="white" />
                    </svg>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => skip(1)}
                  disabled={!plan || index >= plan.items.length - 1}
                  className="grid h-11 w-11 place-items-center rounded-full bg-white/80 text-ink-700 ring-1 ring-slate-200 transition hover:bg-white disabled:opacity-40"
                  aria-label={t.standalone.nextAria}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M6 5v14l11-7-11-7z"
                      fill="currentColor"
                    />
                    <rect x="17" y="5" width="2" height="14" fill="currentColor" />
                  </svg>
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
                    {stage === "waiting" && (
                      <div className="absolute inset-0 overflow-hidden">
                        <div className="h-full w-1/3 -translate-x-full animate-shimmer-bar bg-gradient-to-r from-transparent via-white/70 to-transparent" />
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex justify-between text-xs font-medium text-ink-400">
                    <span>{formatTime(time)}</span>
                    <span>
                      {index + 1} of {plan.items.length}
                    </span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              </div>
            </div>

            <audio
              ref={audioRef}
              src={currentSrc ?? undefined}
              autoPlay
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onEnded={handleEnded}
            />

            {/* Outline / flow */}
            <div className="mt-6 rounded-3xl bg-white/60 p-5 ring-1 ring-slate-200/70">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
                {t.standalone.episodeFlow}
              </div>
              <ol className="flex flex-col gap-1.5">
                {plan.items.map((item, i) => {
                  const active = i === index;
                  const past = i < index;
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
                        {itemTypeLabel(item, t)}
                      </span>
                      <span
                        className={`flex-1 ${active ? "font-medium" : ""}`}
                      >
                        {labelForItem(item, plan.totalAds, t)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>

          {stage === "finished" && (
            <div className="mt-6">
              <EndPanel
                requestId={requestId}
                topic={row.topic}
                variant="inline"
              />
            </div>
          )}

          {isAdmin && Object.keys(sceneTurns).length > 0 && (
            <section className="mt-6 glass rounded-[32px] p-6 shadow-card">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-lg font-semibold tracking-tight text-ink-900">
                  {t.standalone.transcript}
                </h3>
                <span className="chip chip-pink text-[10px]">admin</span>
              </div>
              <div className="flex flex-col gap-5">
                {Object.keys(sceneTurns)
                  .map((k) => Number(k))
                  .sort((a, b) => a - b)
                  .map((idx) => {
                    const turns = sceneTurns[idx] ?? [];
                    const nameFor = (role: string) =>
                      characters?.find((c) => c.role === role)?.name ?? role;
                    return (
                      <div key={idx}>
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-600">
                          {t.standalone.scene.replace("{n}", String(idx))}
                        </div>
                        <div className="flex flex-col gap-2">
                          {turns.map((turn) => (
                            <div
                              key={turn.sequence}
                              className="rounded-2xl bg-white/70 p-4 ring-1 ring-slate-200/70"
                            >
                              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-pink-600">
                                {nameFor(turn.speaker)}
                              </div>
                              <div className="text-sm leading-relaxed text-ink-700">
                                {turn.text}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </section>
          )}

        </main>
      )}

      {retryToast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink-900/90 px-5 py-2.5 text-sm font-medium text-white shadow-glow">
          {retryToast}
        </div>
      )}
    </div>
  );
}
