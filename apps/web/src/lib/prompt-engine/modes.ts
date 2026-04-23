// Generation modes. Orthogonal to trigger: mode says *which reservoir to
// fish from* (is this tied to a current event, evergreen social observation,
// explanatory payoff, or playful/provocative?), while trigger says *how to
// frame it*. The home page can mix modes freely to keep the tile grid from
// feeling single-note.

export type ModeId = "current" | "evergreen" | "practical" | "playful";

export interface Mode {
  id: ModeId;
  label: string;
  intent: string;
  freshnessRequirement: "low" | "medium" | "high";
  rule: string;
}

export const MODES: Mode[] = [
  {
    id: "current",
    label: "Current / trend-driven",
    intent:
      "Tie the prompt to something moving right now — news, tech, culture, a platform shift.",
    freshnessRequirement: "high",
    rule: "Prefer concrete, recent anchors; avoid stale references from 2+ years ago.",
  },
  {
    id: "evergreen",
    label: "Evergreen / social observation",
    intent:
      "Name a durable pattern in how people live, talk, or relate that will still land in 6 months.",
    freshnessRequirement: "low",
    rule: "Should feel observational and specific, not timeless-in-a-Hallmark-way.",
  },
  {
    id: "practical",
    label: "Practical / explanatory",
    intent:
      "Offer a clear utility or decision frame the listener could take into their week.",
    freshnessRequirement: "medium",
    rule:
      "Should imply a real tradeoff or framework, not a generic 'tips' list.",
  },
  {
    id: "playful",
    label: "Playful / provocative",
    intent:
      "Lighter, personality-driven prompts — good for variety on the home tile grid.",
    freshnessRequirement: "medium",
    rule: "Can lean absurd; must still be specific enough to pique interest.",
  },
];

export const MODE_BY_ID: Record<ModeId, Mode> = Object.fromEntries(
  MODES.map((m) => [m.id, m]),
) as Record<ModeId, Mode>;

export const MODE_IDS = MODES.map((m) => m.id) as readonly ModeId[];
