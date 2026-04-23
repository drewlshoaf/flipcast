"use client";

import { useState } from "react";

interface Option {
  id: string;
  label: string;
}

interface PromptScores {
  immediacy: number;
  relevance: number;
  novelty: number;
  emotional_recognition: number;
  social_shareability: number;
  utility: number;
  timeliness: number;
}

interface RankedConcept {
  target_audience: string;
  topic_domain: string;
  interest_trigger: string;
  tone: string;
  freshness_requirement: "low" | "medium" | "high";
  listener_payoff: string;
  prompt_concept: string;
  why_this_works: string;
  scores: PromptScores;
  finalScore: number;
  rejected?: { reason: string };
}

interface DebugResponse {
  locale: string;
  model: string;
  kept: RankedConcept[];
  rejected: RankedConcept[];
  generatedAt: string;
  error?: string;
}

export function PromptEngineDebug({
  audiences,
  modes,
  triggers: _triggers,
}: {
  audiences: Option[];
  modes: Option[];
  triggers: Option[];
}) {
  const [batchSize, setBatchSize] = useState(16);
  const [selectedAudiences, setSelectedAudiences] = useState<Set<string>>(
    () => new Set(audiences.map((a) => a.id)),
  );
  const [selectedModes, setSelectedModes] = useState<Set<string>>(
    () => new Set(modes.map((m) => m.id)),
  );
  const [interestBias, setInterestBias] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DebugResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(set: Set<string>, id: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  async function runBatch() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/prompts/debug", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          batchSize,
          audiences: Array.from(selectedAudiences),
          modes: Array.from(selectedModes),
          interestBias: interestBias
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      const data = (await res.json()) as DebugResponse;
      if (!res.ok) {
        setError(data.error ?? `request failed (${res.status})`);
        return;
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Controls */}
      <section className="glass rounded-3xl p-5 shadow-card">
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-ink-900">
          Controls
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-ink-500">
              Batch size
            </label>
            <input
              type="number"
              min={1}
              max={32}
              value={batchSize}
              onChange={(e) =>
                setBatchSize(
                  Math.max(1, Math.min(32, Number(e.target.value) || 1)),
                )
              }
              className="mt-1 h-9 w-28 rounded-full border border-ink-200 bg-white px-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-ink-500">
              Interest bias (comma-separated, optional)
            </label>
            <input
              type="text"
              value={interestBias}
              onChange={(e) => setInterestBias(e.target.value)}
              placeholder="tech, wellness, music"
              className="mt-1 h-9 w-full rounded-full border border-ink-200 bg-white px-4 text-sm"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
              Audiences
            </div>
            <div className="flex flex-wrap gap-2">
              {audiences.map((a) => {
                const on = selectedAudiences.has(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() =>
                      toggle(selectedAudiences, a.id, setSelectedAudiences)
                    }
                    className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${
                      on
                        ? "bg-ink-900 text-white ring-ink-900"
                        : "bg-white text-ink-700 ring-ink-200 hover:bg-ink-50"
                    }`}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
              Modes
            </div>
            <div className="flex flex-wrap gap-2">
              {modes.map((m) => {
                const on = selectedModes.has(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggle(selectedModes, m.id, setSelectedModes)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${
                      on
                        ? "bg-ink-900 text-white ring-ink-900"
                        : "bg-white text-ink-700 ring-ink-200 hover:bg-ink-50"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={runBatch}
            disabled={
              loading ||
              selectedAudiences.size === 0 ||
              selectedModes.size === 0
            }
            className="rounded-full bg-brand-gradient px-6 py-2 text-sm font-semibold text-white shadow-glow hover:scale-[1.02] disabled:opacity-40"
          >
            {loading ? "Generating…" : "Generate batch"}
          </button>
          {result && (
            <span className="text-xs text-ink-400">
              model: <span className="font-mono">{result.model}</span> · locale:{" "}
              <span className="font-mono">{result.locale}</span> · kept{" "}
              {result.kept.length} / rejected {result.rejected.length}
            </span>
          )}
          {error && <span className="text-xs text-rose-600">{error}</span>}
        </div>
      </section>

      {/* Kept concepts */}
      {result && result.kept.length > 0 && (
        <section className="glass rounded-3xl p-5 shadow-card">
          <h2 className="mb-3 text-lg font-semibold tracking-tight text-ink-900">
            Kept ({result.kept.length})
          </h2>
          <ol className="flex flex-col gap-3">
            {result.kept.map((c, i) => (
              <ConceptCard key={`${c.prompt_concept}-${i}`} rank={i + 1} c={c} />
            ))}
          </ol>
        </section>
      )}

      {/* Rejected concepts */}
      {result && result.rejected.length > 0 && (
        <section className="glass rounded-3xl p-5 shadow-card opacity-90">
          <h2 className="mb-3 text-lg font-semibold tracking-tight text-ink-900">
            Rejected ({result.rejected.length})
          </h2>
          <ol className="flex flex-col gap-3">
            {result.rejected.map((c, i) => (
              <ConceptCard
                key={`r-${c.prompt_concept}-${i}`}
                rank={i + 1}
                c={c}
                rejected
              />
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function ConceptCard({
  rank,
  c,
  rejected,
}: {
  rank: number;
  c: RankedConcept;
  rejected?: boolean;
}) {
  return (
    <li
      className={`rounded-2xl border p-4 ${
        rejected ? "border-rose-100 bg-rose-50/40" : "border-ink-100 bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-600">
          #{rank}
        </span>
        <span className="shrink-0 rounded-full bg-ink-900 px-2 py-0.5 text-xs font-mono text-white">
          {(c.finalScore * 100).toFixed(0)}
        </span>
        <div className="flex-1">
          <div className="text-base font-semibold text-ink-900">
            {c.prompt_concept}
          </div>
          <div className="mt-1 text-xs italic text-ink-500">
            {c.why_this_works}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            <Tag label={c.target_audience} />
            <Tag label={c.interest_trigger} />
            <Tag label={c.topic_domain} />
            <Tag label={`tone: ${c.tone}`} />
            <Tag label={`freshness: ${c.freshness_requirement}`} />
            <Tag label={`payoff: ${c.listener_payoff}`} />
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1 text-[10px]">
            <Dim label="imm" v={c.scores.immediacy} />
            <Dim label="rel" v={c.scores.relevance} />
            <Dim label="nov" v={c.scores.novelty} />
            <Dim label="emo" v={c.scores.emotional_recognition} />
            <Dim label="shr" v={c.scores.social_shareability} />
            <Dim label="util" v={c.scores.utility} />
            <Dim label="time" v={c.scores.timeliness} />
          </div>
          {c.rejected && (
            <div className="mt-2 text-xs font-semibold text-rose-700">
              Rejected: {c.rejected.reason}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-ink-100 px-2 py-0.5 font-medium text-ink-600">
      {label}
    </span>
  );
}

function Dim({ label, v }: { label: string; v: number }) {
  const tone =
    v >= 5
      ? "bg-emerald-100 text-emerald-700"
      : v >= 4
        ? "bg-sky-100 text-sky-700"
        : v >= 3
          ? "bg-amber-100 text-amber-700"
          : "bg-rose-100 text-rose-700";
  return (
    <div
      className={`flex items-center justify-between gap-1 rounded-md px-1.5 py-0.5 font-mono ${tone}`}
    >
      <span className="uppercase">{label}</span>
      <span>{v}</span>
    </div>
  );
}
