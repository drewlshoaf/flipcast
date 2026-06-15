// Moderation gate. The Haiku showbiz inference call is the authoritative
// verdict (it sets `disallowed` + `disallowed_reason_code`). This helper
// just consolidates that verdict into a typed result and optionally
// surfaces which keyword patterns matched the topic — useful for
// analytics on what kinds of inputs trip moderation, never used to flip
// a verdict.

import {
  DISALLOWED_RECALL_KEYWORDS,
  type DisallowedTopicClass,
  type ModerationResult,
  type ShowbizInference,
} from "@flipcast/types";

// Cache the lowercased patterns at module load. Recall is a substring
// scan — cheap enough to run on every request without memoization
// beyond this.
type KeywordIndex = readonly { class: DisallowedTopicClass; needle: string }[];
const KEYWORD_INDEX: KeywordIndex = (() => {
  const out: { class: DisallowedTopicClass; needle: string }[] = [];
  for (const [cls, words] of Object.entries(DISALLOWED_RECALL_KEYWORDS) as [
    DisallowedTopicClass,
    readonly string[],
  ][]) {
    for (const w of words) out.push({ class: cls, needle: w.toLowerCase() });
  }
  return out;
})();

export function keywordRecallMatches(topic: string): readonly string[] {
  const lower = topic.toLowerCase();
  return KEYWORD_INDEX.filter((k) => lower.includes(k.needle)).map(
    (k) => k.needle,
  );
}

// Convert the inference verdict into a ModerationResult. The LLM is
// authoritative — keyword matches are attached when the verdict is
// rejected, but a keyword match alone does NOT trigger rejection.
export function evaluateModeration(args: {
  topic: string;
  inference: ShowbizInference;
}): ModerationResult {
  if (!args.inference.disallowed) {
    return { allowed: true };
  }
  // disallowed===true must come with a reason code from the inference
  // tool schema. Defensive fallback: if it's missing, label generic.
  const reasonCode: DisallowedTopicClass =
    args.inference.disallowed_reason_code ?? "abuse_coercion_instruction";
  const matches = keywordRecallMatches(args.topic);
  return {
    allowed: false,
    reasonCode,
    keywordMatches: matches.length > 0 ? matches : undefined,
  };
}
