"use client";

import { useCallback, useMemo, useRef, useState } from "react";

export interface SourceRun {
  id: string;
  topic: string;
  format: string;
  locale: string;
  engine: string;
  voiceIds: string[];
  lengthMinutes: number;
  createdAt: string;
  ownerEmail: string | null;
}

type JobStatus =
  | "pending"
  | "submitting"
  | "queued"
  | "running"
  | "complete"
  | "failed";

interface Job {
  sourceId: string;
  sourceTopic: string;
  sourceFormat: string;
  sourceLocale: string;
  // Populated once the new flipcast request row is created.
  newRequestId: string | null;
  status: JobStatus;
  error: string | null;
  // Transcript of the new run, once complete.
  transcript: string | null;
  startedAt: number | null;
  completedAt: number | null;
}

const POLL_INTERVAL_MS = 3000;
// Upper bound on how long we'll wait for a single run to land. Pipelines
// normally finish in under 2 minutes; 10 is generous but not infinite so
// a stuck job doesn't freeze the whole queue.
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

const DELIMITER = (topic: string, i: number, total: number): string =>
  [
    "",
    "════════════════════════════════════════════════════════════════",
    `  NEXT FLIPCAST — ${i + 1} of ${total}: ${topic}`,
    "════════════════════════════════════════════════════════════════",
    "",
  ].join("\n");

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}

function formatLabel(fmt: string): string {
  if (fmt === "newscast") return "Solo";
  if (fmt === "pals") return "Pals";
  if (fmt === "panel") return "Panel";
  return fmt;
}

function statusChip(s: JobStatus): string {
  if (s === "pending") return "bg-slate-100 text-slate-600";
  if (s === "submitting") return "bg-amber-100 text-amber-700";
  if (s === "queued") return "bg-sky-100 text-sky-700";
  if (s === "running") return "bg-pink-100 text-pink-700 animate-pulse-soft";
  if (s === "complete") return "bg-emerald-100 text-emerald-700";
  return "bg-rose-100 text-rose-700";
}

function statusText(s: JobStatus): string {
  if (s === "pending") return "Waiting";
  if (s === "submitting") return "Submitting…";
  if (s === "queued") return "Queued";
  if (s === "running") return "Running";
  if (s === "complete") return "Complete";
  return "Failed";
}

export function TestStudioClient({
  sourceRuns,
}: {
  sourceRuns: SourceRun[];
}) {
  const [batchSize, setBatchSize] = useState(5);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(sourceRuns.slice(0, 5).map((r) => r.id)),
  );
  const [jobs, setJobs] = useState<Job[]>([]);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef(false);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function updateBatchSize(n: number) {
    const clamped = Math.max(1, Math.min(sourceRuns.length, n));
    setBatchSize(clamped);
    setSelectedIds(new Set(sourceRuns.slice(0, clamped).map((r) => r.id)));
  }

  // Submit a single source run as a new flipcast request. Returns the new
  // request id.
  const submitRun = useCallback(
    async (src: SourceRun): Promise<string> => {
      const body = {
        topic: src.topic,
        format: src.format,
        lengthMinutes: src.lengthMinutes,
        engine: src.engine,
        voiceIds: src.voiceIds,
        locale: src.locale,
      };
      const res = await fetch("/api/flipcasts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? `submit failed (${res.status})`);
      }
      if (!data.requestId) throw new Error("no requestId in response");
      return data.requestId as string;
    },
    [],
  );

  // Poll the request until it settles (complete or failed).
  const waitForCompletion = useCallback(
    async (
      requestId: string,
      onStatus: (status: "queued" | "running" | "complete" | "failed") => void,
    ): Promise<"complete" | "failed"> => {
      const deadline = Date.now() + POLL_TIMEOUT_MS;
      while (Date.now() < deadline) {
        if (abortRef.current) throw new Error("aborted");
        const res = await fetch(`/api/flipcasts/${requestId}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const row = (await res.json()) as { status?: string };
          const s = row.status;
          if (s === "complete") {
            onStatus("complete");
            return "complete";
          }
          if (s === "failed" || s === "rejected") {
            onStatus("failed");
            return "failed";
          }
          if (
            s === "queued" ||
            s === "validating" ||
            s === "pending" ||
            s === "generating_transcript" ||
            s === "synthesizing" ||
            s === "stitching" ||
            s === "finalizing"
          ) {
            onStatus(s === "queued" ? "queued" : "running");
          }
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
      throw new Error("timed out");
    },
    [],
  );

  // Fetch the formatted transcript for a finished request.
  const fetchTranscript = useCallback(
    async (requestId: string): Promise<string> => {
      const res = await fetch(
        `/api/admin/flipcasts/${requestId}/transcript`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`transcript fetch failed (${res.status})`);
      const data = (await res.json()) as { transcript?: string };
      return data.transcript ?? "";
    },
    [],
  );

  async function runSerialQueue() {
    const picks = sourceRuns.filter((r) => selectedIds.has(r.id));
    if (picks.length === 0) return;
    abortRef.current = false;
    setRunning(true);
    const initial: Job[] = picks.map((p) => ({
      sourceId: p.id,
      sourceTopic: p.topic,
      sourceFormat: p.format,
      sourceLocale: p.locale,
      newRequestId: null,
      status: "pending",
      error: null,
      transcript: null,
      startedAt: null,
      completedAt: null,
    }));
    setJobs(initial);

    for (let i = 0; i < picks.length; i++) {
      if (abortRef.current) break;
      const src = picks[i]!;
      setJobs((prev) => {
        const next = prev.slice();
        next[i] = { ...next[i]!, status: "submitting", startedAt: Date.now() };
        return next;
      });
      try {
        const newRequestId = await submitRun(src);
        setJobs((prev) => {
          const next = prev.slice();
          next[i] = { ...next[i]!, newRequestId, status: "queued" };
          return next;
        });
        const outcome = await waitForCompletion(newRequestId, (s) => {
          setJobs((prev) => {
            const next = prev.slice();
            next[i] = { ...next[i]!, status: s };
            return next;
          });
        });
        if (outcome === "complete") {
          const transcript = await fetchTranscript(newRequestId);
          setJobs((prev) => {
            const next = prev.slice();
            next[i] = {
              ...next[i]!,
              status: "complete",
              transcript,
              completedAt: Date.now(),
            };
            return next;
          });
        } else {
          setJobs((prev) => {
            const next = prev.slice();
            next[i] = {
              ...next[i]!,
              status: "failed",
              error: "pipeline failed",
              completedAt: Date.now(),
            };
            return next;
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setJobs((prev) => {
          const next = prev.slice();
          next[i] = {
            ...next[i]!,
            status: "failed",
            error: message,
            completedAt: Date.now(),
          };
          return next;
        });
      }
    }
    setRunning(false);
  }

  function abortQueue() {
    abortRef.current = true;
    setRunning(false);
  }

  function clearJobs() {
    if (running) return;
    setJobs([]);
  }

  const combinedDoc = useMemo(() => {
    if (jobs.length === 0) return "";
    const parts: string[] = [];
    const total = jobs.length;
    for (let i = 0; i < jobs.length; i++) {
      const j = jobs[i]!;
      parts.push(DELIMITER(j.sourceTopic, i, total));
      if (j.transcript) {
        parts.push(j.transcript);
      } else if (j.status === "failed") {
        parts.push(`(failed: ${j.error ?? "unknown error"})`);
      } else {
        parts.push(`(${statusText(j.status).toLowerCase()})`);
      }
    }
    return parts.join("\n").trimStart();
  }, [jobs]);

  async function copyAll() {
    if (!combinedDoc) return;
    try {
      await navigator.clipboard.writeText(combinedDoc);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  const completeCount = jobs.filter((j) => j.status === "complete").length;
  const failedCount = jobs.filter((j) => j.status === "failed").length;
  const allDone = jobs.length > 0 && completeCount + failedCount === jobs.length;

  return (
    <div className="flex flex-col gap-6">
      {/* Source picker */}
      <section className="glass rounded-3xl p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-ink-900">
              Pick source runs
            </h2>
            <p className="text-xs text-ink-500">
              We replay each selected run as a fresh flipcast using the same
              topic, format, locale, and voice picks.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-ink-500">
              Batch size
            </label>
            <input
              type="number"
              min={1}
              max={sourceRuns.length}
              value={batchSize}
              onChange={(e) => updateBatchSize(Number(e.target.value) || 1)}
              disabled={running}
              className="h-9 w-20 rounded-full border border-ink-200 bg-white px-3 text-center text-sm"
            />
            <button
              type="button"
              onClick={() => updateBatchSize(batchSize)}
              disabled={running}
              className="h-9 rounded-full bg-ink-900 px-4 text-xs font-semibold text-white hover:scale-[1.02] disabled:opacity-40"
            >
              Pick top {batchSize}
            </button>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto rounded-2xl border border-ink-100 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="w-8 px-3 py-2" />
                <th className="px-3 py-2 font-medium">Topic</th>
                <th className="px-3 py-2 font-medium">Format</th>
                <th className="px-3 py-2 font-medium">Locale</th>
                <th className="px-3 py-2 font-medium">Owner</th>
                <th className="px-3 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {sourceRuns.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-ink-400">
                    No completed flipcasts yet.
                  </td>
                </tr>
              )}
              {sourceRuns.map((r) => {
                const picked = selectedIds.has(r.id);
                return (
                  <tr
                    key={r.id}
                    className={picked ? "bg-sky-50/50" : "hover:bg-ink-50/50"}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={picked}
                        onChange={() => toggleSelect(r.id)}
                        disabled={running}
                      />
                    </td>
                    <td className="max-w-[420px] truncate px-3 py-2 text-ink-900" title={r.topic}>
                      {r.topic}
                    </td>
                    <td className="px-3 py-2 text-ink-500">
                      {formatLabel(r.format)}
                    </td>
                    <td className="px-3 py-2 text-ink-500">
                      {r.locale.toUpperCase()}
                    </td>
                    <td className="px-3 py-2 text-ink-500">
                      {r.ownerEmail ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink-500">
                      {fmtDate(r.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-ink-500">
            {selectedIds.size} selected
          </span>
          <button
            type="button"
            onClick={runSerialQueue}
            disabled={running || selectedIds.size === 0}
            className="rounded-full bg-brand-gradient px-6 py-2 text-sm font-semibold text-white shadow-glow hover:scale-[1.02] disabled:opacity-40"
          >
            {running
              ? "Running…"
              : `Run ${selectedIds.size} flipcast${selectedIds.size === 1 ? "" : "s"}`}
          </button>
          {running && (
            <button
              type="button"
              onClick={abortQueue}
              className="rounded-full border border-rose-200 bg-rose-50 px-5 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
            >
              Abort after current
            </button>
          )}
          {!running && jobs.length > 0 && (
            <button
              type="button"
              onClick={clearJobs}
              className="rounded-full border border-ink-200 bg-white px-5 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
            >
              Clear queue
            </button>
          )}
        </div>
      </section>

      {/* Queue status */}
      {jobs.length > 0 && (
        <section className="glass rounded-3xl p-5 shadow-card">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-ink-900">
                Queue
              </h2>
              <p className="text-xs text-ink-500">
                {completeCount} complete · {failedCount} failed ·{" "}
                {jobs.length - completeCount - failedCount} pending
              </p>
            </div>
          </div>
          <ol className="flex flex-col gap-2">
            {jobs.map((j, i) => (
              <li
                key={`${j.sourceId}-${i}`}
                className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white px-4 py-3"
              >
                <span className="w-6 shrink-0 text-right text-xs font-semibold text-ink-400">
                  {i + 1}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusChip(j.status)}`}
                >
                  {statusText(j.status)}
                </span>
                <span className="flex-1 truncate text-sm text-ink-900" title={j.sourceTopic}>
                  {j.sourceTopic}
                </span>
                <span className="shrink-0 text-xs text-ink-400">
                  {formatLabel(j.sourceFormat)} · {j.sourceLocale.toUpperCase()}
                </span>
                {j.newRequestId && (
                  <a
                    href={`/player/${j.newRequestId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 font-mono text-[10px] text-ink-400 hover:text-ink-700"
                  >
                    {j.newRequestId.slice(0, 8)}
                  </a>
                )}
                {j.error && (
                  <span className="shrink-0 text-xs text-rose-600" title={j.error}>
                    ⚠
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Combined transcript */}
      {jobs.length > 0 && (
        <section className="glass rounded-3xl p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-ink-900">
                Combined transcript
              </h2>
              <p className="text-xs text-ink-500">
                All runs in one document, separated by a banner for each flipcast.
                {allDone && " All runs finished."}
              </p>
            </div>
            <button
              type="button"
              onClick={copyAll}
              disabled={!combinedDoc}
              className="rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-40"
            >
              {copied ? "Copied!" : "Copy all"}
            </button>
          </div>
          <textarea
            readOnly
            value={combinedDoc}
            onFocus={(e) => e.currentTarget.select()}
            className="h-[480px] w-full resize-y rounded-2xl border border-ink-100 bg-white p-4 font-mono text-xs leading-relaxed text-ink-800"
          />
        </section>
      )}
    </div>
  );
}
