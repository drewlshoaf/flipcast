"use client";

import {
  PROMPTS,
  PROMPT_DOT_CLASS,
  PROMPT_TILE_CLASS,
} from "@/components/home/prompts";

interface Props {
  onSelect: (topic: string) => void;
}

export function IdeaRail({ onSelect }: Props) {
  return (
    <aside className="glass sticky top-6 rounded-3xl p-6 shadow-card">
      <div className="mb-5">
        <h2 className="text-lg font-semibold tracking-tight text-ink-900">
          Prompts
        </h2>
        <p className="text-xs text-ink-400">
          Tap any prompt to drop it into your topic.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {PROMPTS.map((p) => (
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
