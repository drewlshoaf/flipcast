"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TopicComposer } from "@/components/topic-composer";

export function HeroComposer() {
  const [topic, setTopic] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const trimmed = topic.trim();
  const canSubmit = trimmed.length >= 3 && !submitting;

  function go() {
    if (!canSubmit) return;
    setSubmitting(true);
    // Hand off to the Studio with the topic prefilled and auto=1 so the
    // Studio's existing auto-start flow fires Generate on arrival. For
    // anonymous users the signup gate intercepts, then redirects back here
    // and auto-starts after verification — same flow as clicking Generate
    // inside the Studio directly.
    const qs = new URLSearchParams({ topic: trimmed, auto: "1" });
    router.push(`/studio?${qs.toString()}`);
  }

  return (
    <TopicComposer
      topic={topic}
      onTopicChange={setTopic}
      actionButton={
        <button
          type="button"
          onClick={go}
          disabled={!canSubmit}
          className="w-full rounded-full bg-brand-gradient px-6 py-4 text-base font-semibold text-white shadow-glow transition hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Opening studio…" : "Make this flip"}
        </button>
      }
    />
  );
}
