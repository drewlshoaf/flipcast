import type { PromptConcept, PromptScores, RankedPromptConcept } from "./schema";
import { SCORE_WEIGHTS } from "./schema";

// Deterministic weighted score over Claude's self-scores. Outputs 0..1 so
// callers can sort, threshold, and display without knowing the internal
// weighting. Weights sum is computed once and reused.

const TOTAL_WEIGHT = Object.values(SCORE_WEIGHTS).reduce(
  (s, w) => s + w,
  0,
);
const MAX_RAW = TOTAL_WEIGHT * 5; // 5 = max per-dim score

export function finalScoreFor(scores: PromptScores): number {
  const keys = Object.keys(SCORE_WEIGHTS) as (keyof PromptScores)[];
  let raw = 0;
  for (const k of keys) {
    raw += scores[k] * SCORE_WEIGHTS[k];
  }
  return raw / MAX_RAW;
}

// Interest-bias re-ranker. Used when a caller passes `interestBias` (e.g.
// signed-in user's chosen interests). Prompts whose topic_domain contains
// any bias term get a small additive bump so they float up *without* gating
// the non-matching ones.
export function applyInterestBias(
  concepts: RankedPromptConcept[],
  interestBias: string[] | undefined,
): RankedPromptConcept[] {
  if (!interestBias || interestBias.length === 0) return concepts;
  const biasLower = interestBias.map((s) => s.toLowerCase());
  return concepts.map((c) => {
    const domain = c.topic_domain.toLowerCase();
    const hit = biasLower.some((b) => domain.includes(b));
    if (!hit) return c;
    return { ...c, finalScore: Math.min(1, c.finalScore + 0.08) };
  });
}

export function rankConcepts(
  concepts: PromptConcept[],
  interestBias?: string[],
): RankedPromptConcept[] {
  const ranked: RankedPromptConcept[] = concepts.map((c) => ({
    ...c,
    finalScore: finalScoreFor(c.scores),
  }));
  return applyInterestBias(ranked, interestBias).sort(
    (a, b) => b.finalScore - a.finalScore,
  );
}
