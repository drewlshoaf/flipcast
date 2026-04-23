"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  UI_FORMATS,
  VOICES,
  formatConfig,
  lengthPreset,
  stationIntroUrl,
  voiceGroupsFor,
  type FlipcastFormat,
  type SequenceItem,
  type SequencePlan,
  type VoiceGroup,
  type VoiceLanguage,
  type VoiceOption,
} from "@flipcast/types";
import { useT } from "@/lib/i18n/client";
import type {
  Character,
  SceneOutline,
  SseEvent,
  TranscriptTurn,
} from "@flipcast/types";
import { AdminTestPanel } from "./admin-test-panel";
import { IdeaRail } from "./idea-rail";
import { UserChip, type SessionUser } from "@/components/auth/user-chip";
import { EpisodeModal } from "@/components/player/episode-modal";
import { TopicComposer } from "@/components/topic-composer";

type VoiceEngine = "fish";
type PlaybackStage = "idle" | "playing" | "waiting" | "finished";

// Remix action ids are stable; labels come from the active dictionary.
const REMIX_ACTION_IDS = [
  "shorter-intro",
  "more-contrast",
  "softer-tone",
  "stronger-ending",
] as const;
type RemixActionId = (typeof REMIX_ACTION_IDS)[number];

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

interface StudioClientProps {
  defaultEngine: VoiceEngine;
  initialTopic?: string;
  initialFormat?: FlipcastFormat;
  initialEngine?: VoiceEngine;
  autoStart?: boolean;
  sessionUser: SessionUser | null;
}

export function StudioClient({
  defaultEngine,
  initialTopic = "",
  initialFormat,
  initialEngine,
  autoStart,
  sessionUser,
}: StudioClientProps) {
  const t = useT();
  const [topic, setTopic] = useState(initialTopic);
  const [format, setFormat] = useState<FlipcastFormat>(initialFormat ?? "panel");
  // English-only after the Spanish teardown; keep the local for clarity.
  const language: VoiceLanguage = "en";
  const [pickedVoices, setPickedVoices] = useState<string[]>([]);
  const autoStartFiredRef = useRef(false);

  const roleLabel = (role: Character["role"]): string =>
    role === "moderator" ? t.studio.roleLabel.moderator : t.studio.roleLabel.panelist;
  const remixLabel = (id: RemixActionId): string => {
    if (id === "shorter-intro") return t.studio.remixAction.shorterIntro;
    if (id === "more-contrast") return t.studio.remixAction.moreContrast;
    if (id === "softer-tone") return t.studio.remixAction.softerTone;
    return t.studio.remixAction.strongerEnding;
  };

  // Engine is admin-controlled via FLIPCAST_DEFAULT_ENGINE; only override if
  // the URL explicitly carried an engine (e.g. persisted across a signup
  // redirect). No user-facing toggle.
  const voiceEngine: VoiceEngine = initialEngine ?? defaultEngine;

  const lengthMinutes = lengthPreset("long").minutes;
  const cfg = formatConfig(format);

  // Voices the user can pick for the current engine + language. Ad-only
  // voices are excluded; format castSize drives how many they need to pick.
  const availableVoices: VoiceOption[] = VOICES.filter(
    (v) =>
      !v.adOnly &&
      v.provider === voiceEngine &&
      v.language === language,
  );

  // Reset picks any time the format or language changes — the previous picks
  // may not even exist in the new pool.
  useEffect(() => {
    setPickedVoices([]);
  }, [format, language]);

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

  // Admin-only voiceless mode: skip Fish synthesis end-to-end so prompt
  // tuning iterates fast. Toggle is hidden for non-admins; the API also
  // gates this so a tampered client can't enable it.
  const [transcriptOnly, setTranscriptOnly] = useState(false);
  const [voicelessRun, setVoicelessRun] = useState(false);

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
        if (evt.event === "synth_retry") {
          // Audio engine had a hiccup; worker is retrying. Toast auto-dismisses.
          setToast(evt.message ?? t.studio.errors.submitFailed);
        }
        if (evt.event === "moderation_rejected" || evt.event === "failed") {
          setError(evt.message ?? t.studio.errors.submitFailed);
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
    if (item.kind === "station_intro")
      return stationIntroUrl("en", pickedVoices);
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
      setError(t.studio.errors.topicTooShort);
      return;
    }
    if (pickedVoices.length !== cfg.castSize) {
      const fmtLabel = t.formats[format].label;
      const tmpl =
        cfg.castSize === 1
          ? t.studio.errors.pickVoicesOne
          : t.studio.errors.pickVoicesMany;
      setError(
        tmpl
          .replace("{n}", String(cfg.castSize))
          .replace("{format}", fmtLabel),
      );
      return;
    }
    // Gate first generation behind signup. Preserve topic/format/engine so
    // the user lands back in Studio with their work intact, and set auto=1
    // so the next page load fires Generate automatically.
    if (!sessionUser) {
      const params = new URLSearchParams({
        topic: topic.trim(),
        format,
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
    setVoicelessRun(false);
    setPlayback({ stage: "idle", index: 0 });
    setModalOpen(false);
    // Skip the ad rotation prefetch in voiceless mode — there's no player.
    if (!transcriptOnly) {
      void fetch("/api/ads/rotation?count=5", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const list = d?.ads as { url: string }[] | undefined;
          if (Array.isArray(list)) setAdRotation(list.map((a) => a.url));
        })
        .catch(() => void 0);
    }
    try {
      const res = await fetch("/api/flipcasts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          topic,
          format,
          locale: "en",
          lengthMinutes,
          engine: voiceEngine,
          voiceIds: pickedVoices,
          // Server gates this to admins; sending it from a non-admin client
          // is silently coerced to false on the server.
          transcriptOnly: sessionUser?.isAdmin ? transcriptOnly : false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? t.studio.errors.submitFailed);
        return;
      }
      setRequestId(data.requestId);
      if (data.sequence) setPlan(data.sequence as SequencePlan);
      // The server confirms whether transcript-only mode actually applied
      // (admin check). Mirror that into local state.
      const serverVoiceless = Boolean(data.transcriptOnly);
      setVoicelessRun(serverVoiceless);
      if (serverVoiceless) {
        // No audio to play — leave the modal closed; the inline transcript
        // section renders as the welcome + scenes stream in.
        setPlayback({ stage: "idle", index: 0 });
      } else {
        setPlayback({ stage: "playing", index: 0 });
        setModalOpen(true);
      }
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

  function handleRemix(id: RemixActionId) {
    const label = remixLabel(id);
    setToast(t.studio.remixSavedToast.replace("{label}", label));
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
            <span aria-hidden>←</span> {t.studio.backHome}
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink-900">
              {t.studio.title}
            </h1>
            <p className="text-xs text-ink-400">
              {t.studio.tagline}
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
              {t.studio.myLibrary}
            </Link>
          )}
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
                  {t.studio.formatHeader}
                </h3>
                <p className="text-sm text-ink-500">
                  {t.studio.formatHelp}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {UI_FORMATS.map((f) => {
                const accent = FORMAT_ACCENTS[f.accent];
                const selected = !f.disabled && format === f.id;
                const fmtDict = t.formats[f.id as FlipcastFormat];
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      if (f.disabled) {
                        setToast(
                          t.studio.formatComingSoonToast.replace(
                            "{label}",
                            fmtDict.label,
                          ),
                        );
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
                        {fmtDict.label}
                      </span>
                      {f.disabled && (
                        <span className="chip chip-mint text-[10px]">
                          {t.studio.comingSoon}
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
                      {fmtDict.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Voices. Voice language follows the app locale; no in-studio picker. */}
          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-ink-900">
                  {t.studio.voicesHeader}
                </h3>
              </div>
            </div>

            {/* Solo: pick one voice individually. Pals/Panel: pick a curated
                group so chemistry is intentional rather than DIY. */}
            {format === "newscast" ? (
              availableVoices.length === 0 ? (
                <div className="rounded-3xl bg-white/60 p-6 text-sm text-ink-500 ring-1 ring-slate-200/70">
                  {t.studio.voicesEmpty}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {availableVoices.map((v) => {
                    const selected = pickedVoices.includes(v.id);
                    const atCap =
                      !selected && pickedVoices.length >= cfg.castSize;
                    return (
                      <VoicePickCard
                        key={v.id}
                        voice={v}
                        selected={selected}
                        disabled={atCap}
                        onToggle={() => {
                          setPickedVoices((prev) =>
                            prev.includes(v.id)
                              ? prev.filter((x) => x !== v.id)
                              : [...prev, v.id],
                          );
                        }}
                      />
                    );
                  })}
                </div>
              )
            ) : (
              (() => {
                const groups = voiceGroupsFor(
                  format as "pals" | "panel",
                  language,
                );
                if (groups.length === 0) {
                  return (
                    <div className="rounded-3xl bg-white/60 p-6 text-sm text-ink-500 ring-1 ring-slate-200/70">
                      {t.studio.voicesEmpty}
                    </div>
                  );
                }
                return (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {groups.map((g) => {
                      const selected =
                        pickedVoices.length === g.voiceIds.length &&
                        g.voiceIds.every((id) => pickedVoices.includes(id));
                      return (
                        <VoiceGroupCard
                          key={g.id}
                          group={g}
                          selected={selected}
                          onSelect={() => setPickedVoices([...g.voiceIds])}
                        />
                      );
                    })}
                  </div>
                );
              })()
            )}
          </section>

          {/* Vibe was here — removed. The model picks tone from the topic. */}

          {/* Admin-only voiceless mode toggle. Skips Fish synthesis end-to-end
              so the prompt stack can be iterated on without waiting for
              audio. The transcript section below renders as scenes stream in. */}
          {sessionUser?.isAdmin && (
            <label className="flex items-center justify-between gap-3 rounded-2xl bg-amber-50/70 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
              <span className="flex items-center gap-2">
                <span className="chip chip-pink text-[10px]">admin</span>
                <span className="font-medium">Transcript only</span>
                <span className="text-xs text-amber-700">
                  Skip Fish — generate text only. Fast iteration for prompt tuning.
                </span>
              </span>
              <input
                type="checkbox"
                checked={transcriptOnly}
                onChange={(e) => setTranscriptOnly(e.target.checked)}
                disabled={hasStarted}
                className="h-4 w-4 accent-pink-600"
              />
            </label>
          )}

          {/* Generate CTA */}
          <button
            type="button"
            onClick={submit}
            disabled={
              submitting ||
              !topic ||
              topic.trim().length < 3 ||
              pickedVoices.length !== cfg.castSize ||
              hasStarted
            }
            className="w-full rounded-full bg-brand-gradient px-6 py-4 text-base font-semibold text-white shadow-glow transition hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting
              ? t.studio.starting
              : hasStarted
                ? t.studio.generating
                : transcriptOnly && sessionUser?.isAdmin
                  ? "Generate transcript"
                  : t.studio.generate}
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
              {t.studio.reopenPlayer}
            </button>
          )}

          {/* Remix actions */}
          {hasStarted && (
            <section className="rounded-3xl bg-white/60 p-5 ring-1 ring-slate-200/70">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-ink-900">
                    {t.studio.remixHeader}
                  </h3>
                  <p className="text-xs text-ink-400">
                    {t.studio.remixHelp}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resetSession();
                    setToast(t.studio.startOverToast);
                  }}
                  className="h-9 rounded-full bg-white/80 px-4 text-xs font-medium text-ink-700 ring-1 ring-slate-200 transition hover:bg-white"
                >
                  {t.studio.startOver}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {REMIX_ACTION_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleRemix(id)}
                    className="rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-ink-700 ring-1 ring-slate-200 transition hover:bg-white hover:shadow-card"
                  >
                    {remixLabel(id)}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Voiceless-mode banner + welcome card. Replaces the audio player
              when an admin runs in transcript-only mode. */}
          {voicelessRun && hasStarted && (
            <section className="rounded-3xl bg-amber-50/80 p-5 ring-1 ring-amber-200">
              <div className="mb-2 flex items-center gap-2">
                <span className="chip chip-pink text-[10px]">admin</span>
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-amber-800">
                  Transcript-only run
                </h3>
              </div>
              <p className="text-sm text-amber-900/80">
                Fish synthesis skipped. Cast, welcome, scenes, and validator all run; transcript renders below as scenes stream in.
              </p>
              {welcomeText && (
                <div className="mt-4 rounded-2xl bg-white/80 p-4 ring-1 ring-amber-100">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-pink-600">
                    Welcome
                  </div>
                  <p className="text-sm leading-relaxed text-ink-700">
                    {welcomeText}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Cast cards */}
          {characters && characters.length > 0 && (
            <section>
              <h3 className="mb-3 text-lg font-semibold tracking-tight text-ink-900">
                {t.studio.castHeader}
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {characters.map((c) => (
                  <article
                    key={c.role}
                    className="glass rounded-3xl p-5 shadow-card"
                  >
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-pink-600">
                      {roleLabel(c.role)}
                    </div>
                    <div className="text-lg font-semibold text-ink-900">
                      {c.name}
                    </div>
                    <div className="mb-2 text-xs text-ink-400">
                      {t.studio.voicePrefix}: {c.voiceLabel}
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
                  {t.studio.transcriptHeader}
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
                        {t.studio.sceneLabel} {idx}
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

          {/* Admin-only test panel: pick completed flipcasts and combine their
              existing transcripts into one document. No re-runs — pure SELECT
              from the DB and merge client-side. */}
          {sessionUser?.isAdmin && <AdminTestPanel />}
        </div>

        {/* Right column */}
        <IdeaRail onSelect={setTopic} />
      </div>

      <EpisodeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        topic={topic}
        requestId={requestId}
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


function VoicePickCard({
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
      role="button"
      aria-pressed={selected}
      className={`cursor-pointer rounded-2xl bg-white/85 p-3 ring-1 transition ${
        selected
          ? "ring-2 ring-sky-400 shadow-cardHover"
          : "ring-slate-200 hover:ring-sky-200 hover:shadow-card"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink-900">
            {voice.label}
          </div>
          <div className="truncate text-[11px] capitalize text-ink-400">
            {voice.gender} · {voice.origin}
          </div>
        </div>
        <button
          type="button"
          onClick={togglePreview}
          aria-label={playing ? "Stop preview" : "Play preview"}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-gradient text-white shadow-card transition active:scale-95"
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

// Card for a curated voice combo (Pals duo or Panel trio). One play button
// previews the whole combo's chemistry from a static MP3; absence of the
// recording is handled silently so groups can ship before their previews are
// produced. Selecting the card sets pickedVoices to the group's voiceIds in
// order, so the worker pipeline gets the same shape it always did.
function VoiceGroupCard({
  group,
  selected,
  onSelect,
}: {
  group: VoiceGroup;
  selected: boolean;
  onSelect: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [previewUnavailable, setPreviewUnavailable] = useState(false);

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

  // Names of the constituent voices (resolved client-side via the catalog).
  const voiceNames = group.voiceIds
    .map((id) => VOICES.find((v) => v.id === id)?.label ?? id)
    .join(" · ");

  return (
    <div
      onClick={onSelect}
      role="button"
      aria-pressed={selected}
      className={`cursor-pointer rounded-3xl bg-white/85 p-4 ring-1 transition ${
        selected
          ? "ring-2 ring-sky-400 shadow-cardHover"
          : "ring-slate-200 hover:ring-sky-200 hover:shadow-card"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold text-ink-900">
            {group.label}
          </div>
          {group.description && (
            <div className="mt-1 text-xs text-ink-500">{group.description}</div>
          )}
          <div className="mt-2 text-[11px] uppercase tracking-[0.1em] text-ink-400">
            {voiceNames}
          </div>
        </div>
        <button
          type="button"
          onClick={togglePreview}
          disabled={previewUnavailable}
          aria-label={playing ? "Stop preview" : "Play preview"}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-white shadow-card transition active:scale-95 ${
            previewUnavailable
              ? "cursor-not-allowed bg-slate-300"
              : "bg-brand-gradient"
          }`}
        >
          {playing ? (
            <svg width="12" height="12" viewBox="0 0 24 24">
              <rect x="6" y="5" width="4" height="14" rx="1" fill="white" />
              <rect x="14" y="5" width="4" height="14" rx="1" fill="white" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24">
              <path d="M7 5v14l12-7-12-7z" fill="white" />
            </svg>
          )}
        </button>
      </div>
      <audio
        ref={audioRef}
        src={group.previewUrl}
        preload="none"
        onEnded={() => setPlaying(false)}
        onError={() => {
          setPlaying(false);
          setPreviewUnavailable(true);
        }}
      />
    </div>
  );
}
