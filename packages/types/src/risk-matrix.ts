// V1 topic ↔ vibe risk matrix. Disallowed topics (red) are handled
// upstream by the disallowed-topic system (see disallowed-topics.ts) and
// never reach the vibe-risk layer. For allowed topics the inference
// layer assigns a sensitivity band and the matrix below decides whether
// the user-selected vibe is safe / review / risky.
//
// Source of truth: casting spec answers Section 2.

import type { Vibe } from "./showbiz";

export const TOPIC_SENSITIVITIES = ["green", "yellow", "orange", "red"] as const;
export type TopicSensitivity = (typeof TOPIC_SENSITIVITIES)[number];

export const VIBE_RISKS = ["safe", "review", "risky", "disallowed"] as const;
export type VibeRisk = (typeof VIBE_RISKS)[number];

// Per-cell verdict. Red is shown for completeness — Phase 2 should
// short-circuit on red before reaching this matrix.
//   safe       → allow selected vibe unchanged
//   review     → allow unless framing feels trivializing / flippant /
//                patronizing / brand-breaking (LLM judgment call)
//   risky      → adjust by default (see VIBE_ADJUSTMENTS below)
//   disallowed → reject; never reached if upstream moderation works
const RISK_MATRIX: Record<TopicSensitivity, Record<Vibe, VibeRisk>> = {
  green:  { smart: "safe", fun: "safe",   warm: "safe",   serious: "safe" },
  yellow: { smart: "safe", fun: "review", warm: "safe",   serious: "safe" },
  orange: { smart: "safe", fun: "risky",  warm: "review", serious: "safe" },
  red:    { smart: "disallowed", fun: "disallowed", warm: "disallowed", serious: "disallowed" },
};

export function vibeRiskFor(
  sensitivity: TopicSensitivity,
  vibe: Vibe,
): VibeRisk {
  return RISK_MATRIX[sensitivity][vibe];
}

// Adjustment defaults applied when a (sensitivity × vibe) cell evaluates
// to "risky" — and optionally to "review" cases that the inference layer
// flags as trivializing / flippant. Rules are ordered: the first rule
// whose `from` + `sensitivity` + (optional) `subtype` matches wins.
//
// `subtype` is an optional finer-grained signal Phase 2 inference may
// emit ("tragedy", "loss", "atrocity", "grave_current_event"). When
// present, it lets the selector pick "Fun → Serious" instead of the
// default "Fun → Smart".
export interface VibeAdjustmentRule {
  from: Vibe;
  sensitivity: TopicSensitivity;
  // When set, the rule only fires if inference's topic_subtype matches.
  // Leaving subtype undefined makes the rule the default for that
  // (from, sensitivity) pair.
  subtype?: TopicSubtype;
  to: Vibe;
  reasonCode: string;
  reasonText: string;
}

// Subtypes that influence adjustment direction. Inference may set one
// per episode when the topic clearly carries this shape; null otherwise.
export const TOPIC_SUBTYPES = [
  "tragedy",
  "loss",
  "atrocity",
  "grave_current_event",
] as const;
export type TopicSubtype = (typeof TOPIC_SUBTYPES)[number];

// Rules evaluated top-to-bottom; first match wins. Subtype-qualified
// rules MUST sit above their generic counterparts so the more-specific
// rule fires first.
export const VIBE_ADJUSTMENTS: readonly VibeAdjustmentRule[] = [
  // Fun on grave/orange topics → Serious for tragedy + loss + atrocity
  { from: "fun",  sensitivity: "orange", subtype: "tragedy",             to: "serious", reasonCode: "fun_orange_tragedy",        reasonText: "Topic involves tragedy; Fun would feel trivializing" },
  { from: "fun",  sensitivity: "orange", subtype: "loss",                to: "serious", reasonCode: "fun_orange_loss",            reasonText: "Topic involves loss; Fun would feel trivializing" },
  { from: "fun",  sensitivity: "orange", subtype: "atrocity",            to: "serious", reasonCode: "fun_orange_atrocity",        reasonText: "Topic involves atrocity; Fun would feel trivializing" },
  { from: "fun",  sensitivity: "orange", subtype: "grave_current_event", to: "serious", reasonCode: "fun_orange_grave_current",   reasonText: "Topic is a grave current event; Fun would feel trivializing" },
  // Fun on orange topics generally → Smart (fallback when no subtype)
  { from: "fun",  sensitivity: "orange",                                  to: "smart",   reasonCode: "fun_orange_default",        reasonText: "Topic warrants more substance than Fun affords" },
  // Fun on yellow topics → Smart (review tier — only when adjusted)
  { from: "fun",  sensitivity: "yellow",                                  to: "smart",   reasonCode: "fun_yellow_default",        reasonText: "Topic warrants more substance than Fun affords" },
  // Warm on orange topics → default Smart for explanatory distance;
  // Phase 2 may upgrade to Serious based on tragedy/loss subtype.
  { from: "warm", sensitivity: "orange", subtype: "tragedy",             to: "serious", reasonCode: "warm_orange_tragedy",        reasonText: "Topic carries weight that Warm would soften too much" },
  { from: "warm", sensitivity: "orange", subtype: "loss",                to: "serious", reasonCode: "warm_orange_loss",           reasonText: "Topic carries weight that Warm would soften too much" },
  { from: "warm", sensitivity: "orange",                                  to: "smart",   reasonCode: "warm_orange_default",       reasonText: "Topic needs more explanatory distance than Warm gives" },
];

// User-facing adjustment notice. Generic by design — the user is told an
// adjustment happened but not which one.
export const ADJUSTMENT_NOTICE =
  "We're adjusting your Flipcast slightly to better fit the topic and vibe.";

// ============================================================
//  Topic-band examples (editorial reference)
// ============================================================
//
// Examples from the spec, kept here so the Phase 2 sensitivity classifier
// has concrete anchors. Not used at runtime by the selector; only by the
// inference prompt.
export const TOPIC_BAND_EXAMPLES: Record<TopicSensitivity, readonly string[]> = {
  green: [
    "sports",
    "pop culture",
    "entertainment",
    "tech explainers",
    "business trends",
    "productivity",
    "hobbies",
    "lifestyle",
    "science explainers",
    "history explainers without atrocity focus",
  ],
  yellow: [
    "layoffs",
    "burnout",
    "money stress",
    "addiction recovery",
    "political conflict",
    "relationship distress",
    "illness discussions",
    "crime news without graphic detail",
    "controversial social issues",
  ],
  orange: [
    "death",
    "suicide discussion without instruction",
    "abuse recovery",
    "war",
    "atrocities",
    "tragic accidents",
    "terminal illness",
    "violent current events",
    "severe trauma topics",
  ],
  red: [
    // Red topics are enumerated by class in disallowed-topics.ts;
    // listing them here as well would invite drift.
  ],
};
