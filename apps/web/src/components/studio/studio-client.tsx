"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AVAILABLE_VIBES,
  UI_FORMATS,
  formatConfig,
  lengthPreset,
  type FlipcastFormat,
  type FlipcastVibe,
  type SequenceItem,
  type SequencePlan,
} from "@flipaudio/types";
import type {
  Character,
  SceneOutline,
  SseEvent,
  TranscriptTurn,
} from "@flipaudio/types";
import { IdeaRail } from "./idea-rail";
import { UserChip, type SessionUser } from "@/components/auth/user-chip";
import { EpisodeModal } from "@/components/player/episode-modal";
import { TopicComposer } from "@/components/topic-composer";

const ROLE_LABEL: Record<Character["role"], string> = {
  moderator: "Moderator",
  panelist_1: "Panelist",
  panelist_2: "Panelist",
};

type VoiceEngine = "fish";
type PlaybackStage = "idle" | "playing" | "waiting" | "finished";

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
  curious: {
    chip: "bg-cyan-100 text-cyan-700",
    ring: "ring-cyan-300",
    bg: "bg-cyan-50/50",
  },
  playful: {
    chip: "bg-pink-100 text-pink-700",
    ring: "ring-pink-300",
    bg: "bg-pink-50/50",
  },
  sincere: {
    chip: "bg-teal-100 text-teal-700",
    ring: "ring-teal-300",
    bg: "bg-teal-50/50",
  },
  relaxed: {
    chip: "bg-emerald-100 text-emerald-700",
    ring: "ring-emerald-300",
    bg: "bg-emerald-50/50",
  },
};

interface StudioClientProps {
  defaultEngine: VoiceEngine;
  initialTopic?: string;
  initialFormat?: FlipcastFormat;
  initialVibe?: FlipcastVibe;
  initialEngine?: VoiceEngine;
  autoStart?: boolean;
  sessionUser: SessionUser | null;
}

export function StudioClient({
  defaultEngine,
  initialTopic = "",
  initialFormat,
  initialVibe,
  initialEngine,
  autoStart,
  sessionUser,
}: StudioClientProps) {
  const [topic, setTopic] = useState(initialTopic);
  const [format, setFormat] = useState<FlipcastFormat>(initialFormat ?? "panel");
  const [vibe, setVibe] = useState<FlipcastVibe>(initialVibe ?? "curious");
  const autoStartFiredRef = useRef(false);

  // Engine is admin-controlled via FLIPAUDIO_DEFAULT_ENGINE; only override if
  // the URL explicitly carried an engine (e.g. persisted across a signup
  // redirect). No user-facing toggle.
  const voiceEngine: VoiceEngine = initialEngine ?? defaultEngine;

  const lengthMinutes = lengthPreset("long").minutes;
  const cfg = formatConfig(format);

  // Session / generation state
  const [submitting, setSubmitting] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [plan, setPlan] = useState<SequencePlan | null>(null);
  const [events, setEvents] = useState<SseEvent[]>([]);
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [outline, setOutline] = useState<SceneOutline[] | null>(null);
  const [topicContext, setTopicContext] = useState<string | null>(null);
  const [welcomeText, setWelcomeText] = useState<string | null>(null);
  const [welcomeUrl, setWelcomeUrl] = useState<string | null>(null);
  const [sceneUrls, setSceneUrls] = useState<Record<number, string>>({});
  const [adRotation, setAdRotation] = useState<string[] | null>(null);
  const [sceneTurns, setSceneTurns] = useState<
    Record<number, TranscriptTurn[]>
  >({});
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  // Playback state — audio auto-plays inside the EpisodeModal; no play/pause.
  const [playback, setPlayback] = useState<{
    stage: PlaybackStage;
    index: number;
  }>({ stage: "idle", index: 0 });
  const [modalOpen, setModalOpen] = useState(false);

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
                welcomeText?: string;
                outline?: SceneOutline[];
              }
            | undefined;
          if (data?.characters) setCharacters(data.characters);
          if (data?.topicContext) setTopicContext(data.topicContext);
          if (data?.welcomeText) setWelcomeText(data.welcomeText);
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

  // Advance from waiting → playing the moment the next asset becomes available.
  useEffect(() => {
    if (playback.stage !== "waiting" || !plan) return;
    const item = plan.items[playback.index];
    if (item && srcForItem(item)) {
      setPlayback({ stage: "playing", index: playback.index });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcomeUrl, sceneUrls, adRotation, playback, plan]);

  async function submit() {
    if (!topic || topic.trim().length < 3) {
      setError("Give us a topic with at least a few words.");
      return;
    }
    // Gate first generation behind signup. Preserve topic/format/vibe/engine
    // so the user lands back in Studio with their work intact, and set
    // auto=1 so the next page load fires Generate automatically.
    if (!sessionUser) {
      const params = new URLSearchParams({
        topic: topic.trim(),
        format,
        vibe,
        engine: voiceEngine,
        auto: "1",
      });
      const next = `/studio?${params.toString()}`;
      window.location.href = `/signup?next=${encodeURIComponent(next)}`;
      return;
    }
    setSubmitting(true);
    setError(null);
    setEvents([]);
    setCharacters(null);
    setOutline(null);
    setTopicContext(null);
    setWelcomeText(null);
    setWelcomeUrl(null);
    setSceneUrls({});
    setSceneTurns({});
    setAdRotation(null);
    setPlan(null);
    setPlayback({ stage: "idle", index: 0 });
    setModalOpen(false);
    // Fire ad rotation fetch in parallel so the URLs are ready by the time
    // the player hits its first ad slot.
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
          engine: voiceEngine,
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
      setModalOpen(true);
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
    // Breather before the next item. Longer after an ad so the transition
    // back to show content lands with some air around it. Advancing to
    // "waiting" lets the existing advance effect promote to "playing" the
    // moment the next src is available (usually immediately).
    const justEnded = plan.items[playback.index];
    const gapMs = justEnded?.kind === "ad" ? 2500 : 1000;
    setTimeout(() => {
      setPlayback({ stage: "waiting", index: nextIndex });
    }, gapMs);
  }

  function resetSession() {
    esRef.current?.close();
    setRequestId(null);
    setPlan(null);
    setEvents([]);
    setCharacters(null);
    setOutline(null);
    setTopicContext(null);
    setWelcomeText(null);
    setWelcomeUrl(null);
    setSceneUrls({});
    setAdRotation(null);
    setSceneTurns({});
    setError(null);
    setPlayback({ stage: "idle", index: 0 });
  }

  // Auto-fire Generate once after a signup → /studio?auto=1 redirect, so the
  // user doesn't have to click the button a second time. Ref guards against
  // StrictMode double-mounts; we also strip the query so a refresh won't
  // re-fire.
  useEffect(() => {
    if (!autoStart || !sessionUser || autoStartFiredRef.current) return;
    if (!topic || topic.trim().length < 3) return;
    autoStartFiredRef.current = true;
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/studio");
    }
    void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, sessionUser, topic]);

  const hasStarted = Boolean(plan && requestId);

  // Admin skip helpers. Find the next scene (and the final scene) in the
  // plan so we can jump playback forward when their audio is ready.
  function nextReadyScene(): number | null {
    if (!plan) return null;
    for (let i = playback.index + 1; i < plan.items.length; i++) {
      const item = plan.items[i]!;
      if (item.kind === "scene" && sceneUrls[item.sceneIndex]) return i;
    }
    return null;
  }
  function finalSceneIndex(): number | null {
    if (!plan) return null;
    for (let i = plan.items.length - 1; i >= 0; i--) {
      const item = plan.items[i]!;
      if (
        item.kind === "scene" &&
        item.isFinal &&
        sceneUrls[item.sceneIndex]
      )
        return i;
    }
    return null;
  }
  const nextSceneIdx = nextReadyScene();
  const finalSceneIdx = finalSceneIndex();
  const canSkipToNextScene =
    sessionUser?.isAdmin === true &&
    hasStarted &&
    playback.stage !== "finished" &&
    nextSceneIdx != null;
  const canSkipToEnd =
    sessionUser?.isAdmin === true &&
    hasStarted &&
    playback.stage !== "finished" &&
    finalSceneIdx != null &&
    finalSceneIdx > playback.index &&
    plan != null &&
    Object.keys(sceneUrls).length === plan.totalScenes;

  function skipToNextScene() {
    if (nextSceneIdx == null) return;
    setPlayback({ stage: "playing", index: nextSceneIdx });
  }
  function skipToEnd() {
    if (finalSceneIdx == null) return;
    setPlayback({ stage: "playing", index: finalSceneIdx });
  }

  const currentItem =
    plan && (playback.stage === "playing" || playback.stage === "waiting")
      ? plan.items[playback.index] ?? null
      : null;
  const currentSrc = currentItem ? srcForItem(currentItem) : null;

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
    const draft = { topic, format, vibe };
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
              flip.audio Studio
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
          {/* Topic composer — same component as the home hero. */}
          <TopicComposer topic={topic} onTopicChange={setTopic} />

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

          {/* Generate CTA */}
          <button
            type="button"
            onClick={submit}
            disabled={
              submitting || !topic || topic.trim().length < 3 || hasStarted
            }
            className="w-full rounded-full bg-brand-gradient px-6 py-4 text-base font-semibold text-white shadow-glow transition hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting
              ? "Starting up…"
              : hasStarted
                ? "Generating…"
                : "Generate flip.audio"}
          </button>

          {/* Error */}
          {error && (
            <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200">
              {error}
            </div>
          )}

          {/* Reopen pill — session active but modal dismissed. */}
          {hasStarted && !modalOpen && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="glass inline-flex items-center gap-2 self-start rounded-full px-5 py-2.5 text-sm font-semibold text-ink-900 shadow-card transition hover:shadow-cardHover"
            >
              <span className="inline-flex h-2 w-2 rounded-full bg-pink-400 animate-pulse-soft" />
              Reopen player
            </button>
          )}

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

          {/* Transcript — admin-only while we iterate on copy/markup. */}
          {sessionUser?.isAdmin && Object.keys(sceneTurns).length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-lg font-semibold tracking-tight text-ink-900">
                  Transcript
                </h3>
                <span className="chip chip-pink">admin</span>
              </div>
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

          {/* Admin-only diagnostic panel: playback state + resource readiness
              + live SSE event log. Surfaces when things hang. */}
          {sessionUser?.isAdmin && hasStarted && (
            <details
              className="rounded-2xl bg-ink-900/5 p-4 text-xs ring-1 ring-slate-200/60"
              open
            >
              <summary className="cursor-pointer font-semibold text-ink-700">
                Admin diagnostics
              </summary>

              <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px] text-ink-600 md:grid-cols-4">
                <Diag
                  label="stage"
                  value={playback.stage}
                  bad={playback.stage === "waiting"}
                />
                <Diag
                  label="item"
                  value={
                    plan
                      ? `${Math.min(playback.index + 1, plan.items.length)}/${plan.items.length}`
                      : "—"
                  }
                />
                <Diag
                  label="current"
                  value={
                    currentItem
                      ? currentItem.kind === "scene"
                        ? `scene${currentItem.sceneIndex}`
                        : currentItem.kind === "ad"
                          ? `ad${currentItem.adIndex}`
                          : currentItem.kind
                      : "—"
                  }
                />
                <Diag
                  label="src"
                  value={currentSrc ? "loaded" : "pending"}
                  bad={!!currentItem && !currentSrc}
                />
                <Diag
                  label="welcome"
                  value={welcomeUrl ? "ready" : "pending"}
                  bad={hasStarted && !welcomeUrl}
                />
                <Diag
                  label="scenes"
                  value={
                    plan
                      ? `${Object.keys(sceneUrls).length}/${plan.totalScenes}`
                      : "—"
                  }
                />
                <Diag
                  label="ads"
                  value={adRotation ? `${adRotation.length}` : "pending"}
                  bad={!adRotation}
                />
                <Diag
                  label="request"
                  value={requestId ? requestId.slice(0, 8) : "—"}
                />
              </div>

              <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                Events ({events.length})
              </div>
              <div className="mt-1 flex max-h-60 flex-col gap-1 overflow-auto font-mono text-[11px] text-ink-500">
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

      <EpisodeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        topic={topic}
        plan={plan}
        stage={playback.stage}
        playbackIndex={playback.index}
        currentItem={currentItem ?? null}
        currentSrc={currentSrc}
        characters={characters}
        sceneTurns={sceneTurns}
        adRotation={adRotation}
        onEnded={handleTrackEnded}
        onError={handleTrackEnded}
        adminView={sessionUser?.isAdmin ?? false}
        canSkipToNextScene={canSkipToNextScene}
        canSkipToEnd={canSkipToEnd}
        onSkipToNextScene={skipToNextScene}
        onSkipToEnd={skipToEnd}
      />

      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink-900/90 px-5 py-2.5 text-sm font-medium text-white shadow-glow">
          {toast}
        </div>
      )}
    </div>
  );
}

function Diag({
  label,
  value,
  bad,
}: {
  label: string;
  value: string;
  bad?: boolean;
}) {
  return (
    <div
      className={`rounded-md px-2 py-1 ring-1 ${
        bad
          ? "bg-rose-50 text-rose-700 ring-rose-200"
          : "bg-white/70 text-ink-700 ring-slate-200"
      }`}
    >
      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-400">
        {label}
      </div>
      <div className="truncate">{value}</div>
    </div>
  );
}
