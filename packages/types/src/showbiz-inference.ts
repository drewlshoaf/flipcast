// V1 showbiz inference + casting result types. Produced by the worker's
// pre-generation pipeline (Phase 2):
//   1. inferShowbizEpisode(topic) → ShowbizInference
//   2. evaluateModeration(inference)
//   3. resolveVibe(requestedVibe, sensitivity, subtype)
//   4. selectFormat(inference, resolvedVibe)
//   5. selectCast(format, lean, resolvedVibe, requestId)
//   = CastingResult
//
// All fields are persisted to transcripts.structuredTranscriptJson for
// admin visibility + post-hoc debugging. None of these are user-facing
// directly except the chosen cast (names + bios in the player) and the
// adjustment notice.

import type { ApprovedCastGroup } from "./cast-groupings";
import type { DisallowedTopicClass } from "./disallowed-topics";
import type { Lean, ShowbizFormat, Vibe } from "./showbiz";
import type { TopicSensitivity, TopicSubtype } from "./risk-matrix";

// ============================================================
//  Inference output (from the showbiz Haiku call)
// ============================================================

export const TOPIC_LEVELS = ["low", "medium", "high"] as const;
export type TopicLevel = (typeof TOPIC_LEVELS)[number];

// Free-form topic_type label. Examples: "current event", "evergreen
// explainer", "social observation", "personal advice", "cultural riff",
// "policy analysis", "historical retrospective". Kept open so the model
// can pick the best fit; downstream selection only branches on the
// closed-enum fields below.
export type TopicType = string;

export interface ShowbizInference {
  topic_type: TopicType;
  topic_complexity: TopicLevel;
  topic_sensitivity: TopicSensitivity;
  // Optional finer signal that biases vibe-adjustment routing
  // ("tragedy"/"loss"/"atrocity"/"grave_current_event" → Fun/Warm
  // becomes Serious instead of Smart). Null if no special subtype.
  topic_subtype: TopicSubtype | null;
  // How much value comes from multiple-perspective discussion. High
  // pushes the format selector toward Panel.
  discussion_value: TopicLevel;
  // Moderation verdict from the same call. Authoritative.
  disallowed: boolean;
  disallowed_reason_code: DisallowedTopicClass | null;
}

// ============================================================
//  Moderation result
// ============================================================

export interface ModerationAllowed {
  allowed: true;
}

export interface ModerationRejected {
  allowed: false;
  reasonCode: DisallowedTopicClass;
  // Recall keywords that pre-flagged the topic, if any. Informational
  // only — the LLM verdict drives the rejection. Used for analytics on
  // which keywords correlate with which classes.
  keywordMatches?: readonly string[];
}

export type ModerationResult = ModerationAllowed | ModerationRejected;

// ============================================================
//  Vibe resolution
// ============================================================

export interface VibeResolution {
  // The vibe the user originally selected.
  requestedVibe: Vibe;
  // The vibe the system will actually generate at. May equal requested.
  resolvedVibe: Vibe;
  adjustmentApplied: boolean;
  // Internal-only reason code + human text (logged; never disclosed to
  // the user beyond the generic ADJUSTMENT_NOTICE).
  adjustmentReasonCode?: string;
  adjustmentReasonText?: string;
}

// ============================================================
//  Casting result (final output of the casting pipeline)
// ============================================================

export interface CastingResult {
  // Echo of the inputs that drove casting.
  topic: string;
  requestedVibe: Vibe;
  lean: Lean;

  // The Haiku inference output.
  inference: ShowbizInference;

  // Moderation verdict — when rejected, the rest of the pipeline halts
  // and no transcript or audio is produced.
  moderation: ModerationResult;

  // Set when moderation.allowed === true.
  vibeResolution?: VibeResolution;
  selectedFormat?: ShowbizFormat;
  selectedGroupId?: string;
  selectedGroup?: ApprovedCastGroup;
  // Convenience: the resolved roster characters (members of
  // selectedGroup, in order). Useful for downstream prompt building.
  selectedCharacterIds?: readonly string[];

  // Wall-clock time the inference call took, for telemetry.
  inferenceDurationMs?: number;
}
