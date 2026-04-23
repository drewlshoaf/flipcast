// Structured topic field for Home V2. Unlike V1's free-scatter layout, this
// data is grouped by placement zone per the V2 spec: a top arc, a left rail,
// a right rail, short "satellite" pills in the NW/NE quadrants near the hero
// outer edge, and a centered bottom cluster under the CTA row.
//
// Coordinates on `absolute` items are % of the hero container. The center
// read lane (roughly x:34–66%, y:18–80%) is protected — nothing on absolute
// rails should land inside it.

export type BubbleAccent = "sky" | "pink" | "mint" | "violet" | "amber";
export type BubbleSize = "sm" | "md" | "lg" | "xl";

export interface PlacedBubble {
  text: string;
  x: number;
  y: number;
  size: BubbleSize;
  accent: BubbleAccent;
  tilt?: number;
}

export interface FlowBubble {
  text: string;
  size: BubbleSize;
  accent: BubbleAccent;
  tilt?: number;
  // Vertical nudge in px applied as margin-top. Negative lifts the pill,
  // positive drops it — used for per-item fine-tuning within a flex row.
  nudgeY?: number;
}

// A. Top arc — a band above the hero, spanning the upper-middle width.
// Kept short/punchy so it reads as a gentle arc rather than a second rail.
export const ARC_BUBBLES: PlacedBubble[] = [
  { text: "what do polls miss?", x: 18, y: 2, size: "sm", accent: "sky" },
  { text: "four-day week?", x: 36, y: 2, size: "md", accent: "sky" },
  { text: "quiet luxury", x: 54, y: 2, size: "xl", accent: "violet" },
  { text: "podcast vs. radio", x: 72, y: 3, size: "sm", accent: "sky" },
];

// B. Left rail — vertical stack, mixed widths and tints, consistent gaps.
export const LEFT_RAIL: PlacedBubble[] = [
  { text: "what's in matcha?", x: 10, y: 20, size: "md", accent: "pink" },
  { text: "four-day week", x: 11, y: 42, size: "xl", accent: "mint" },
  { text: "why self-surgery?", x: 12, y: 64, size: "sm", accent: "violet" },
];

// C. Right rail — mirrors the left rail's visual weight.
export const RIGHT_RAIL: PlacedBubble[] = [
  { text: "why AI on radio?", x: 90, y: 20, size: "md", accent: "sky" },
  { text: "why F1 here now?", x: 91, y: 42, size: "md", accent: "pink" },
  { text: "why landlines back?", x: 88, y: 64, size: "sm", accent: "mint" },
];

// D. Near-center satellites — short pills hugging the outer edge of the
// hero in the NW and NE quadrants. Must stay outside the central lane.
export const NEAR_CENTER: PlacedBubble[] = [
  { text: "what did D4vd do?", x: 26, y: 18, size: "sm", accent: "pink" },
  { text: "nostalgia wave?", x: 22, y: 34, size: "md", accent: "pink" },
  { text: "what's up in Venezuela?", x: 74, y: 18, size: "sm", accent: "sky" },
  { text: "trend fatigue?", x: 78, y: 34, size: "xl", accent: "amber" },
];

// E. Bottom arc — mirrors the top arc along the lower edge of the hero
// section. Placed (absolute) rather than flex-wrap so these pills join the
// same "bunch" as the rails, near-center, and top arc instead of hanging
// off the bottom.
export const BOTTOM_ARC: PlacedBubble[] = [
  { text: "what is pickleball?", x: 22, y: 82, size: "sm", accent: "sky" },
  { text: "what is cottage-core?", x: 78, y: 82, size: "sm", accent: "mint" },
];

export const ALL_V2_TOPICS: PlacedBubble[] = [
  ...ARC_BUBBLES,
  ...LEFT_RAIL,
  ...RIGHT_RAIL,
  ...NEAR_CENTER,
  ...BOTTOM_ARC,
];

const ACCENT_CLASSES: Record<BubbleAccent, string> = {
  sky: "bg-sky-100/85 text-sky-700 ring-sky-200",
  pink: "bg-pink-100/85 text-pink-700 ring-pink-200",
  mint: "bg-emerald-100/85 text-emerald-700 ring-emerald-200",
  violet: "bg-violet-100/85 text-violet-700 ring-violet-200",
  amber: "bg-amber-100/85 text-amber-700 ring-amber-200",
};

const SIZE_CLASSES: Record<BubbleSize, string> = {
  sm: "px-3 py-1.5 text-[14px]",
  md: "px-4 py-2 text-[15px]",
  lg: "px-5 py-2.5 text-[17px]",
  xl: "px-6 py-3 text-[20px]",
};

export function v2BubbleClass(b: { size: BubbleSize; accent: BubbleAccent }): string {
  return `${SIZE_CLASSES[b.size]} ${ACCENT_CLASSES[b.accent]}`;
}
