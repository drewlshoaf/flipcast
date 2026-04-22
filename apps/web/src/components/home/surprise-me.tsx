"use client";

import { useRouter } from "next/navigation";
import { BUBBLES } from "./topic-bubbles";

// Picks a random bubble topic and routes to /studio with it prefilled.
// Tiny client island so the rest of the home page can stay an RSC.
export function SurpriseMe() {
  const router = useRouter();

  function go() {
    const pick = BUBBLES[Math.floor(Math.random() * BUBBLES.length)];
    if (!pick) return;
    router.push(`/studio?topic=${encodeURIComponent(pick.text)}`);
  }

  return (
    <button
      type="button"
      onClick={go}
      className="inline-flex h-12 items-center gap-2 rounded-full bg-white/85 px-6 text-sm font-semibold text-ink-700 ring-1 ring-slate-200 shadow-card transition hover:bg-white hover:shadow-cardHover"
    >
      <span aria-hidden>🎲</span>
      Surprise me
    </button>
  );
}
