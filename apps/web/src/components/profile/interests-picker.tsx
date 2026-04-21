"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INTEREST_CATALOG } from "@flipaudio/types";

interface Props {
  initialSelected: string[];
}

export function InterestsPicker({ initialSelected }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelected),
  );
  const [savedSelected, setSavedSelected] = useState<Set<string>>(
    () => new Set(initialSelected),
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const dirty =
    selected.size !== savedSelected.size ||
    [...selected].some((v) => !savedSelected.has(v));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile/interests", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ interests: [...selected] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast(data?.error ?? "Couldn't save interests.");
        return;
      }
      setSavedSelected(new Set(selected));
      setToast("Interests saved.");
      router.refresh();
    } finally {
      setSaving(false);
      window.setTimeout(() => setToast(null), 2200);
    }
  }

  return (
    <section className="glass rounded-3xl p-6 shadow-card">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-ink-400">
            Interests
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            Tap what you care about. We use these to suggest topics — and the
            ads in your Flipcasts.
          </p>
        </div>
        <span className="text-xs text-ink-400">{selected.size} picked</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {INTEREST_CATALOG.map((i) => {
          const on = selected.has(i.id);
          return (
            <button
              key={i.id}
              type="button"
              onClick={() => toggle(i.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition ${
                on
                  ? "bg-brand-gradient text-white shadow-card"
                  : "bg-white/80 text-ink-700 ring-1 ring-slate-200 hover:bg-white"
              }`}
            >
              <span aria-hidden>{i.emoji}</span>
              <span>{i.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="inline-flex h-11 items-center rounded-full bg-ink-900 px-6 text-sm font-semibold text-white transition hover:scale-[1.02] disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save interests"}
        </button>
        {toast && (
          <span className="text-xs text-ink-500">{toast}</span>
        )}
      </div>
    </section>
  );
}
