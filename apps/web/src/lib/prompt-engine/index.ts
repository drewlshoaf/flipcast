import type { Locale } from "@/lib/i18n/locale";
import { generatePromptConcepts } from "./generate";
import { rankConcepts } from "./score";
import { filterBatch } from "./filter";
import { clearCache, readCache, writeCache } from "./cache";
import type { PromptConcept, RankedPromptConcept } from "./schema";

// Shared entry point for every surface that shows engine output (home page,
// studio IdeaRail, /api/prompts/home). Encapsulates the cache so each hit
// pays the LLM cost at most once per 30-min window per locale.
//
// We run two parallel generates per cache fill and merge — a single Haiku
// batch only reliably yields ~9–12 concepts (tool_use truncates past that),
// but the home page's bubble field plus the studio rail together want 30+.
// Two parallel calls = ~20 concepts in ~20s of wall time, ~$0.004/locale
// every 30 minutes. Cheap enough to always prefer a richer pool.

const PARALLEL_BATCHES = 2;

// Dedupe by prompt_concept text (case-insensitive, whitespace-normalized).
// Two parallel Haiku calls with the same system prompt sometimes land on
// near-identical openings; we don't want the home page showing a prompt
// twice.
function dedupe(concepts: PromptConcept[]): PromptConcept[] {
  const seen = new Set<string>();
  const out: PromptConcept[] = [];
  for (const c of concepts) {
    const key = c.prompt_concept.trim().toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

export async function loadHomePromptConcepts(args: {
  locale: Locale;
  refresh?: boolean;
}): Promise<{
  concepts: RankedPromptConcept[];
  rejected: RankedPromptConcept[];
  generatedAt: string;
  model: string;
  cached: boolean;
}> {
  if (args.refresh) clearCache(args.locale);
  const cached = readCache(args.locale);
  if (cached) {
    return {
      concepts: cached.concepts,
      rejected: cached.rejected,
      generatedAt: cached.generatedAt,
      model: cached.model,
      cached: true,
    };
  }

  // Fan out in parallel. Promise.allSettled so a single flaky Haiku call
  // doesn't wipe out the full pool.
  const results = await Promise.allSettled(
    Array.from({ length: PARALLEL_BATCHES }).map(() =>
      generatePromptConcepts({ locale: args.locale }),
    ),
  );
  const pool: PromptConcept[] = [];
  let model = "claude-haiku-4-5-20251001";
  for (const r of results) {
    if (r.status === "fulfilled") {
      pool.push(...r.value.concepts);
      model = r.value.model;
    } else {
      console.warn("[prompt-engine] parallel batch failed:", r.reason);
    }
  }
  if (pool.length === 0) {
    throw new Error("prompt engine returned no concepts");
  }

  const deduped = dedupe(pool);
  const ranked = rankConcepts(deduped);
  const filtered = filterBatch(ranked);
  const entry = writeCache(args.locale, {
    concepts: filtered.kept,
    rejected: filtered.rejected,
    generatedAt: new Date().toISOString(),
    model,
  });
  return {
    concepts: entry.concepts,
    rejected: entry.rejected,
    generatedAt: entry.generatedAt,
    model: entry.model,
    cached: false,
  };
}

// Split ranked concepts into a "news" group (high-timeliness/current) and
// an "evergreen" group (everything else). Used by surfaces that need to
// populate two distinct sections from a single cached pool — e.g. the
// studio rail's Today's news + More to start from.
export function splitByTimeliness(
  concepts: RankedPromptConcept[],
  timelyCount = 6,
): { timely: RankedPromptConcept[]; evergreen: RankedPromptConcept[] } {
  const sortedByTimeliness = concepts
    .slice()
    .sort((a, b) => b.scores.timeliness - a.scores.timeliness);
  const timelyIds = new Set(
    sortedByTimeliness.slice(0, timelyCount).map((c) => c.prompt_concept),
  );
  const timely = concepts.filter((c) => timelyIds.has(c.prompt_concept));
  const evergreen = concepts.filter((c) => !timelyIds.has(c.prompt_concept));
  return { timely, evergreen };
}

// Re-exports so callers don't reach into sub-modules for types.
export type { RankedPromptConcept, PromptConcept } from "./schema";
