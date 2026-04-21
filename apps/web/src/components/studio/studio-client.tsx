"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AVAILABLE_FORMATS,
  AVAILABLE_VIBES,
  ELEVENLABS_VOICES,
  MIN_SPEED,
  MAX_SPEED,
  SPEED_STEP,
  UI_FORMATS,
  formatConfig,
  lengthPreset,
  type FlipcastFormat,
  type FlipcastVibe,
  type SequenceItem,
  type SequencePlan,
  type VoiceOption,
} from "@flipcast/types";
import type {
  Character,
  SceneOutline,
  SseEvent,
  TranscriptTurn,
} from "@flipcast/types";
import { IdeaRail } from "./idea-rail";
import { PreviewPlayer } from "./preview-player";
import { UserChip, type SessionUser } from "@/components/auth/user-chip";

const ROLE_LABEL: Record<Character["role"], string> = {
  moderator: "Moderator",
  panelist_1: "Panelist",
  panelist_2: "Panelist",
};

type VoiceMode = "auto" | "pick";
type PlaybackStage = "idle" | "playing" | "waiting" | "finished";

const TOPIC_HELPERS = [
  "A headline",
  "A question",
  "A hot take",
  "Something you keep thinking about",
];

const REMIX_ACTIONS = [
  { id: "shorter-intro", label: "Shorter intro" },
  { id: "more-contrast", label: "More contrast" },
  { id: "softer-tone", label: "Softer tone" },
  { id: "stronger-ending", label: "Stronger ending" },
];

const FORMAT_ACCENTS = {
  sky: {
    ring: "ring-sky-200",
    ringSelected: "ring-sky-400",
    bar: "bg-gradient-to-r from-sky-400 to-sky-500",
    bg: "bg-sky-50/60",
  },
  pink: {
    ring: "ring-pink-200",
    ringSelected: "ring-pink-400",
    bar: "bg-gradient-to-r from-pink-400 to-pink-500",
    bg: "bg-pink-50/60",
  },
  mint: {
    ring: "ring-emerald-200",
    ringSelected: "ring-emerald-400",
    bar: "bg-gradient-to-r from-emerald-400 to-emerald-500",
    bg: "bg-emerald-50/60",
  },
} as const;

const VIBE_ACCENTS: Record<
  string,
  { chip: string; ring: string; bg: string }
> = {
  serious: {
    chip: "bg-sky-100 text-sky-700",
    ring: "ring-sky-300",
    bg: "bg-sky-50/50",
  },
  playful: {
    chip: "bg-pink-100 text-pink-700",
    ring: "ring-pink-300",
    bg: "bg-pink-50/50",
  },
  dramatic: {
    chip: "bg-violet-100 text-violet-700",
    ring: "ring-violet-300",
    bg: "bg-violet-50/50",
  },
  cozy: {
    chip: "bg-emerald-100 text-emerald-700",
    ring: "ring-emerald-300",
    bg: "bg-emerald-50/50",
  },
};

interface StudioClientProps {
  defaultSpeed: number;
  initialTopic?: string;
  sessionUser: SessionUser | null;
}

export function StudioClient({
  defaultSpeed,
  initialTopic = "",
  sessionUser,
}: StudioClientProps) {
  const [topic, setTopic] = useState(initialTopic);
  const [format, setFormat] = useState<FlipcastFormat>("panel");
  const [vibe, setVibe] = useState<FlipcastVibe>("serious");
  const [speed, setSpeed] = useState<number>(defaultSpeed);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("auto");
  const [pickedVoices, setPickedVoices] = useState<string[]>([]);
  const [showSecondary, setShowSecondary] = useState(false);

  const lengthMinutes = lengthPreset("long").minutes;
  const cfg = formatConfig(format);
  const eligibleVoices = useMemo(
    () => ELEVENLABS_VOICES.filter((v) => v.engines.includes(cfg.engine)),
    [cfg.engine],
  );

  useEffect(() => {
    setPickedVoices([]);
  }, [format]);

  // Session / generation state
  const [submitting, setSubmitting] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [plan, setPlan] = useState<SequencePlan | null>(null);
  const [events, setEvents] = useState<SseEvent[]>([]);
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [outline, setOutline] = useState<SceneOutline[] | null>(null);
  const [topicContext, setTopicContext] = useState<string | null>(null);
  const [welcomeUrl, setWelcomeUrl] = useState<string | null>(null);
  const [sceneUrls, setSceneUrls] = useState<Record<number, string>>({});
  const [adRotation, setAdRotation] = useState<string[] | null>(null);
  const [sceneTurns, setSceneTurns] = useState<
    Record<number, TranscriptTurn[]>
  >({});
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const [playback, setPlayback] = useState<{
    stage: PlaybackStage;
    index: number;
  }>({ stage: "idle", index: 0 });

  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // SSE subscription
  useEffect(() => {
    if (!requestId) return;
    const es = new EventSource(`/api/flipcasts/${requestId}/stream`);
    esRef.current = es;
    es.onmessage = (m) => {
      try {
        const evt = JSON.parse(m.data) as SseEvent;
        setEvents((prev) => [...prev, evt]);
        if (evt.event === "setup_complete") {
          const data = evt.data as
            | {
                characters?: Character[];
                topicContext?: string;
                outline?: SceneOutline[];
              }
            | undefined;
          if (data?.characters) setCharacters(data.characters);
          if (data?.topicContext) setTopicContext(data.topicContext);
          if (data?.outline) setOutline(data.outline);
        }
        if (evt.event === "welcome_ready") {
          const url = (evt.data?.url as string | undefined) ?? null;
          if (url) setWelcomeUrl(url);
        }
        if (evt.event === "scene_ready") {
          const data = evt.data as
            | {
                sceneIndex?: number;
                url?: string;
                turns?: TranscriptTurn[];
              }
            | undefined;
          if (data?.sceneIndex && data?.url) {
            setSceneUrls((prev) => ({
              ...prev,
              [data.sceneIndex as number]: data.url as string,
            }));
          }
          if (data?.sceneIndex && data?.turns) {
            setSceneTurns((prev) => ({
              ...prev,
              [data.sceneIndex as number]: data.turns as TranscriptTurn[],
            }));
          }
        }
        if (evt.event === "complete") es.close();
        if (evt.event === "moderation_rejected" || evt.event === "failed") {
          setError(evt.message ?? "Request failed.");
          es.close();
        }
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [requestId]);

  function srcForItem(item: SequenceItem): string | null {
    if (item.kind === "station_intro") return "/station/intro.mp3";
    if (item.kind === "ad") {
      if (adRotation && adRotation.length > 0) {
        return adRotation[item.adIndex % adRotation.length] ?? null;
      }
      return `/ads/ad-${item.adIndex + 1}.mp3`;
    }
    if (item.kind === "welcome") return welcomeUrl;
    if (item.kind === "scene") return sceneUrls[item.sceneIndex] ?? null;
    return null;
  }

  // Advance from waiting → playing when the next asset arrives.
  useEffect(() => {
    if (playback.stage !== "waiting" || !plan) return;
    const item = plan.items[playback.index];
    if (item && srcForItem(item)) {
      setPlayback({ stage: "playing", index: playback.index });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcomeUrl, sceneUrls, playback, plan]);

  async function submit() {
    if (!topic || topic.trim().length < 3) {
      setError("Give us a topic with at least a few words.");
      return;
    }
    if (voiceMode === "pick" && pickedVoices.length !== cfg.castSize) {
      setError(
        `This format needs ${cfg.castSize} voice${cfg.castSize > 1 ? "s" : ""}.`,
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    setEvents([]);
    setCharacters(null);
    setOutline(null);
    setTopicContext(null);
    setWelcomeUrl(null);
    setSceneUrls({});
    setSceneTurns({});
    setPlan(null);
    setAdRotation(null);
    setPlayback({ stage: "idle", index: 0 });
    // Fire ad rotation in parallel with the cast submission so it's ready
    // by the time the player needs ad URLs.
    void fetch("/api/ads/rotation?count=5", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const list = d?.ads as { url: string }[] | undefined;
        if (Array.isArray(list)) setAdRotation(list.map((a) => a.url));
      })
      .catch(() => void 0);
    try {
      const res = await fetch("/api/flipcasts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          topic,
          format,
          vibe,
          lengthMinutes,
          speed,
          voiceIds: voiceMode === "pick" ? pickedVoices : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Submission failed.");
        return;
      }
      setRequestId(data.requestId);
      if (data.sequence) setPlan(data.sequence as SequencePlan);
      setPlayback({ stage: "playing", index: 0 });
    } finally {
      setSubmitting(false);
    }
  }

  function handleTrackEnded() {
    if (!plan) return;
    if (playback.stage !== "playing") return;
    const nextIndex = playback.index + 1;
    if (nextIndex >= plan.items.length) {
      setPlayback({ stage: "finished", index: nextIndex });
      return;
    }
    const item = plan.items[nextIndex]!;
    if (srcForItem(item)) {
      setPlayback({ stage: "playing", index: nextIndex });
    } else {
      setPlayback({ stage: "waiting", index: nextIndex });
    }
  }

  function resetSession() {
    esRef.current?.close();
    setRequestId(null);
    setPlan(null);
    setEvents([]);
    setCharacters(null);
    setOutline(null);
    setTopicContext(null);
    setWelcomeUrl(null);
    setSceneUrls({});
    setSceneTurns({});
    setError(null);
    setPlayback({ stage: "idle", index: 0 });
  }

  const currentItem =
    plan && (playback.stage === "playing" || playback.stage === "waiting")
      ? plan.items[playback.index]
      : null;
  const currentSrc = currentItem ? srcForItem(currentItem) : null;
  const hasStarted = Boolean(plan && requestId);
  const isFinished = playback.stage === "finished";
  const isWaiting = playback.stage === "waiting" || (!!currentItem && !currentSrc);

  const formatLabel =
    AVAILABLE_FORMATS.find((f) => f.id === format)?.label ?? format;
  const vibeLabel =
    AVAILABLE_VIBES.find((v) => v.id === vibe)?.label ?? vibe;

  const characterByRole = new Map(characters?.map((c) => [c.role, c]) ?? []);

  function handleShare() {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    navigator.clipboard?.writeText(url).then(
      () => setToast("Link copied"),
      () => setToast("Couldn't copy"),
    );
  }

  function handleSaveDraft() {
    if (typeof window === "undefined") return;
    const draft = { topic, format, vibe, speed, voiceMode, pickedVoices };
    try {
      window.localStorage.setItem("flipcast:draft", JSON.stringify(draft));
      setToast("Draft saved");
    } catch {
      setToast("Couldn't save draft");
    }
  }

  function handleRemix(id: string) {
    const label = REMIX_ACTIONS.find((r) => r.id === id)?.label ?? "Remix";
    setToast(`${label} — saved for next generation`);
  }

  const estMinutes = plan
    ? Math.round(plan.estimatedSeconds / 60)
    : 7;

  return (
    <div className="mx-auto max-w-[1240px] px-6 py-6 md:px-10">
      {/* Top bar */}
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-white/70 px-4 text-sm font-medium text-ink-700 ring-1 ring-slate-200 transition hover:bg-white"
          >
            <span aria-hidden>←</span> Home
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink-900">
              Flipcast Studio
            </h1>
            <p className="text-xs text-ink-400">
              Topic → format → vibe → listen.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip chip-slate">~{estMinutes} min</span>
          {sessionUser && (
            <Link
              href="/library"
              className="inline-flex h-10 items-center rounded-full bg-white/70 px-4 text-sm font-medium text-ink-700 ring-1 ring-slate-200 transition hover:bg-white"
            >
              My library
            </Link>
          )}
          <button
            type="button"
            onClick={handleSaveDraft}
            className="h-10 rounded-full bg-white/70 px-4 text-sm font-medium text-ink-700 ring-1 ring-slate-200 transition hover:bg-white"
          >
            Save draft
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="h-10 rounded-full bg-white/70 px-4 text-sm font-medium text-ink-700 ring-1 ring-slate-200 transition hover:bg-white"
          >
            Share
          </button>
          <UserChip user={sessionUser} loginNext="/studio" />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Main column */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* Creation intro / topic */}
          <section className="glass rounded-[32px] p-7 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
                  What's on your mind?
                </h2>
                <p className="mt-1 max-w-md text-sm text-ink-500">
                  A headline, a question, a hot take, a thing you can't stop
                  thinking about. We'll turn it into a real-sounding episode.
                </p>
              </div>
              <span className="chip chip-pink hidden md:inline-flex">
                topic first
              </span>
            </div>

            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. why are we suddenly all obsessed with matcha?"
              rows={3}
              className="w-full resize-none rounded-2xl bg-white/80 px-5 py-4 text-lg leading-snug text-ink-900 outline-none ring-1 ring-slate-200 transition placeholder:text-ink-300 focus:ring-2 focus:ring-sky-300"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              {TOPIC_HELPERS.map((h) => (
                <span key={h} className="chip chip-slate">
                  {h}
                </span>
              ))}
            </div>
          </section>

          {/* Format */}
          <section>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-ink-900">
                  Format
                </h3>
                <p className="text-sm text-ink-500">
                  Pick the shape of the show.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {UI_FORMATS.map((f) => {
                const accent = FORMAT_ACCENTS[f.accent];
                const selected = !f.disabled && format === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      if (f.disabled) {
                        setToast(`${f.label} is coming soon`);
                        return;
                      }
                      setFormat(f.id as FlipcastFormat);
                    }}
                    disabled={f.disabled}
                    className={`group relative overflow-hidden rounded-3xl bg-white/80 p-5 text-left ring-1 transition ${
                      selected
                        ? `${accent.ringSelected} ring-2 shadow-cardHover`
                        : `${accent.ring} hover:ring-2 hover:shadow-card`
                    } ${f.disabled ? "opacity-60" : ""}`}
                  >
                    <div
                      className={`absolute inset-x-0 top-0 h-1 ${accent.bar}`}
                    />
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-base font-semibold text-ink-900">
                        {f.label}
                      </span>
                      {f.disabled && (
                        <span className="chip chip-mint text-[10px]">
                          Coming soon
                        </span>
                      )}
                      {selected && (
                        <span className="ml-auto grid h-6 w-6 place-items-center rounded-full bg-brand-gradient text-white">
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <path
                              d="M5 12l5 5 9-11"
                              stroke="white"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      )}
                    </div>
                    <div className="text-sm leading-snug text-ink-500">
                      {f.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Vibe */}
          <section>
            <div className="mb-3">
              <h3 className="text-lg font-semibold tracking-tight text-ink-900">
                Vibe
              </h3>
              <p className="text-sm text-ink-500">
                Sets the energy and word choice.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {AVAILABLE_VIBES.map((v) => {
                const accent = VIBE_ACCENTS[v.id] ?? VIBE_ACCENTS.serious;
                const selected = vibe === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVibe(v.id)}
                    className={`rounded-3xl bg-white/80 p-4 text-left ring-1 transition ${
                      selected
                        ? `${accent.ring} ring-2 ${accent.bg} shadow-cardHover`
                        : "ring-slate-200 hover:ring-2 hover:shadow-card"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${accent.chip}`}
                      >
                        {v.label}
                      </span>
                      {selected && (
                        <span className="text-[11px] font-semibold text-ink-500">
                          chosen
                        </span>
                      )}
                    </div>
                    <div className="text-sm leading-snug text-ink-500">
                      {v.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Secondary controls */}
          <section className="rounded-3xl bg-white/50 p-5 ring-1 ring-slate-200/60">
            <button
              type="button"
              onClick={() => setShowSecondary((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <div className="text-sm font-semibold text-ink-900">
                  Fine-tune
                </div>
                <div className="text-xs text-ink-400">
                  Speed · voice mode · voice picks. Strong defaults already set.
                </div>
              </div>
              <span className="text-sm text-ink-500">
                {showSecondary ? "Hide" : "Show"}
              </span>
            </button>

            {showSecondary && (
              <div className="mt-5 flex flex-col gap-5">
                <div>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="font-medium text-ink-700">
                      Speaker speed
                    </span>
                    <span className="font-mono text-ink-500">
                      {speed.toFixed(2)}x
                      {Math.abs(speed - defaultSpeed) < 0.001
                        ? " · default"
                        : ""}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={MIN_SPEED}
                    max={MAX_SPEED}
                    step={SPEED_STEP}
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    className="w-full accent-pink-500"
                  />
                </div>

                <div>
                  <div className="mb-2 text-sm font-medium text-ink-700">
                    Voices
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setVoiceMode("auto")}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        voiceMode === "auto"
                          ? "bg-brand-gradient text-white shadow-card"
                          : "bg-white/80 text-ink-700 ring-1 ring-slate-200"
                      }`}
                    >
                      Auto-cast voices
                    </button>
                    <button
                      type="button"
                      onClick={() => setVoiceMode("pick")}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        voiceMode === "pick"
                          ? "bg-brand-gradient text-white shadow-card"
                          : "bg-white/80 text-ink-700 ring-1 ring-slate-200"
                      }`}
                    >
                      Pick my own ({cfg.castSize})
                    </button>
                  </div>

                  {voiceMode === "pick" && (
                    <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
                      {eligibleVoices.map((v) => (
                        <VoiceCard
                          key={v.id}
                          voice={v}
                          selected={pickedVoices.includes(v.id)}
                          disabled={
                            !pickedVoices.includes(v.id) &&
                            pickedVoices.length >= cfg.castSize
                          }
                          onToggle={() => {
                            setPickedVoices((prev) =>
                              prev.includes(v.id)
                                ? prev.filter((x) => x !== v.id)
                                : [...prev, v.id],
                            );
                          }}
                        />
                      ))}
                      <div className="col-span-full text-xs text-ink-400">
                        Selected: {pickedVoices.length} / {cfg.castSize}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Error */}
          {error && (
            <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200">
              {error}
            </div>
          )}

          {/* Preview + player */}
          <PreviewPlayer
            plan={plan}
            currentItem={currentItem ?? null}
            currentSrc={currentSrc}
            currentIndex={playback.index}
            isWaiting={isWaiting}
            isFinished={isFinished}
            hasStarted={hasStarted}
            onEnded={handleTrackEnded}
            submitting={submitting}
            onGenerate={submit}
            canGenerate={!!topic && topic.trim().length >= 3 && !submitting}
            formatLabel={formatLabel}
            vibeLabel={vibeLabel}
            castSize={cfg.castSize}
            outline={outline}
            topicContext={topicContext}
            requestId={requestId}
          />

          {/* Remix actions */}
          {hasStarted && (
            <section className="rounded-3xl bg-white/60 p-5 ring-1 ring-slate-200/70">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-ink-900">
                    Remix
                  </h3>
                  <p className="text-xs text-ink-400">
                    Quick one-tap tweaks for the next generation.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resetSession();
                    setToast("Ready for a fresh take");
                  }}
                  className="h-9 rounded-full bg-white/80 px-4 text-xs font-medium text-ink-700 ring-1 ring-slate-200 transition hover:bg-white"
                >
                  Start over
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {REMIX_ACTIONS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleRemix(r.id)}
                    className="rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-ink-700 ring-1 ring-slate-200 transition hover:bg-white hover:shadow-card"
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Supporting explanation */}
          {!hasStarted && (
            <section className="rounded-3xl bg-white/50 p-6 ring-1 ring-slate-200/60">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-ink-500">
                How this works
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                {[
                  {
                    label: "Topic first",
                    body: "Start with what you actually want to hear about.",
                    chip: "sky",
                  },
                  {
                    label: "Tap the shape",
                    body: "Format and vibe are single taps, not menus.",
                    chip: "pink",
                  },
                  {
                    label: "See the preview",
                    body: "The outline and metadata tell you what you're making.",
                    chip: "mint",
                  },
                  {
                    label: "Remix, don't restart",
                    body: "Quick tweaks after generation beat starting over.",
                    chip: "slate",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-2xl bg-white/70 p-4 ring-1 ring-slate-200/70"
                  >
                    <span className={`chip chip-${s.chip} mb-2`}>
                      {s.label}
                    </span>
                    <p className="text-sm leading-snug text-ink-500">
                      {s.body}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Cast cards */}
          {characters && characters.length > 0 && (
            <section>
              <h3 className="mb-3 text-lg font-semibold tracking-tight text-ink-900">
                Cast
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {characters.map((c) => (
                  <article
                    key={c.role}
                    className="glass rounded-3xl p-5 shadow-card"
                  >
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-pink-600">
                      {ROLE_LABEL[c.role]}
                    </div>
                    <div className="text-lg font-semibold text-ink-900">
                      {c.name}
                    </div>
                    <div className="mb-2 text-xs text-ink-400">
                      Voice: {c.voiceLabel}
                    </div>
                    {c.bio && (
                      <div className="mb-2 text-xs italic text-ink-500">
                        {c.bio}
                      </div>
                    )}
                    <p className="text-sm leading-relaxed text-ink-700">
                      {c.persona}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Transcript */}
          {Object.keys(sceneTurns).length > 0 && (
            <section>
              <h3 className="mb-3 text-lg font-semibold tracking-tight text-ink-900">
                Transcript
              </h3>
              <div className="flex flex-col gap-5">
                {Object.keys(sceneTurns)
                  .map((k) => Number(k))
                  .sort((a, b) => a - b)
                  .map((idx) => (
                    <div key={idx}>
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-600">
                        Scene {idx}
                      </div>
                      <div className="flex flex-col gap-2.5">
                        {sceneTurns[idx]!.map((t) => {
                          const char = characterByRole.get(t.speaker);
                          return (
                            <div
                              key={t.sequence}
                              className="rounded-2xl bg-white/70 p-4 ring-1 ring-slate-200/70"
                            >
                              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-pink-600">
                                {char ? char.name : t.speaker}
                              </div>
                              <div className="text-sm leading-relaxed text-ink-700">
                                {t.text}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* Live event log (collapsed) */}
          {hasStarted && events.length > 0 && (
            <details className="rounded-2xl bg-white/50 p-4 text-xs ring-1 ring-slate-200/60">
              <summary className="cursor-pointer font-medium text-ink-500">
                Live events ({events.length})
              </summary>
              <div className="mt-3 flex max-h-60 flex-col gap-1 overflow-auto font-mono text-[11px] text-ink-500">
                {events.map((e, i) => (
                  <div key={i}>
                    <strong className="text-ink-700">{e.event}</strong>
                    {e.message ? ` — ${e.message}` : ""}
                    {typeof e.percent === "number" ? ` (${e.percent}%)` : ""}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* Right column */}
        <IdeaRail onSelect={setTopic} />
      </div>

      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink-900/90 px-5 py-2.5 text-sm font-medium text-white shadow-glow">
          {toast}
        </div>
      )}
    </div>
  );
}

function VoiceCard({
  voice,
  selected,
  disabled,
  onToggle,
}: {
  voice: VoiceOption;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  function togglePreview(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      a.currentTime = 0;
      setPlaying(false);
    } else {
      a.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    }
  }

  return (
    <div
      onClick={() => !disabled && onToggle()}
      className={`cursor-pointer rounded-2xl bg-white/80 p-3 ring-1 transition ${
        selected
          ? "ring-2 ring-sky-400 shadow-card"
          : "ring-slate-200 hover:ring-sky-200"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-ink-900">
            {voice.label}
          </div>
          <div className="text-[11px] capitalize text-ink-400">
            {voice.gender} · {voice.origin}
          </div>
        </div>
        <button
          type="button"
          onClick={togglePreview}
          className="grid h-8 w-8 place-items-center rounded-full bg-brand-gradient text-white shadow-card transition active:scale-95"
        >
          {playing ? (
            <svg width="10" height="10" viewBox="0 0 24 24">
              <rect x="6" y="5" width="4" height="14" rx="1" fill="white" />
              <rect x="14" y="5" width="4" height="14" rx="1" fill="white" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24">
              <path d="M7 5v14l12-7-12-7z" fill="white" />
            </svg>
          )}
        </button>
      </div>
      <audio
        ref={audioRef}
        src={`/voice-samples/${voice.id}.mp3`}
        preload="none"
        onEnded={() => setPlaying(false)}
      />
    </div>
  );
}
