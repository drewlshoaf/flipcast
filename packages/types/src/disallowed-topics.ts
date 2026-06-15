// V1 disallowed-topic catalog. Used by the Phase 2 moderation classifier
// to label a topic as one of these classes (or `null` for allowed).
// Keyword arrays are RECALL HINTS only — the classifier is the source
// of truth. Keywords help catch obvious cases without an LLM round-trip
// when needed, but a keyword miss never overrides a classifier verdict.
//
// User-facing rejection wording is generic. The triggered class MUST NOT
// be disclosed to the user; it is internal-only for logs + admin review.

export const DISALLOWED_TOPIC_CLASSES = [
  "sexual_minors",
  "child_abuse",
  "graphic_sexual_violence",
  "graphic_violence",
  "self_harm_instruction",
  "eating_disorder_encouragement",
  "drug_manufacturing",
  "violent_wrongdoing_instruction",
  "weapon_construction",
  "crime_facilitation",
  "terrorism_extremism_praise",
  "hate_dehumanizing",
  "non_consensual_sexual",
  "personal_criminal_plans",
  "harm_optimization",
  "abuse_coercion_instruction",
] as const;
export type DisallowedTopicClass = (typeof DISALLOWED_TOPIC_CLASSES)[number];

// Internal-only labels for logs + admin views. Never shown to users.
export const DISALLOWED_TOPIC_LABELS: Record<DisallowedTopicClass, string> = {
  sexual_minors: "Sexual content involving minors",
  child_abuse: "Child abuse or exploitation",
  graphic_sexual_violence: "Graphic sexual violence",
  graphic_violence: "Graphic violence or gore",
  self_harm_instruction: "Suicide or self-harm instruction or encouragement",
  eating_disorder_encouragement:
    "Eating-disorder encouragement or self-destruction guidance",
  drug_manufacturing: "Illegal drug manufacturing or hard-drug facilitation",
  violent_wrongdoing_instruction: "Violent wrongdoing instruction",
  weapon_construction: "Weapon construction or attack guidance",
  crime_facilitation: "Crime facilitation",
  terrorism_extremism_praise: "Terrorism or extremist praise/support",
  hate_dehumanizing: "Hate or dehumanizing content",
  non_consensual_sexual: "Non-consensual sexual content",
  personal_criminal_plans: "Personal criminal plans or evasion",
  harm_optimization: "Medical, legal, or financial harm optimization",
  abuse_coercion_instruction: "Abuse, coercion, or manipulation instruction",
};

// Single user-facing rejection message. Generic by design — the spec
// requires that we do NOT disclose the triggered class.
export const DISALLOWED_REJECTION_MESSAGE =
  "We can't create this Flipcast. Please review our Terms.";

// Keyword/pattern recall hints. NOT authoritative — the LLM classifier
// is. These are short, high-recall token lists per class so a Phase 2
// pre-filter can flag obvious matches for the classifier's attention
// (or for analytics on what kinds of inputs trip the wire). Phase 2
// should run the classifier even when keywords match, and should NOT
// mark a topic disallowed on keyword match alone.
export const DISALLOWED_RECALL_KEYWORDS: Record<
  DisallowedTopicClass,
  readonly string[]
> = {
  sexual_minors: ["minor", "underage", "child", "kid", "teen"],
  child_abuse: ["child abuse", "child exploitation", "csam"],
  graphic_sexual_violence: ["rape", "sexual assault", "molest"],
  graphic_violence: ["torture", "gore", "mutilation", "dismember"],
  self_harm_instruction: ["how to kill", "suicide method", "self-harm method", "cut myself", "overdose on"],
  eating_disorder_encouragement: ["pro-ana", "thinspo", "purge tips", "starve myself"],
  drug_manufacturing: ["meth recipe", "cook meth", "synthesize", "fentanyl recipe", "drug lab"],
  violent_wrongdoing_instruction: ["how to attack", "how to assault", "how to hurt"],
  weapon_construction: ["build a bomb", "make a gun", "improvised explosive", "ied", "pipe bomb"],
  crime_facilitation: ["how to steal", "how to launder", "evade police", "fake id"],
  terrorism_extremism_praise: ["isis", "al qaeda", "white nationalist", "praise hitler"],
  hate_dehumanizing: ["subhuman", "vermin", "racial slur"],
  non_consensual_sexual: ["non-consensual", "non consent", "without consent"],
  personal_criminal_plans: ["my plan to", "i want to commit", "evade arrest"],
  harm_optimization: ["maximize harm", "exploit my", "deceive my"],
  abuse_coercion_instruction: ["how to manipulate", "how to gaslight", "how to coerce"],
};
