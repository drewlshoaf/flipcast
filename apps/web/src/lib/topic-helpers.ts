// Clickable topic helpers. Each category has a pool; clicking a chip picks a
// random prompt from the pool and drops it in the topic field. Shared
// between the Studio topic composer and the home-page hero composer.
export interface TopicCategory {
  label: string;
  prompts: string[];
}

export const TOPIC_HELPERS: TopicCategory[] = [
  {
    label: "Headline",
    prompts: [
      "The quiet consolidation happening in independent journalism",
      "Why everyone's suddenly rethinking the four-day workweek",
      "The unexpected comeback of nuclear power in blue states",
      "What's actually driving the matcha boom everywhere",
      "The real story behind the latest AI hiring freeze",
      "Why satellite launches are suddenly a political fight",
    ],
  },
  {
    label: "Question",
    prompts: [
      "Why is matcha suddenly everywhere?",
      "Are group chats ruining our attention spans?",
      "Is the creator economy actually sustainable?",
      "Why does nobody agree on what 'AI' even means?",
      "When did dinner parties quietly come back?",
      "Is remote work winning or losing the long game?",
    ],
  },
  {
    label: "Hot take",
    prompts: [
      "The four-day workweek is already dead — nobody wants to admit it",
      "Podcasts are the new talk radio and nobody's saying it",
      "Streaming services peaked two years ago and it's all downhill",
      "Generative AI is a worse version of Google and people prefer it",
      "Nobody actually reads newsletters — we just feel guilty about them",
      "Crypto didn't fail, it just got boring, which is worse",
    ],
  },
  {
    label: "People are talking about",
    prompts: [
      "Why everyone keeps soft-launching relationships on Instagram",
      "The great backlash against group chats that never end",
      "Dating app fatigue and what's actually replacing them",
      "Why 'quiet luxury' burned out in eighteen months",
      "Workplace Slack etiquette wars that have gotten weird",
      "The unironic comeback of the landline",
    ],
  },
  {
    label: "Random",
    prompts: [
      "Why is matcha everywhere now?",
      "What happened with the container wars?",
      "The case for a four-day week",
      "Is AI actually changing radio?",
      "The best dinner party debates right now",
    ],
  },
];

export function pickRandomPrompt(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)]!;
}
