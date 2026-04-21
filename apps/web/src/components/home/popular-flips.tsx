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

const CYCLE_MS = 4000;

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
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/flipcasts/popular?limit=10", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const list = (d?.items ?? []) as Item[];
        setItems(list);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Roll the cursor forward every CYCLE_MS. No-op if we have 0 or 1 items.
  useEffect(() => {
    if (!items || items.length < 2) return;
    const t = setInterval(() => {
      setCursor((c) => (c + 1) % items.length);
    }, CYCLE_MS);
    return () => clearInterval(t);
  }, [items]);

  if (items == null) {
    return (
      <div className="glass mb-4 rounded-[32px] p-5 shadow-card">
        <div className="mb-2 flex items-center justify-between">
          <span className="chip chip-sky">Popular flips</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">
            loading
          </span>
        </div>
        <div className="h-12 animate-pulse rounded-2xl bg-white/60" />
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  const current = items[cursor]!;

  return (
    <div className="glass relative mb-4 overflow-hidden rounded-[32px] p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <span className="chip chip-sky">Popular flips</span>
        <div className="flex gap-1" aria-hidden>
          {items.map((_, i) => (
            <span
              key={i}
              className={`inline-block h-1 w-1 rounded-full transition ${
                i === cursor ? "bg-ink-700" : "bg-ink-200"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Crossfade + slide-up transition using key on the inner div. */}
      <Link
        key={current.id}
        href={`/player/${current.id}`}
        className="block rounded-2xl bg-white/70 p-3 ring-1 ring-slate-200/70 transition animate-roll-in hover:bg-white hover:shadow-card"
      >
        <div className="truncate text-base font-semibold text-ink-900">
          {current.topic}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-500">
          <span className="chip chip-pink capitalize">{current.format}</span>
          {current.vibe && (
            <span className="chip chip-mint capitalize">{current.vibe}</span>
          )}
          <span className="text-ink-400">· {timeAgo(current.createdAt)}</span>
        </div>
      </Link>
    </div>
  );
}
