// Format selection — system-determined per spec §8. Inputs:
//   - resolved vibe
//   - topic_complexity
//   - topic_sensitivity
//   - discussion_value
//
// Decision tree (top to bottom; first match wins):
//   1. Orange sensitivity → Solo (controlled register, sensitive topics
//      shouldn't run multi-host).
//   2. Resolved vibe = Serious → Solo or Panel (never Pals per spec).
//      Pick Panel when discussion_value=high or complexity=high; Solo
//      otherwise.
//   3. discussion_value = high → Panel (multi-perspective is the point).
//   4. topic_complexity = high → Panel (more voices help unpack).
//   5. Resolved vibe = Fun or Warm → Pals (chemistry-driven).
//   6. Default (Smart, low-mid complexity, low-mid discussion) → Solo.
//
// The output drives downstream cast selection; see select-cast.ts.

import type {
  ShowbizFormat,
  ShowbizInference,
  Vibe,
} from "@flipcast/types";

export interface FormatDecision {
  format: ShowbizFormat;
  reason: string;
}

export function selectFormat(args: {
  resolvedVibe: Vibe;
  inference: ShowbizInference;
}): FormatDecision {
  const { resolvedVibe, inference } = args;
  const sensitivity = inference.topic_sensitivity;
  const complexity = inference.topic_complexity;
  const discussion = inference.discussion_value;

  if (sensitivity === "orange") {
    return {
      format: "solo",
      reason: "orange sensitivity prefers a controlled solo register",
    };
  }

  if (resolvedVibe === "serious") {
    if (discussion === "high" || complexity === "high") {
      return {
        format: "panel",
        reason: "serious + high discussion value or complexity routes to panel",
      };
    }
    return {
      format: "solo",
      reason: "serious routes to solo when discussion + complexity are not high (never pals)",
    };
  }

  if (discussion === "high") {
    return {
      format: "panel",
      reason: "high discussion value benefits from multi-perspective panel",
    };
  }

  if (complexity === "high") {
    return {
      format: "panel",
      reason: "high topic complexity benefits from multi-voice unpacking",
    };
  }

  if (resolvedVibe === "fun" || resolvedVibe === "warm") {
    return {
      format: "pals",
      reason: `${resolvedVibe} runs best as a two-host pals chat`,
    };
  }

  // Default: Smart with no discussion/complexity push → solo.
  return {
    format: "solo",
    reason: "smart with moderate complexity + discussion defaults to solo",
  };
}
