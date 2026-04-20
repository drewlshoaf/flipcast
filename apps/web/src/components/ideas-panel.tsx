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

const CATEGORIES: { key: keyof IdeasPayload; label: string; hint: string }[] = [
  {
    key: "todaysNews",
    label: "Today's News",
    hint: "What people are talking about right now.",
  },
  {
    key: "learnAbout",
    label: "Learn About",
    hint: "Rotating niche, curious, learn-something topics.",
  },
  {
    key: "talkAbout",
    label: "Talk About",
    hint: "Gossip, trends, and social conversation starters.",
  },
];

export function IdeasPanel({ onSelect }: Props) {
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
    <aside className="ideas-panel">
      <div className="ideas-header">
        <h2>Ideas</h2>
        <button
          type="button"
          className="ideas-refresh"
          onClick={() => fetchIdeas(true)}
          disabled={loading}
          title="Generate fresh ideas"
        >
          {loading ? "…" : "↻"}
        </button>
      </div>

      {error && <div className="status error">{error}</div>}

      {CATEGORIES.map((cat) => {
        const list = (ideas?.[cat.key] as string[] | undefined) ?? [];
        return (
          <section key={cat.key} className="ideas-category">
            <h3>{cat.label}</h3>
            <div className="ideas-hint">{cat.hint}</div>
            <ul>
              {loading && list.length === 0
                ? Array.from({ length: 6 }).map((_, i) => (
                    <li key={i} className="ideas-skeleton" />
                  ))
                : list.map((idea, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        className="idea-btn"
                        onClick={() => onSelect(idea)}
                      >
                        {idea}
                      </button>
                    </li>
                  ))}
            </ul>
          </section>
        );
      })}
    </aside>
  );
}
