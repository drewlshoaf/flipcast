// Vibe resolution against the (TopicSensitivity × Vibe) risk matrix.
// `safe` → keep the user's vibe. `risky` → adjust per VIBE_ADJUSTMENTS.
// `review` → keep by default; the inference layer can flag a specific
// case for adjustment via `topic_subtype` — that path is handled by the
// adjustment rules too.

import {
  vibeRiskFor,
  VIBE_ADJUSTMENTS,
  type ShowbizInference,
  type Vibe,
  type VibeResolution,
} from "@flipcast/types";

export function resolveVibe(args: {
  requestedVibe: Vibe;
  inference: ShowbizInference;
}): VibeResolution {
  const { requestedVibe, inference } = args;
  const risk = vibeRiskFor(inference.topic_sensitivity, requestedVibe);

  // Safe → keep as-is. Disallowed shouldn't reach this function (the
  // moderation gate runs first). Treat it defensively as "no change" so
  // we don't crash; the caller will already be rejecting.
  if (risk === "safe" || risk === "disallowed") {
    return {
      requestedVibe,
      resolvedVibe: requestedVibe,
      adjustmentApplied: false,
    };
  }

  // Risky → always adjust. Review → only adjust when a subtype-qualified
  // rule matches (so generic Yellow+Fun stays Fun unless inference
  // explicitly flagged trivializing/flippant via subtype).
  const lookForSubtypeOnly = risk === "review";

  for (const rule of VIBE_ADJUSTMENTS) {
    if (rule.from !== requestedVibe) continue;
    if (rule.sensitivity !== inference.topic_sensitivity) continue;
    if (rule.subtype !== undefined && rule.subtype !== inference.topic_subtype) continue;
    if (lookForSubtypeOnly && rule.subtype === undefined) continue;
    return {
      requestedVibe,
      resolvedVibe: rule.to,
      adjustmentApplied: true,
      adjustmentReasonCode: rule.reasonCode,
      adjustmentReasonText: rule.reasonText,
    };
  }

  // No matching rule (e.g. review with no subtype flag) — keep the
  // requested vibe and let the LLM Quality bar in the prompt absorb it.
  return {
    requestedVibe,
    resolvedVibe: requestedVibe,
    adjustmentApplied: false,
  };
}
