"use client";

import { useEffect, useMemo, useState } from "react";

interface RecentRun {
  id: string;
  topic: string;
  format: string;
  status: string;
  createdAt: string;
  welcomeAudioUrl: string | null;
}

interface SceneTurn {
  sequence: number;
  speaker: string;
  text: string;
}

interface TranscriptCharacter {
  role: string;
  name: string;
  voiceLabel?: string;
}

interface TranscriptBundle {
  sceneTurns: Record<string, SceneTurn[]>;
  characters: TranscriptCharacter[] | null;
  welcomeText: string | null;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// Renders one flipcast as a continuous human-readable transcript:
// "Welcome\n<text>\n\nScene 1\n<Speaker Name>\n<line>\n<Speaker Name>\n<line>...".
// Speaker names come from the cast (mapped from role); falls back to the
// raw role string if the role isn't found.
function renderOneTranscript(
  run: RecentRun,
  bundle: TranscriptBundle,
): string {
  const charByRole = new Map(
    (bundle.characters ?? []).map((c) => [c.role, c.name] as const),
  );
  const lines: string[] = [];
  lines.push(`=== ${run.topic} ===`);
  lines.push(
    `Format: ${run.format} · Created: ${new Date(run.createdAt).toLocaleString()} · ID: ${run.id}`,
  );
  lines.push("");

  if (bundle.characters && bundle.characters.length > 0) {
    lines.push("Cast");
    for (const c of bundle.characters) {
      lines.push(
        `  ${c.name}${c.voiceLabel ? ` (${c.voiceLabel})` : ""} — ${c.role}`,
      );
    }
    lines.push("");
  }

  if (bundle.welcomeText) {
    lines.push("Welcome");
    lines.push(bundle.welcomeText);
    lines.push("");
  }

  const sceneIndices = Object.keys(bundle.sceneTurns)
    .map((k) => Number(k))
    .sort((a, b) => a - b);

  for (const idx of sceneIndices) {
    lines.push(`Scene ${idx}`);
    for (const t of bundle.sceneTurns[String(idx)] ?? []) {
      lines.push(charByRole.get(t.speaker) ?? t.speaker);
      lines.push(t.text);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function renderCombined(
  pairs: { run: RecentRun; bundle: TranscriptBundle }[],
): string {
  return pairs
    .map(({ run, bundle }) => renderOneTranscript(run, bundle))
    .join("\n\n\n");
}

export function AdminTestPanel() {
  const [collapsed, setCollapsed] = useState(true);
  const [runs, setRuns] = useState<RecentRun[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [combining, setCombining] = useState(false);
  const [combined, setCombined] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedCount = selected.size;
  const completeCount = useMemo(
    () => runs.filter((r) => r.status === "complete").length,
    [runs],
  );

  async function loadRuns() {
    setLoadingList(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/flipcasts/recent?limit=30", {
        cache: "no-store",
      });
      if (!res.ok) {
        setError(`Couldn't load runs (${res.status})`);
        return;
      }
      const data = (await res.json()) as { runs: RecentRun[] };
      setRuns(data.runs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingList(false);
    }
  }

  // Load the list the first time the panel is expanded — keeps the request
  // off the studio page for users who never open the panel.
  useEffect(() => {
    if (!collapsed && runs.length === 0 && !loadingList) {
      void loadRuns();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed]);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function combine() {
    if (selectedCount === 0 || combining) return;
    setCombining(true);
    setError(null);
    setCopied(false);
    setCombined(null);
    try {
      // Preserve selection order in the combined doc — list order is
      // most-recent-first; we want the user's selected order to mirror that
      // for predictability. Pull bundles in parallel; order them by the
      // runs list.
      const idsInListOrder = runs
        .map((r) => r.id)
        .filter((id) => selected.has(id));
      const bundles = await Promise.all(
        idsInListOrder.map(async (id) => {
          const res = await fetch(`/api/flipcasts/${id}/transcript`, {
            cache: "no-store",
          });
          if (!res.ok) throw new Error(`transcript fetch ${id} → ${res.status}`);
          const bundle = (await res.json()) as TranscriptBundle;
          const run = runs.find((r) => r.id === id)!;
          return { run, bundle };
        }),
      );
      setCombined(renderCombined(bundles));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCombining(false);
    }
  }

  function copyCombined() {
    if (!combined) return;
    void navigator.clipboard.writeText(combined).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      },
      () => setError("Couldn't copy."),
    );
  }

  function downloadCombined() {
    if (!combined) return;
    const blob = new Blob([combined], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flipcast-combined-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function clearSelection() {
    setSelected(new Set());
    setCombined(null);
  }

  return (
    <section className="rounded-3xl bg-amber-50/70 p-4 ring-1 ring-amber-200">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="chip chip-pink text-[10px]">admin</span>
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-amber-800">
            Test panel — combine transcripts
          </h3>
          {selectedCount > 0 && (
            <span className="text-xs text-amber-700">
              {selectedCount} selected
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-200 hover:bg-white"
        >
          {collapsed ? "Open" : "Collapse"}
        </button>
      </header>

      {!collapsed && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-amber-900">
            <button
              type="button"
              onClick={loadRuns}
              disabled={loadingList}
              className="rounded-full bg-white px-3 py-1 font-medium text-ink-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
            >
              {loadingList ? "Loading…" : "Refresh list"}
            </button>
            <span>
              {runs.length} run{runs.length === 1 ? "" : "s"} ·{" "}
              {completeCount} complete
            </span>
            {selectedCount > 0 && (
              <button
                type="button"
                onClick={clearSelection}
                className="ml-auto rounded-full bg-white px-3 py-1 font-medium text-ink-700 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                Clear selection
              </button>
            )}
          </div>

          <ul className="flex max-h-72 flex-col gap-1 overflow-auto rounded-2xl bg-white/60 p-2 ring-1 ring-amber-100">
            {runs.length === 0 && !loadingList && (
              <li className="px-2 py-2 text-xs text-ink-500">
                No runs yet. Generate something from the studio first.
              </li>
            )}
            {runs.map((r) => {
              const isComplete = r.status === "complete";
              const isVoiceless = isComplete && r.welcomeAudioUrl == null;
              const checked = selected.has(r.id);
              return (
                <li key={r.id}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/80 ${
                      isComplete ? "" : "opacity-60"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => isComplete && toggleSelected(r.id)}
                      disabled={!isComplete}
                      className="h-4 w-4 accent-pink-600"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-900">
                      {r.topic}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] capitalize text-ink-700 ring-1 ring-slate-200">
                      {r.format}
                    </span>
                    {!isComplete && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] capitalize text-amber-800 ring-1 ring-amber-200">
                        {r.status.replace(/_/g, " ")}
                      </span>
                    )}
                    {isVoiceless && (
                      <span className="rounded-full bg-pink-100 px-2 py-0.5 text-[10px] text-pink-700 ring-1 ring-pink-200">
                        voiceless
                      </span>
                    )}
                    <span className="shrink-0 text-[11px] text-ink-400">
                      {timeAgo(r.createdAt)}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={combine}
              disabled={selectedCount === 0 || combining}
              className="rounded-full bg-brand-gradient px-5 py-2 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {combining
                ? "Combining…"
                : selectedCount === 0
                  ? "Combine"
                  : `Combine ${selectedCount}`}
            </button>
            {combined && (
              <>
                <button
                  type="button"
                  onClick={copyCombined}
                  className="rounded-full bg-white px-4 py-2 text-sm font-medium text-ink-700 ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={downloadCombined}
                  className="rounded-full bg-white px-4 py-2 text-sm font-medium text-ink-700 ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  Download .txt
                </button>
              </>
            )}
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 ring-1 ring-rose-200">
              {error}
            </div>
          )}

          {combined && (
            <textarea
              readOnly
              value={combined}
              onFocus={(e) => e.currentTarget.select()}
              className="h-96 w-full resize-y rounded-2xl border border-amber-100 bg-white p-4 font-mono text-xs leading-relaxed text-ink-800"
            />
          )}
        </div>
      )}
    </section>
  );
}
