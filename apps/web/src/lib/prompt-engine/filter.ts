import type { PromptConcept, PromptScores, RankedPromptConcept } from "./schema";

// Heuristic filters that drop candidates the ranker shouldn't promote. Split
// into two tiers:
//   - hardReject: prompt is structurally broken or obviously AI slop. Drop.
//   - soft penalties: lower the finalScore but keep the concept so a tight
//     batch doesn't come back empty.
//
// Tuning philosophy: prefer false negatives (too strict, lose some ok
// prompts) over false positives (let slop through). The rankings are
// surfaced to the home page directly.

// Openers and fragments we never want to see verbatim. Matched case-insensitive.
// Two flavors: essayist tells ("unpacking X", "what this reveals about") and
// podcast-host tells ("in this episode", "let's dive into"). Both kill the
// listener-language register we want for home-page tiles.
const BANNED_PHRASES = [
  // Podcast-host tells
  "in this episode",
  "let's dive into",
  "let's explore",
  "a deep dive into",
  "an analysis of",
  "welcome back",
  "today we'll",
  "today we will",
  "we'll discuss",
  // Essayist tells
  "what this reveals about",
  "what this says about us and",
  "the implications of",
  "unpacking the",
  "exploring the",
  "examining the",
  "what the X tells us about",
  // Spanish variants
  "en este episodio",
  "vamos a explorar",
  "un análisis de",
  "hoy vamos",
  "bienvenido de nuevo",
  "qué revela esto sobre",
  "las implicaciones de",
  "desentrañar",
];

// Tightened from 5–20 → 4–16 words after round-1 output leaned too long /
// essayistic. A good tile is scannable in one glance.
const MIN_WORDS = 4;
const MAX_WORDS = 16;
// Claude sometimes emits all-5s across the board — a telltale "I liked this"
// self-report. Treat it as a mild slop signal (penalty, not reject).
const ALL_MAX_SCORE_PENALTY = -0.05;

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function lower(s: string): string {
  return s.toLowerCase();
}

export interface FilterResult {
  reject: boolean;
  reason?: string;
  scoreAdjust?: number;
}

export function inspect(c: PromptConcept): FilterResult {
  const prompt = c.prompt_concept.trim();
  if (prompt.length === 0) return { reject: true, reason: "empty prompt" };

  const wc = wordCount(prompt);
  if (wc < MIN_WORDS) return { reject: true, reason: `too short (${wc} words)` };
  if (wc > MAX_WORDS) return { reject: true, reason: `too long (${wc} words)` };

  const promptLower = lower(prompt);
  for (const phrase of BANNED_PHRASES) {
    if (promptLower.includes(phrase)) {
      return { reject: true, reason: `banned opener: "${phrase}"` };
    }
  }

  if (c.why_this_works.trim().length === 0) {
    return { reject: true, reason: "missing why_this_works" };
  }

  // Any core dim scored 1 = self-reported weak. Drop.
  const weakDims: (keyof PromptScores)[] = [
    "immediacy",
    "relevance",
    "emotional_recognition",
  ];
  for (const d of weakDims) {
    if (c.scores[d] <= 1) {
      return { reject: true, reason: `weak self-score on ${d}` };
    }
  }

  // All 5s — soft penalty.
  const values = Object.values(c.scores);
  if (values.every((v) => v === 5)) {
    return { reject: false, scoreAdjust: ALL_MAX_SCORE_PENALTY };
  }

  return { reject: false };
}

export interface FilteredBatch {
  kept: RankedPromptConcept[];
  rejected: RankedPromptConcept[];
}

// Diversity caps on the final ranked list. The home page surfaces a grid
// of tiles that the user scans linearly, so clumps of "six media think
// pieces in a row" tank the feel of the whole page even if each individual
// prompt is fine. Walk the already-scored list top-down and drop concepts
// whose (domain|trigger) bucket is already full.
//
// Caps are generous enough that small pools don't over-deplete — on a
// 20-concept pool with cap=3 per domain, we can seat 6+ distinct domains.
const DOMAIN_CAP = 3;
const TRIGGER_CAP = 5;
// Why-prefix cap: the model defaults to "Why X" framing even with explicit
// title-shape balancing instructions in the prompt. Hard ceiling at 25% of
// the kept pool — past that, drop the lowest-scoring "Why..." prompts.
// Computed as a fraction so the cap scales with pool size.
const WHY_PREFIX_FRACTION = 0.25;

function startsWithWhy(prompt: string): boolean {
  // English "Why " + Spanish "Por qué " / "¿Por qué ". Case-insensitive.
  // Matches the surface form regardless of the model's declared title_shape
  // — same failure mode whether labeled question or anything else.
  const trimmed = prompt.trim();
  return /^(why\s|por qué\s|¿por qué\s)/i.test(trimmed);
}

// Normalize a topic_domain string into a canonical bucket key. Claude
// sometimes writes the same domain two different ways across parallel
// batches ("technology + AI" vs "technology and AI"); without this they
// each count separately and the cap lets both through. Strip connectors,
// punctuation, and order, so the buckets merge.
function domainKey(raw: string): string {
  const normalized = raw
    .toLowerCase()
    .replace(/[+&,/]/g, " ")
    .replace(/\band\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.split(" ").filter(Boolean).sort().join(" ");
}

function applyDiversityCaps(
  kept: RankedPromptConcept[],
): { top: RankedPromptConcept[]; dropped: RankedPromptConcept[] } {
  const domainCounts = new Map<string, number>();
  const triggerCounts = new Map<string, number>();
  // Why-cap is computed against the input pool size — this means the cap
  // is set BEFORE we start dropping for domain/trigger reasons, so the
  // homepage never gets more than ~25% Why-prefixed tiles regardless of
  // how many other shapes survived.
  const whyCap = Math.max(1, Math.floor(kept.length * WHY_PREFIX_FRACTION));
  let whyCount = 0;
  const top: RankedPromptConcept[] = [];
  const dropped: RankedPromptConcept[] = [];
  for (const c of kept) {
    const dKey = domainKey(c.topic_domain);
    const tKey = c.interest_trigger;
    const d = domainCounts.get(dKey) ?? 0;
    const t = triggerCounts.get(tKey) ?? 0;
    if (d >= DOMAIN_CAP) {
      dropped.push({
        ...c,
        rejected: { reason: `domain cap (${c.topic_domain})` },
      });
      continue;
    }
    if (t >= TRIGGER_CAP) {
      dropped.push({
        ...c,
        rejected: { reason: `trigger cap (${tKey})` },
      });
      continue;
    }
    if (startsWithWhy(c.prompt_concept) && whyCount >= whyCap) {
      dropped.push({
        ...c,
        rejected: { reason: `Why-prefix cap (max ${whyCap})` },
      });
      continue;
    }
    domainCounts.set(dKey, d + 1);
    triggerCounts.set(tKey, t + 1);
    if (startsWithWhy(c.prompt_concept)) whyCount++;
    top.push(c);
  }
  return { top, dropped };
}

// Run inspection on a ranked batch. Apply score adjustments in place, split
// into kept vs rejected, then enforce diversity caps so the final list
// doesn't lean on a single domain or trigger archetype.
export function filterBatch(
  ranked: RankedPromptConcept[],
): FilteredBatch {
  const kept: RankedPromptConcept[] = [];
  const rejected: RankedPromptConcept[] = [];
  for (const c of ranked) {
    const result = inspect(c);
    if (result.reject) {
      rejected.push({ ...c, rejected: { reason: result.reason ?? "unknown" } });
      continue;
    }
    if (result.scoreAdjust) {
      kept.push({
        ...c,
        finalScore: Math.max(0, Math.min(1, c.finalScore + result.scoreAdjust)),
      });
    } else {
      kept.push(c);
    }
  }
  kept.sort((a, b) => b.finalScore - a.finalScore);
  const { top, dropped } = applyDiversityCaps(kept);
  return { kept: top, rejected: [...rejected, ...dropped] };
}
