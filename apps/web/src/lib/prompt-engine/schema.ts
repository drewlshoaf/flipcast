import { z } from "zod";
import { AUDIENCE_IDS } from "./audiences";
import { TRIGGER_IDS } from "./triggers";
import { MODE_IDS } from "./modes";

// Title shapes — the surface form of the prompt_concept text. Forcing the
// model to declare which shape it picked, plus a downstream "Why..." prefix
// cap in filter.ts, breaks the model's default crutch of "Why X" framing.
// Mirrors the user-facing shape vocabulary: statement / claim / contrast /
// social observation / contradiction / question.
export const TITLE_SHAPES = [
  "statement",
  "claim",
  "contrast",
  "social_observation",
  "contradiction",
  "question",
] as const;
export type TitleShape = (typeof TITLE_SHAPES)[number];

// Editorial categories used by the IdeaRail / browse surfaces. Drives the
// section a card lives in (news → Happening Now, work/money → Work & Money,
// etc.) and the filter chips row. Claude picks the DOMINANT category for
// each concept; cross-category concepts should still name their primary
// bucket, not an "AI+WORK" hybrid.
export const CATEGORIES = [
  "news",
  "work",
  "money",
  "ai",
  "culture",
  "society",
  "relationships",
  "wellness",
] as const;
export type Category = (typeof CATEGORIES)[number];

// Which episode format best realizes the concept. Mirrors the studio format
// IDs so the UI can pre-select a format when the user taps a prompt.
export const BEST_AS_FORMATS = ["newscast", "pals", "panel"] as const;
export type BestAsFormat = (typeof BEST_AS_FORMATS)[number];

// UI-facing tone tag. Distinct from the existing open-ended `tone` field
// (which is Claude's free-form tone hint) — this is a closed enum so the
// UI can render a consistent "Tone: sharp" badge across the rail.
export const TONE_TAGS = [
  "sharp",
  "chatty",
  "analytical",
  "playful",
  "reflective",
] as const;
export type ToneTag = (typeof TONE_TAGS)[number];

// The structured object Claude emits for each home-page candidate and that
// the API returns to the client. Scores live inside the object so the hybrid
// ranker (Claude self-score + deterministic weights) has everything in one
// place. Tone, topic_domain, and listener_payoff stay open-ended strings so
// Claude can reach for a fit without us maintaining enum tables.

const scoreDim = z
  .number()
  .int()
  .min(1)
  .max(5)
  .describe("1 = weak, 5 = excellent");

export const promptScoresSchema = z.object({
  immediacy: scoreDim,
  relevance: scoreDim,
  novelty: scoreDim,
  emotional_recognition: scoreDim,
  social_shareability: scoreDim,
  utility: scoreDim,
  timeliness: scoreDim,
});

export type PromptScores = z.infer<typeof promptScoresSchema>;

export const promptConceptSchema = z.object({
  target_audience: z.enum(AUDIENCE_IDS as [string, ...string[]]),
  topic_domain: z.string().min(1),
  interest_trigger: z.enum(TRIGGER_IDS as [string, ...string[]]),
  tone: z.string().min(1),
  freshness_requirement: z.enum(["low", "medium", "high"]),
  listener_payoff: z.string().min(1),
  prompt_concept: z.string().min(1),
  title_shape: z.enum(TITLE_SHAPES),
  why_this_works: z.string().min(1),
  scores: promptScoresSchema,
  // Editorial metadata — drives the IdeaRail card layout, sectioning, and
  // filter chips. See CATEGORIES / BEST_AS_FORMATS / TONE_TAGS above.
  category: z.enum(CATEGORIES),
  descriptor: z.string().min(1).max(160),
  best_as: z.enum(BEST_AS_FORMATS),
  tone_tag: z.enum(TONE_TAGS),
});

export type PromptConcept = z.infer<typeof promptConceptSchema>;

// What the API returns after scoring + filtering: the original Claude-emitted
// concept plus a deterministic weighted score the client can display or sort
// on without re-running Claude.
export interface RankedPromptConcept extends PromptConcept {
  finalScore: number; // 0..1
  rejected?: { reason: string };
}

// Weights tuned for "would the target listener actually tap this on the
// home page?" rather than "is this a coherent topic?". The tap decision is
// dominated by emotional recognition ("oh yeah, I've thought that"),
// immediacy (am I clicking in 2 seconds?), and novelty (is this a take I
// haven't heard). Utility and timeliness are nice-to-have multipliers, not
// carriers — a useful-but-dry prompt should lose to a sharper one.
//
// Last retuned 2026-04: bumped emotional_recognition and immediacy, dropped
// utility/timeliness further after round-1 output leaned too essayistic.
export const SCORE_WEIGHTS: Record<keyof PromptScores, number> = {
  immediacy: 1.3,
  relevance: 1.1,
  novelty: 1.1,
  emotional_recognition: 1.5,
  social_shareability: 1.0,
  utility: 0.4,
  timeliness: 0.5,
};
