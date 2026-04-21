"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TopicComposer } from "@/components/topic-composer";

type Step = "topic" | "vibe";

// Four headline vibes shown on the home step-2. Matches the first four entries
// of AVAILABLE_VIBES in @flipaudio/types so the labels read the same in Studio
// and home. (Kept local to avoid dragging the whole types package into a
// hero-only client component.)
const HOME_VIBES: { id: string; label: string; description: string; accent: string }[] = [
  {
    id: "serious",
    label: "Serious",
    description: "Measured and weighty.",
    accent: "bg-sky-50 text-sky-700 ring-sky-200 hover:ring-sky-300",
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
    id: "cozy",
    label: "Cozy",
    description: "Warm and easygoing.",
    accent: "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:ring-emerald-300",
  },
];

export function HeroComposer() {
  const [step, setStep] = useState<Step>("topic");
  const [topic, setTopic] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const trimmed = topic.trim();
  const canAdvance = trimmed.length >= 3 && !submitting;

  function goToVibe() {
    if (!canAdvance) return;
    setStep("vibe");
  }

  function pickVibe(vibeId: string) {
    if (submitting) return;
    setSubmitting(true);
    // Hand off to the Studio with topic + vibe prefilled and auto=1 so the
    // Studio's existing auto-start flow fires Generate on arrival. For
    // anonymous users the signup gate intercepts and then resumes here.
    const qs = new URLSearchParams({
      topic: trimmed,
      vibe: vibeId,
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
            onClick={goToVibe}
            disabled={!canAdvance}
            className="w-full rounded-full bg-brand-gradient px-6 py-4 text-base font-semibold text-white shadow-glow transition hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Make this flip
          </button>
        }
      />
    );
  }

  // step === "vibe"
  return (
    <section className="glass rounded-[32px] p-7 shadow-card">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => setStep("topic")}
            className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-ink-500 transition hover:text-ink-900"
          >
            <span aria-hidden>←</span> Change topic
          </button>
          <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
            Pick a vibe
          </h2>
          <p className="mt-1 line-clamp-2 text-sm text-ink-500">
            &ldquo;{trimmed}&rdquo;
          </p>
        </div>
        <span className="chip chip-pink hidden md:inline-flex">step 2</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {HOME_VIBES.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => pickVibe(v.id)}
            disabled={submitting}
            className={`rounded-2xl p-4 text-left ring-1 transition hover:shadow-card disabled:cursor-not-allowed disabled:opacity-60 ${v.accent}`}
          >
            <div className="text-base font-semibold">{v.label}</div>
            <div className="mt-1 text-xs opacity-80">{v.description}</div>
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
