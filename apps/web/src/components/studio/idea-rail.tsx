"use client";

import { useEffect, useState } from "react";
import {
  PROMPT_DOT_CLASS,
  PROMPT_TILE_CLASS,
  SAMPLE_PROMPTS,
  type PromptAccent,
  type SamplePrompt,
} from "@/lib/sample-prompts";
import { useT } from "@/lib/i18n/client";

interface Props {
  onSelect: (topic: string) => void;
}

interface EnginePayload {
  concepts?: {
    prompt_concept: string;
  }[];
}

// Colors cycled across engine-generated prompts so the grid stays visually
// lively. Falls back to the static SAMPLE_PROMPTS accents if the engine
// returns nothing.
const PROMPT_ACCENTS: PromptAccent[] = [
  "sky",
  "pink",
  "mint",
  "violet",
  "amber",
];

const PROMPTS_COUNT = 18;

export function IdeaRail({ onSelect }: Props) {
  const t = useT();
  const [prompts, setPrompts] = useState<SamplePrompt[]>(SAMPLE_PROMPTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchEngine();
  }, []);

  // Single engine fetch populates the unified "More to start from" list.
  // On failure we keep the static prompt list so the grid is never empty.
  async function fetchEngine(refresh = false) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/prompts/home?limit=${PROMPTS_COUNT}${refresh ? "&refresh=1" : ""}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as EnginePayload;
      const list = Array.isArray(data.concepts) ? data.concepts : [];
      if (list.length === 0) return;

      const promptItems = list.slice(0, PROMPTS_COUNT).map((c, i) => ({
        text: c.prompt_concept,
        accent: PROMPT_ACCENTS[i % PROMPT_ACCENTS.length]!,
      }));
      if (promptItems.length > 0) setPrompts(promptItems);
    } catch {
      /* keep fallback prompts */
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className="glass sticky top-6 rounded-3xl p-6 shadow-card">
      <div className="mb-5">
        <h2 className="text-lg font-semibold tracking-tight text-ink-900">
          {t.ideaRail.title}
        </h2>
        <p className="text-xs text-ink-400">
          {t.ideaRail.subtitle}
        </p>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-pink-400" />
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-pink-600">
            {t.ideaRail.moreToStartFrom}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => fetchEngine(true)}
          disabled={loading}
          title={t.ideaRail.refreshTitle}
          className="grid h-7 w-7 place-items-center rounded-full bg-white/80 text-ink-500 ring-1 ring-slate-200 transition hover:text-pink-600 hover:ring-pink-300 disabled:opacity-50"
        >
          <span className={loading ? "animate-pulse-soft" : ""}>↻</span>
        </button>
      </div>
      <ul className="flex flex-col gap-2">
        {prompts.map((p) => (
          <li key={p.text}>
            <button
              type="button"
              onClick={() => onSelect(p.text)}
              className={`group flex w-full items-center gap-3 rounded-2xl p-3 text-left text-sm font-medium text-ink-700 ring-1 transition hover:-translate-y-0.5 hover:shadow-card ${PROMPT_TILE_CLASS[p.accent]}`}
            >
              <span
                className={`inline-block h-2 w-2 shrink-0 rounded-full ${PROMPT_DOT_CLASS[p.accent]}`}
                aria-hidden
              />
              <span className="flex-1 leading-snug">{p.text}</span>
              <span
                className="text-ink-400 transition group-hover:translate-x-0.5"
                aria-hidden
              >
                →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
