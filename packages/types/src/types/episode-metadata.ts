// Pre-generation classifier metadata. A single Haiku call upstream produces
// this object from the raw user topic + the chosen format; it then drives
// downstream prompt branching in the worker. Keeping v1 small and
// behavior-driven — every field maps to a concrete generation rule, not just
// a label.

import type { FlipcastFormat } from "../voices";

export const TIME_CONTEXTS = [
  "current",
  "recent_recap",
  "historical",
  "timeless",
] as const;
export type TimeContext = (typeof TIME_CONTEXTS)[number];

export const TOPIC_DOMAINS = [
  "news_current_events",
  "business_finance",
  "technology_ai",
  "culture_society",
  "lifestyle_fashion",
  "sports",
  "science_health",
  "entertainment_media",
  "general_question",
  "humor_absurdity",
] as const;
export type TopicDomain = (typeof TOPIC_DOMAINS)[number];

export const USER_INTENTS = [
  "inform",
  "explain",
  "analyze",
  "debate",
  "answer",
  "react",
  "entertain",
  "riff",
  "speculate",
] as const;
export type UserIntent = (typeof USER_INTENTS)[number];

// v1 only emits the three values that map to existing flipcast formats. The
// extended set (interview/debate/roundtable/comedic_bit) is reserved so
// future format choices can be added without changing the schema.
export const FORMAT_TYPES = [
  "monologue_1p",
  "dialogue_2p",
  "panel_3p",
  "interview",
  "debate",
  "roundtable",
  "comedic_bit",
] as const;
export type FormatType = (typeof FORMAT_TYPES)[number];

export const TONE_PROFILES = [
  "serious",
  "conversational",
  "analytical",
  "warm",
  "witty",
  "playful",
  "provocative",
  "reflective",
  "absurd",
] as const;
export type ToneProfile = (typeof TONE_PROFILES)[number];

export const FRESHNESS_LEVELS = ["high", "medium", "low"] as const;
export type FreshnessRequirement = (typeof FRESHNESS_LEVELS)[number];

export const FACT_SENSITIVITY_LEVELS = ["high", "medium", "low"] as const;
export type FactSensitivity = (typeof FACT_SENSITIVITY_LEVELS)[number];

// Speaker patterns — only meaningful when format has multiple speakers.
// Drives interruption style and conversational tension downstream.
export const SPEAKER_PATTERNS = [
  "host_analyst",
  "host_skeptic",
  "host_comedian",
  "host_analyst_skeptic",
  "host_comedian_analyst",
  "balanced_panel",
] as const;
export type SpeakerPattern = (typeof SPEAKER_PATTERNS)[number];

export interface EpisodeMetadata {
  time_context: TimeContext;
  topic_domain: TopicDomain;
  user_intent: UserIntent;
  format_type: FormatType;
  tone_profile: ToneProfile;
  freshness_requirement: FreshnessRequirement;
  fact_sensitivity: FactSensitivity;
  // Optional — only set for multi-speaker formats.
  speaker_pattern?: SpeakerPattern;
}

// Post-generation validator — five quality checks the validator emits per
// episode. Severity is per-check so the UI can surface major issues without
// being noisy about minor ones. `note` is a one-line human-readable
// explanation when severity > none.
export const VALIDATION_SEVERITIES = ["none", "minor", "major"] as const;
export type ValidationSeverity = (typeof VALIDATION_SEVERITIES)[number];

export interface ValidationCheck {
  severity: ValidationSeverity;
  note?: string;
}

export interface EpisodeValidation {
  // Old facts/years presented as current state.
  stale_timing: ValidationCheck;
  // Central subject not named in the welcome or opening minute.
  missing_subject_naming: ValidationCheck;
  // Canned podcast filler ("and we're back", "stay with us", etc.) overused.
  generic_filler: ValidationCheck;
  // Multiple speakers sound like the same person — no cognitive contrast.
  interchangeable_speakers: ValidationCheck;
  // Confident assertions of facts the script can't actually back up.
  overconfident_claims: ValidationCheck;
  // The script's opening register doesn't match what the topic title promises
  // (e.g. chatty title → analytical opening, or vice versa).
  title_script_mismatch: ValidationCheck;
  // The first scene drifts in atmospheric setup without landing a real
  // payoff (specific, mechanism, example, sharp question) early.
  weak_early_payoff: ValidationCheck;
}

// Map our concrete flipcast format pick to the metadata's format_type. The
// classifier inherits this rather than re-deciding — the user already chose
// the format in the studio.
export function formatTypeForFlipcastFormat(
  format: FlipcastFormat,
): FormatType {
  switch (format) {
    case "newscast":
      return "monologue_1p";
    case "pals":
      return "dialogue_2p";
    case "panel":
      return "panel_3p";
    default: {
      const exhaustive: never = format;
      return exhaustive;
    }
  }
}
