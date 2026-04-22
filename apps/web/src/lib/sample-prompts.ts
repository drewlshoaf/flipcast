// Shared "More to start from" prompt list. Used on the home page's lower
// section AND in the studio's idea rail so both surfaces show the same
// playful, on-brand starting points.

export type PromptAccent = "sky" | "pink" | "mint" | "violet" | "amber";

export interface SamplePrompt {
  text: string;
  accent: PromptAccent;
}

export const SAMPLE_PROMPTS: SamplePrompt[] = [
  { text: "the truth about gut-health hype", accent: "mint" },
  { text: "why is everyone leaving X for Bluesky?", accent: "sky" },
  { text: "is print magazines having a moment?", accent: "amber" },
  { text: "the new etiquette of voice notes", accent: "pink" },
  { text: "why standup is bigger than ever", accent: "violet" },
  { text: "what happened to indie movie theaters?", accent: "amber" },
  { text: "the strange economy of livestream poker", accent: "sky" },
  { text: "are gen-z really drinking less?", accent: "pink" },
  { text: "the secret history of the Costco hot dog", accent: "amber" },
  { text: "is fitness culture eating wellness alive?", accent: "mint" },
  { text: "why nobody can agree on what 'AI' means", accent: "violet" },
  { text: "the comeback of in-person book clubs", accent: "pink" },
  { text: "what's actually happening with the housing market", accent: "sky" },
  { text: "why Formula 1 finally cracked America", accent: "violet" },
  { text: "the case for boring vacations", accent: "mint" },
  { text: "is everyone secretly burned out on AI?", accent: "amber" },
];

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
