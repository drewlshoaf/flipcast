// Fixed catalog of interest tags. Used by:
//   - users.interests (selection on profile)
//   - ads.interests (targeting metadata)
//   - /api/ideas/for-me (Claude prompt seasoning)
// Add to the end; don't reorder ids since they're stored on user rows.

export interface Interest {
  id: string;
  label: string;
  emoji: string;
}

export const INTEREST_CATALOG: readonly Interest[] = [
  { id: "tech", label: "Tech", emoji: "💻" },
  { id: "politics", label: "Politics", emoji: "🏛️" },
  { id: "sports", label: "Sports", emoji: "🏟️" },
  { id: "food", label: "Food", emoji: "🍳" },
  { id: "wellness", label: "Wellness", emoji: "🧘" },
  { id: "finance", label: "Finance", emoji: "💵" },
  { id: "business", label: "Business", emoji: "💼" },
  { id: "entertainment", label: "Entertainment", emoji: "🎬" },
  { id: "music", label: "Music", emoji: "🎧" },
  { id: "gaming", label: "Gaming", emoji: "🎮" },
  { id: "travel", label: "Travel", emoji: "✈️" },
  { id: "science", label: "Science", emoji: "🔬" },
  { id: "history", label: "History", emoji: "📜" },
  { id: "art", label: "Art", emoji: "🎨" },
  { id: "lifestyle", label: "Lifestyle", emoji: "🛋️" },
  { id: "productivity", label: "Productivity", emoji: "🗓️" },
] as const;

export const INTEREST_IDS: readonly string[] = INTEREST_CATALOG.map(
  (i) => i.id,
);

export const INTEREST_BY_ID: ReadonlyMap<string, Interest> = new Map(
  INTEREST_CATALOG.map((i) => [i.id, i] as const),
);

export function isValidInterestId(value: string): boolean {
  return INTEREST_BY_ID.has(value);
}

export function sanitizeInterests(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (typeof v !== "string") continue;
    if (!isValidInterestId(v)) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= 16) break;
  }
  return out;
}
