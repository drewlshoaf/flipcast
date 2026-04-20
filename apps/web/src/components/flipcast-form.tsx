"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AVAILABLE_FORMATS,
  AVAILABLE_VIBES,
  ELEVENLABS_VOICES,
  MIN_SPEED,
  MAX_SPEED,
  SPEED_STEP,
  lengthPreset,
  formatConfig,
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

const ROLE_LABEL: Record<Character["role"], string> = {
  moderator: "Moderator",
  panelist_1: "Panelist",
  panelist_2: "Panelist",
};

type VoiceMode = "auto" | "pick";
type PlaybackStage = "idle" | "playing" | "waiting" | "finished";

interface FlipcastFormProps {
  topic: string;
  setTopic: (value: string) => void;
  defaultSpeed: number;
}

export function FlipcastForm({
  topic,
  setTopic,
  defaultSpeed,
}: FlipcastFormProps) {
  const [format, setFormat] = useState<FlipcastFormat>("panel");
  const [speed, setSpeed] = useState<number>(defaultSpeed);
  const [vibe, setVibe] = useState<FlipcastVibe>("serious");
  // Length picker is hidden for now; every Flipcast uses the "long" preset.
  const lengthMinutes = lengthPreset("long").minutes;
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("auto");
  const [pickedVoices, setPickedVoices] = useState<string[]>([]);

  const cfg = formatConfig(format);
  const eligibleVoices = useMemo(
    () => ELEVENLABS_VOICES.filter((v) => v.engines.includes(cfg.engine)),
    [cfg.engine],
  );

  // Reset picked voices when format changes (cast size may differ).
  useEffect(() => {
    setPickedVoices([]);
  }, [format]);

  const [submitting, setSubmitting] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [plan, setPlan] = useState<SequencePlan | null>(null);
  const [events, setEvents] = useState<SseEvent[]>([]);
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [outline, setOutline] = useState<SceneOutline[] | null>(null);
  const [topicContext, setTopicContext] = useState<string | null>(null);
  const [welcomeUrl, setWelcomeUrl] = useState<string | null>(null);
  const [sceneUrls, setSceneUrls] = useState<Record<number, string>>({});
  const [sceneTurns, setSceneTurns] = useState<
    Record<number, TranscriptTurn[]>
  >({});
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const [playback, setPlayback] = useState<{
    stage: PlaybackStage;
    index: number;
  }>({ stage: "idle", index: 0 });

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
    if (item.kind === "ad") return `/ads/ad-${item.adIndex + 1}.mp3`;
    if (item.kind === "welcome") return welcomeUrl;
    if (item.kind === "scene") return sceneUrls[item.sceneIndex] ?? null;
    return null;
  }

  function labelForItem(item: SequenceItem, totalAds: number): string {
    if (item.kind === "station_intro") return "Flipcast";
    if (item.kind === "ad")
      return `Ad ${item.adIndex + 1} of ${Math.min(totalAds, 6)}`;
    if (item.kind === "welcome") return "Welcome message";
    if (item.kind === "scene")
      return item.isFinal
        ? `Scene ${item.sceneIndex} (closing)`
        : `Scene ${item.sceneIndex}`;
    return "";
  }

  useEffect(() => {
    if (playback.stage !== "waiting" || !plan) return;
    const item = plan.items[playback.index];
    if (item && srcForItem(item)) {
      setPlayback({ stage: "playing", index: playback.index });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcomeUrl, sceneUrls, playback, plan]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
    setPlayback({ stage: "idle", index: 0 });
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

  const currentItem =
    plan && (playback.stage === "playing" || playback.stage === "waiting")
      ? plan.items[playback.index]
      : null;
  const currentSrc = currentItem ? srcForItem(currentItem) : null;

  const characterByRole = new Map(characters?.map((c) => [c.role, c]) ?? []);

  return (
    <>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="topic">Topic</label>
          <input
            id="topic"
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. the rise of containerized development environments"
            required
            minLength={3}
          />
        </div>

        <div className="field">
          <label>Format</label>
          <div className="format-grid">
            {AVAILABLE_FORMATS.map((f) => (
              <label
                key={f.id}
                className={`format-card ${format === f.id ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="format"
                  value={f.id}
                  checked={format === f.id}
                  onChange={() => setFormat(f.id)}
                />
                <div className="format-label">{f.label}</div>
                <div className="format-desc">{f.description}</div>
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="vibe">Vibe</label>
          <select
            id="vibe"
            value={vibe}
            onChange={(e) => setVibe(e.target.value as FlipcastVibe)}
          >
            {AVAILABLE_VIBES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label} — {v.description}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="speed">
            Speaker speed: {speed.toFixed(2)}x
            {Math.abs(speed - defaultSpeed) < 0.001 ? " (default)" : ""}
          </label>
          <input
            id="speed"
            type="range"
            min={MIN_SPEED}
            max={MAX_SPEED}
            step={SPEED_STEP}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          />
          <div className="hint">
            Default {defaultSpeed.toFixed(2)}x (set via FLIPCAST_DEFAULT_SPEED).{" "}
            {MIN_SPEED}x–{MAX_SPEED}x. Applies to every speaker in this
            Flipcast; ads and the station intro keep their fixed cadence.
          </div>
        </div>

        <div className="field">
          <label>Voices</label>
          <div className="voice-mode">
            <label>
              <input
                type="radio"
                name="voice-mode"
                value="auto"
                checked={voiceMode === "auto"}
                onChange={() => setVoiceMode("auto")}
              />
              Auto-pick voices (diverse, gender-matched)
            </label>
            <label>
              <input
                type="radio"
                name="voice-mode"
                value="pick"
                checked={voiceMode === "pick"}
                onChange={() => setVoiceMode("pick")}
              />
              Choose my own ({cfg.castSize} voice
              {cfg.castSize > 1 ? "s" : ""})
            </label>
          </div>

          {voiceMode === "pick" && (
            <div className="voice-grid">
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
              <div className="hint">
                Selected: {pickedVoices.length} / {cfg.castSize}
              </div>
            </div>
          )}
        </div>

        <button type="submit" disabled={submitting || !!requestId}>
          {submitting ? "Submitting…" : "Generate Flipcast"}
        </button>
      </form>

      {error && <div className="status error">{error}</div>}

      {currentItem && plan && (
        <section className="player">
          <h2>
            {labelForItem(currentItem, plan.totalAds)}
            {playback.stage === "waiting" ? " — buffering…" : ""}
          </h2>
          {currentSrc ? (
            <audio
              key={currentSrc}
              src={currentSrc}
              autoPlay
              controls
              onEnded={handleTrackEnded}
            >
              Your browser does not support audio playback.
            </audio>
          ) : (
            <div className="hint">
              Waiting for this segment to finish generating…
            </div>
          )}
          <div className="hint">
            Track {playback.index + 1} of {plan.items.length} · Target:{" "}
            {Math.round(plan.estimatedSeconds / 60)} min
          </div>
        </section>
      )}

      {events.length > 0 && (
        <div className="status">
          {events.map((e, i) => (
            <div key={i} className="evt">
              <strong>{e.event}</strong>
              {e.message ? ` — ${e.message}` : ""}
              {typeof e.percent === "number" ? ` (${e.percent}%)` : ""}
            </div>
          ))}
        </div>
      )}

      {topicContext && (
        <section className="topic-context">
          <h2>Episode</h2>
          <p>{topicContext}</p>
        </section>
      )}

      {characters && characters.length > 0 && (
        <section className="cast">
          <h2>Cast</h2>
          <div className="cast-grid">
            {characters.map((c) => (
              <article key={c.role} className="card">
                <div className="card-role">{ROLE_LABEL[c.role]}</div>
                <div className="card-name">{c.name}</div>
                <div className="card-voice">Voice: {c.voiceLabel}</div>
                {c.bio && <div className="card-bio">{c.bio}</div>}
                <p className="card-persona">{c.persona}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {outline && outline.length > 0 && (
        <section className="outline">
          <h2>Scene Outline</h2>
          <ol>
            {outline.map((o) => (
              <li key={o.sceneIndex}>
                <strong>Scene {o.sceneIndex}</strong> ({o.targetSeconds}s)
                {o.focus ? ` — ${o.focus}` : ""}
              </li>
            ))}
          </ol>
        </section>
      )}

      {Object.keys(sceneTurns).length > 0 && (
        <section className="transcript">
          <h2>Transcript</h2>
          {Object.keys(sceneTurns)
            .map((k) => Number(k))
            .sort((a, b) => a - b)
            .map((idx) => (
              <div key={idx} className="scene-block">
                <h3>Scene {idx}</h3>
                <div className="turns">
                  {sceneTurns[idx]!.map((t) => {
                    const char = characterByRole.get(t.speaker);
                    return (
                      <div key={t.sequence} className="turn">
                        <div className="turn-speaker">
                          {char ? char.name : t.speaker}
                        </div>
                        <div className="turn-text">{t.text}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </section>
      )}
    </>
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
      className={`voice-card ${selected ? "selected" : ""} ${disabled ? "disabled" : ""}`}
      onClick={() => !disabled && onToggle()}
    >
      <div className="voice-card-header">
        <div>
          <div className="voice-name">{voice.label}</div>
          <div className="voice-meta">
            {voice.gender} · {voice.origin}
          </div>
        </div>
        <button
          type="button"
          className="voice-preview"
          onClick={togglePreview}
        >
          {playing ? "■" : "▶"}
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
