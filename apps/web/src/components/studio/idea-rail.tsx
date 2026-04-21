"use client";

import { useEffect, useState } from "react";

interface IdeasPayload {
  todaysNews: string[];
  learnAbout: string[];
  talkAbout: string[];
  generatedAt?: string;
}

interface Props {
  onSelect: (topic: string) => void;
}

const CATEGORIES: {
  key: keyof IdeasPayload;
  label: string;
  hint: string;
  accent: "sky" | "pink" | "mint";
}[] = [
  {
    key: "todaysNews",
    label: "Today's News",
    hint: "Fresh takes with strong hooks.",
    accent: "sky",
  },
  {
    key: "learnAbout",
    label: "Learn About",
    hint: "Unexpected explainers and rabbit holes.",
    accent: "mint",
  },
  {
    key: "talkAbout",
    label: "Talk About",
    hint: "Conversation fuel and social tension.",
    accent: "pink",
  },
];

const ACCENT_CLASSES = {
  sky: {
    bar: "bg-sky-400",
    label: "text-sky-600",
    dot: "bg-sky-400",
  },
  pink: {
    bar: "bg-pink-400",
    label: "text-pink-600",
    dot: "bg-pink-400",
  },
  mint: {
    bar: "bg-emerald-400",
    label: "text-emerald-600",
    dot: "bg-emerald-400",
  },
} as const;

export function IdeaRail({ onSelect }: Props) {
  const [ideas, setIdeas] = useState<IdeasPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchIdeas();
  }, []);

  async function fetchIdeas(refresh = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ideas${refresh ? "?refresh=1" : ""}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Failed to load ideas.");
        return;
      }
      setIdeas(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ideas.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className="glass sticky top-6 rounded-3xl p-6 shadow-card">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink-900">
            Ideas
          </h2>
          <p className="text-xs text-ink-400">
            Tap one to drop it into your topic.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetchIdeas(true)}
          disabled={loading}
          title="Generate fresh ideas"
          className="grid h-9 w-9 place-items-center rounded-full bg-white/80 text-ink-500 ring-1 ring-slate-200 transition hover:text-pink-600 hover:ring-pink-300 disabled:opacity-50"
        >
          <span className={loading ? "animate-pulse-soft" : ""}>↻</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl bg-rose-50 p-3 text-xs text-rose-700 ring-1 ring-rose-100">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-5">
        {CATEGORIES.map((cat) => {
          const all = (ideas?.[cat.key] as string[] | undefined) ?? [];
          const list = all.slice(0, 3);
          const accent = ACCENT_CLASSES[cat.accent];
          return (
            <section key={cat.key}>
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${accent.dot}`}
                />
                <h3
                  className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${accent.label}`}
                >
                  {cat.label}
                </h3>
              </div>
              <p className="mb-2 text-[11px] leading-snug text-ink-400">
                {cat.hint}
              </p>
              <ul className="flex flex-col gap-1.5">
                {loading && list.length === 0
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <li
                        key={i}
                        className="h-9 animate-pulse-soft rounded-xl bg-white/60 ring-1 ring-slate-100"
                      />
                    ))
                  : list.map((idea, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => onSelect(idea)}
                          className="w-full rounded-xl bg-white/80 px-3 py-2 text-left text-sm leading-snug text-ink-700 ring-1 ring-slate-200/70 transition hover:bg-white hover:text-ink-900 hover:shadow-card"
                        >
                          {idea}
                        </button>
                      </li>
                    ))}
              </ul>
            </section>
          );
        })}
      </div>
    </aside>
  );
}
