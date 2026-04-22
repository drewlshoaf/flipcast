// The canonical prompt list. One source of truth for the home hero's
// floating field, the mobile prompt row, the Surprise me button's random
// pick, and anywhere else on the product that says "here, try one of
// these." Hand-placed coordinates + size + tint so the field reads as
// designed-but-playful rather than random. Coordinates are percentages
// of the hero container; prompts are absolute-positioned.
//
// The center of the hero (roughly 30%–70% horizontal, 25%–75% vertical) is a
// protected read zone — keep prompts away from it.

export type PromptAccent = "sky" | "pink" | "mint" | "violet" | "amber";
export type PromptSize = "sm" | "md" | "lg";

export interface Prompt {
  text: string;
  x: number;
  y: number;
  size: PromptSize;
  accent: PromptAccent;
  tilt?: number;
}

// 25 curated prompts. News + culture + hot-takes + learn-about.
export const PROMPTS: Prompt[] = [
  // Top-left cluster
  { text: "is nuclear power having a comeback?", x: 2, y: 8, size: "md", accent: "sky" },
  { text: "the case for a four-day week", x: 6, y: 24, size: "md", accent: "mint", tilt: -3 },
  { text: "why do people romanticize the 2000s?", x: 1, y: 40, size: "md", accent: "violet" },
  { text: "are dating apps quietly dying?", x: 7, y: 56, size: "md", accent: "pink" },
  { text: "containerized everything", x: 3, y: 72, size: "sm", accent: "sky", tilt: 2 },
  { text: "why streaming peaked", x: 5, y: 88, size: "sm", accent: "mint", tilt: 2 },

  // Upper band (above the read zone)
  { text: "should cities ban cars downtown?", x: 24, y: 4, size: "md", accent: "mint" },
  { text: "the great group-chat backlash", x: 44, y: 2, size: "sm", accent: "pink", tilt: 1 },
  { text: "is AI actually changing radio?", x: 62, y: 5, size: "md", accent: "sky", tilt: -1 },
  { text: "specialty coffee, decoded", x: 80, y: 3, size: "sm", accent: "amber" },

  // Right side
  { text: "what's the deal with 'quiet luxury'?", x: 86, y: 16, size: "md", accent: "violet", tilt: 3 },
  { text: "are headphones the new cigarettes?", x: 90, y: 32, size: "md", accent: "pink" },
  { text: "the truth about cottage-core finance", x: 84, y: 48, size: "lg", accent: "mint", tilt: -2 },
  { text: "why everyone soft-launches now", x: 91, y: 64, size: "md", accent: "sky" },
  { text: "the unironic comeback of the landline", x: 86, y: 80, size: "md", accent: "amber", tilt: 2 },

  // Lower band (below the read zone)
  { text: "why is everyone running ultras?", x: 22, y: 86, size: "md", accent: "pink", tilt: -1 },
  { text: "is the creator economy sustainable?", x: 42, y: 90, size: "sm", accent: "violet" },
  { text: "the new rules of workplace dating", x: 60, y: 88, size: "md", accent: "mint", tilt: 1 },

  // Ambient smaller chips scattered for density
  { text: "podcast vs. talk radio", x: 14, y: 14, size: "sm", accent: "sky", tilt: -3 },
  { text: "AI hiring freezes, explained", x: 16, y: 76, size: "sm", accent: "violet" },
  { text: "satellite politics", x: 76, y: 14, size: "sm", accent: "amber", tilt: 2 },
  { text: "indie journalism's quiet consolidation", x: 78, y: 76, size: "sm", accent: "sky" },
  { text: "newsletters, honestly", x: 88, y: 24, size: "sm", accent: "pink", tilt: -2 },
  { text: "remote work: winning or losing?", x: 12, y: 62, size: "sm", accent: "amber" },
  { text: "the Slack etiquette wars", x: 88, y: 56, size: "sm", accent: "violet", tilt: 1 },
];

const ACCENT_CLASSES: Record<PromptAccent, string> = {
  sky: "bg-sky-100/85 text-sky-700 ring-sky-200",
  pink: "bg-pink-100/85 text-pink-700 ring-pink-200",
  mint: "bg-emerald-100/85 text-emerald-700 ring-emerald-200",
  violet: "bg-violet-100/85 text-violet-700 ring-violet-200",
  amber: "bg-amber-100/85 text-amber-700 ring-amber-200",
};

const SIZE_CLASSES: Record<PromptSize, string> = {
  sm: "px-3 py-1.5 text-[11px]",
  md: "px-4 py-2 text-xs",
  lg: "px-5 py-2.5 text-sm",
};

export function promptClass(p: Prompt): string {
  return `${SIZE_CLASSES[p.size]} ${ACCENT_CLASSES[p.accent]}`;
}

// Tile + dot class maps for the Studio idea rail (and any other place that
// lists prompts without the hero's floating-chip styling).
export const PROMPT_TILE_CLASS: Record<PromptAccent, string> = {
  sky: "bg-sky-50 ring-sky-100 hover:ring-sky-200",
  pink: "bg-pink-50 ring-pink-100 hover:ring-pink-200",
  mint: "bg-emerald-50 ring-emerald-100 hover:ring-emerald-200",
  violet: "bg-violet-50 ring-violet-100 hover:ring-violet-200",
  amber: "bg-amber-50 ring-amber-100 hover:ring-amber-200",
};

export const PROMPT_DOT_CLASS: Record<PromptAccent, string> = {
  sky: "bg-sky-400",
  pink: "bg-pink-400",
  mint: "bg-emerald-400",
  violet: "bg-violet-400",
  amber: "bg-amber-400",
};
