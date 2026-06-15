// V1 character-and-casting system primitives. Users express intent via
// vibe + lean; the system runs moderation, resolves the vibe, picks a
// format, and casts recurring named characters from the fixed roster
// (see characters.ts + cast-groupings.ts). These types are the shared
// vocabulary used by the worker pipeline, the API layer, and the studio.

export const VIBES = ["smart", "fun", "warm", "serious"] as const;
export type Vibe = (typeof VIBES)[number];

export const LEANS = ["feminine", "mixed", "masculine"] as const;
export type Lean = (typeof LEANS)[number];

// V1 spec uses Solo / Pals / Panel naming. The existing FlipcastFormat in
// voices.ts uses "newscast" for the same idea ("solo"). Keeping a separate
// alias here so spec-aligned code reads cleanly; the worker pipeline maps
// between the two during Phase 3 (UI swap).
export const SHOWBIZ_FORMATS = ["solo", "pals", "panel"] as const;
export type ShowbizFormat = (typeof SHOWBIZ_FORMATS)[number];

// Role eligibility on a character. A character may carry multiple roles
// (e.g. Owen Mercer is solo + pals + panelist). Moderators are a separate
// family that does not appear in pals or panelist roles, by design.
export const CHARACTER_ROLES = [
  "moderator",
  "panelist",
  "pal",
  "solo",
] as const;
export type CharacterRole = (typeof CHARACTER_ROLES)[number];

export type CharacterGender = "female" | "male";
