"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Item {
  id: string;
  topic: string;
  vibe: string | null;
  format: string;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function PopularFlips() {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/flipcasts/popular?limit=25", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setItems((d?.items ?? []) as Item[]);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="glass flex h-full min-h-0 flex-col overflow-hidden rounded-[32px] p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <span className="chip chip-sky">Popular flips</span>
        {items && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">
            {items.length} · latest
          </span>
        )}
      </div>

      {items == null ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-2xl bg-white/60" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl bg-white/60 p-4 text-sm text-ink-500">
          No flips yet. Make the first one.
        </div>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
          {items.map((r) => (
            <li key={r.id}>
              <Link
                href={`/player/${r.id}`}
                className="block rounded-2xl bg-white/70 p-3 ring-1 ring-slate-200/70 transition hover:bg-white hover:shadow-card"
              >
                <div className="truncate text-sm font-semibold text-ink-900">
                  {r.topic}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-ink-500">
                  <span className="chip chip-pink capitalize">{r.format}</span>
                  {r.vibe && (
                    <span className="chip chip-mint capitalize">{r.vibe}</span>
                  )}
                  <span className="text-ink-400">· {timeAgo(r.createdAt)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
