"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface InterestPill {
  id: string;
  label: string;
  emoji: string;
}

interface ForMePayload {
  interests: InterestPill[];
  ideas: string[];
  generatedAt: string;
}

export function ForMeRail() {
  const [data, setData] = useState<ForMePayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/ideas/for-me", { cache: "no-store" });
      if (!res.ok) {
        setData({ interests: [], ideas: [], generatedAt: "" });
        return;
      }
      setData((await res.json()) as ForMePayload);
    } catch {
      setData({ interests: [], ideas: [], generatedAt: "" });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <section className="glass rounded-3xl p-6 shadow-card">
        <div className="text-sm font-semibold uppercase tracking-[0.12em] text-ink-400">
          Ideas for you
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse-soft rounded-2xl bg-white/60 ring-1 ring-slate-100"
            />
          ))}
        </div>
      </section>
    );
  }

  if (!data || data.interests.length === 0) {
    return (
      <section className="glass rounded-3xl p-6 shadow-card">
        <div className="text-sm font-semibold uppercase tracking-[0.12em] text-ink-400">
          Ideas for you
        </div>
        <p className="mt-3 text-sm text-ink-500">
          Pick a few interests on your{" "}
          <Link
            href="/profile"
            className="font-semibold text-ink-900 underline decoration-pink-300 underline-offset-4 hover:text-pink-600"
          >
            profile
          </Link>{" "}
          to get topic suggestions tuned to you.
        </p>
      </section>
    );
  }

  return (
    <section className="glass rounded-3xl p-6 shadow-card">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.12em] text-ink-400">
            Ideas for you
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {data.interests.map((i) => (
              <span
                key={i.id}
                className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-ink-700 ring-1 ring-slate-200"
              >
                <span aria-hidden>{i.emoji}</span>
                {i.label}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="grid h-9 w-9 place-items-center rounded-full bg-white/80 text-ink-500 ring-1 ring-slate-200 transition hover:text-pink-600 hover:ring-pink-300"
          title="Generate fresh ideas"
        >
          ↻
        </button>
      </div>
      {data.ideas.length === 0 ? (
        <p className="mt-4 text-sm text-ink-500">
          Couldn't generate fresh ideas just now — try the refresh.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
          {data.ideas.map((idea, i) => (
            <li key={i}>
              <Link
                href={`/studio?topic=${encodeURIComponent(idea)}`}
                className="block rounded-2xl bg-white/80 px-4 py-3 text-sm leading-snug text-ink-700 ring-1 ring-slate-200 transition hover:bg-white hover:text-ink-900 hover:shadow-card"
              >
                {idea}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
