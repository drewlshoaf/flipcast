"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TopicComposer } from "@/components/topic-composer";

type Step = "topic" | "vibe" | "format";

interface Choice {
  id: string;
  label: string;
  description: string;
  accent: string;
}

// Four headline vibes shown on home step 2. Each is an id from
// AVAILABLE_VIBES in @flipaudio/types; labels/descriptions are inlined here
// so we don't drag the whole types package into a home-only client bundle.
const HOME_VIBES: Choice[] = [
  {
    id: "sincere",
    label: "Sincere",
    description: "Earnest and direct.",
    accent: "bg-teal-50 text-teal-700 ring-teal-200 hover:ring-teal-300",
  },
  {
    id: "playful",
    label: "Playful",
    description: "Bright and witty.",
    accent: "bg-pink-50 text-pink-700 ring-pink-200 hover:ring-pink-300",
  },
  {
    id: "dramatic",
    label: "Dramatic",
    description: "Tense and cinematic.",
    accent: "bg-violet-50 text-violet-700 ring-violet-200 hover:ring-violet-300",
  },
  {
    id: "curious",
    label: "Curious",
    description: "Inquisitive and probing.",
    accent: "bg-cyan-50 text-cyan-700 ring-cyan-200 hover:ring-cyan-300",
  },
];

// Matches AVAILABLE_FORMATS ids in @flipaudio/types. Only the two enabled
// formats are offered on the home flow (Story is still "coming soon").
const HOME_FORMATS: Choice[] = [
  {
    id: "panel",
    label: "Panel",
    description: "Three voices. Contrast and debate.",
    accent: "bg-sky-50 text-sky-700 ring-sky-200 hover:ring-sky-300",
  },
  {
    id: "newscast",
    label: "Anchor",
    description: "One host. Clean news delivery.",
    accent: "bg-pink-50 text-pink-700 ring-pink-200 hover:ring-pink-300",
  },
];

export function HeroComposer() {
  const [step, setStep] = useState<Step>("topic");
  const [topic, setTopic] = useState("");
  const [vibe, setVibe] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const trimmed = topic.trim();
  const canAdvanceTopic = trimmed.length >= 3 && !submitting;

  function toVibe() {
    if (!canAdvanceTopic) return;
    setStep("vibe");
  }

  function toFormat(vibeId: string) {
    if (submitting) return;
    setVibe(vibeId);
    setStep("format");
  }

  function pickFormat(formatId: string) {
    if (submitting || !vibe) return;
    setSubmitting(true);
    // Hand off to the Studio with topic + vibe + format prefilled and auto=1
    // so the Studio's existing auto-start flow fires Generate on arrival.
    const qs = new URLSearchParams({
      topic: trimmed,
      vibe,
      format: formatId,
      auto: "1",
    });
    router.push(`/studio?${qs.toString()}`);
  }

  if (step === "topic") {
    return (
      <TopicComposer
        topic={topic}
        onTopicChange={setTopic}
        actionButton={
          <button
            type="button"
            onClick={toVibe}
            disabled={!canAdvanceTopic}
            className="w-full rounded-full bg-brand-gradient px-6 py-4 text-base font-semibold text-white shadow-glow transition hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Make this flip
          </button>
        }
      />
    );
  }

  const isVibe = step === "vibe";
  const choices = isVibe ? HOME_VIBES : HOME_FORMATS;
  const stepLabel = isVibe ? "step 2 · vibe" : "step 3 · format";
  const heading = isVibe ? "Pick a vibe" : "Pick a format";
  const onPick = isVibe ? toFormat : pickFormat;
  const back = isVibe
    ? { label: "Change topic", onClick: () => setStep("topic") }
    : { label: "Change vibe", onClick: () => setStep("vibe") };

  return (
    <section className="glass rounded-[32px] p-7 shadow-card">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={back.onClick}
            className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-ink-500 transition hover:text-ink-900"
          >
            <span aria-hidden>←</span> {back.label}
          </button>
          <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
            {heading}
          </h2>
          <p className="mt-1 line-clamp-2 text-sm text-ink-500">
            &ldquo;{trimmed}&rdquo;
            {vibe && !isVibe ? ` · ${vibe}` : ""}
          </p>
        </div>
        <span className="chip chip-pink hidden whitespace-nowrap md:inline-flex">
          {stepLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {choices.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c.id)}
            disabled={submitting}
            className={`rounded-2xl p-4 text-left ring-1 transition hover:shadow-card disabled:cursor-not-allowed disabled:opacity-60 ${c.accent}`}
          >
            <div className="text-base font-semibold">{c.label}</div>
            <div className="mt-1 text-xs opacity-80">{c.description}</div>
          </button>
        ))}
      </div>

      {submitting && (
        <div className="mt-4 text-center text-xs text-ink-400">
          Opening studio…
        </div>
      )}
    </section>
  );
}
