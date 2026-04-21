// Topic bubble field for the home hero. Hand-placed coordinates + size + tint
// so the field reads as designed-but-playful rather than random. Coordinates
// are percentages of the hero container; bubbles are absolute-positioned.
//
// The center of the hero (roughly 30%–70% horizontal, 25%–75% vertical) is a
// protected read zone — keep bubbles away from it. Higher density toward the
// outer ring.

export type BubbleAccent = "sky" | "pink" | "mint" | "violet" | "amber";
export type BubbleSize = "sm" | "md" | "lg";

export interface Bubble {
  text: string;
  // % from top-left of the hero container
  x: number;
  y: number;
  size: BubbleSize;
  accent: BubbleAccent;
  // Optional rotation in degrees for a touch of life
  tilt?: number;
}

// Curated bubble topics. Mix of news, culture, learn-about, hot-takes.
export const BUBBLES: Bubble[] = [
  // Top-left cluster
  { text: "why are we suddenly obsessed with matcha?", x: 4, y: 6, size: "lg", accent: "pink", tilt: -2 },
  { text: "is nuclear power having a comeback?", x: 2, y: 22, size: "md", accent: "sky" },
  { text: "the case for a four-day week", x: 6, y: 38, size: "md", accent: "mint", tilt: -3 },
  { text: "why do people romanticize the 2000s?", x: 1, y: 54, size: "md", accent: "violet" },
  { text: "are dating apps quietly dying?", x: 7, y: 70, size: "md", accent: "pink" },
  { text: "containerized everything", x: 3, y: 86, size: "sm", accent: "sky", tilt: 2 },

  // Upper-mid (above the read zone)
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

  // Lower-mid (below the read zone)
  { text: "why is everyone running ultras?", x: 22, y: 86, size: "md", accent: "pink", tilt: -1 },
  { text: "is the creator economy sustainable?", x: 42, y: 90, size: "sm", accent: "violet" },
  { text: "the new rules of workplace dating", x: 60, y: 88, size: "md", accent: "mint", tilt: 1 },

  // Ambient smaller chips scattered for density
  { text: "podcast vs. talk radio", x: 14, y: 14, size: "sm", accent: "sky", tilt: -3 },
  { text: "AI hiring freezes, explained", x: 16, y: 76, size: "sm", accent: "violet" },
  { text: "satellite politics", x: 76, y: 14, size: "sm", accent: "amber", tilt: 2 },
  { text: "indie journalism's quiet consolidation", x: 78, y: 76, size: "sm", accent: "sky" },
  { text: "why streaming peaked", x: 12, y: 30, size: "sm", accent: "mint", tilt: 2 },
  { text: "newsletters, honestly", x: 88, y: 24, size: "sm", accent: "pink", tilt: -2 },
  { text: "remote work: winning or losing?", x: 12, y: 62, size: "sm", accent: "amber" },
  { text: "the Slack etiquette wars", x: 88, y: 56, size: "sm", accent: "violet", tilt: 1 },
];

const ACCENT_CLASSES: Record<BubbleAccent, string> = {
  sky: "bg-sky-100/85 text-sky-700 ring-sky-200",
  pink: "bg-pink-100/85 text-pink-700 ring-pink-200",
  mint: "bg-emerald-100/85 text-emerald-700 ring-emerald-200",
  violet: "bg-violet-100/85 text-violet-700 ring-violet-200",
  amber: "bg-amber-100/85 text-amber-700 ring-amber-200",
};

const SIZE_CLASSES: Record<BubbleSize, string> = {
  sm: "px-3 py-1.5 text-[11px]",
  md: "px-4 py-2 text-xs",
  lg: "px-5 py-2.5 text-sm",
};

export function bubbleClass(b: Bubble): string {
  return `${SIZE_CLASSES[b.size]} ${ACCENT_CLASSES[b.accent]}`;
}
