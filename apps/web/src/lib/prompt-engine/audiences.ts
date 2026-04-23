// v1 audience segments. Kept to 3 — broader segmentation without over-slicing.
// Each segment ships with its core interest domains, tonal register, and a
// small set of gold-standard example prompts. The examples are the single
// most important field — Claude uses them as few-shot anchors when generating
// new candidates, and the pattern of each example is worth more than a long
// prose description of "what this audience likes."

export type AudienceId =
  | "curious_professionals_25_39"
  | "plugged_in_younger_18_29"
  | "thoughtful_mainstream_30_45";

export interface Audience {
  id: AudienceId;
  label: string;
  ageBand: string;
  mindset: string;
  interests: string[];
  tonalRegister: string;
  exemplars: { en: string[]; es: string[] };
}

export const AUDIENCES: Audience[] = [
  {
    id: "curious_professionals_25_39",
    label: "Curious professionals",
    ageBand: "25–39",
    mindset:
      "Wants to understand why things are happening now. Reads newsletters, listens to explainer podcasts, doesn't love jargon but will tolerate depth if the payoff is real.",
    interests: [
      "trends",
      "business shifts",
      "technology",
      "media",
      "culture",
      "self-improvement",
      "social change",
    ],
    tonalRegister:
      "Analytical but accessible. A smart friend talking you through what they've been noticing.",
    exemplars: {
      en: [
        "Why is everyone suddenly acting like newsletters are the future of media again?",
        "What nobody's saying about the quiet consolidation in independent journalism",
        "Is the four-day week already dead and nobody wants to admit it?",
        "Why does every Silicon Valley story suddenly feel the same?",
      ],
      es: [
        "¿Por qué todos hablan del nearshoring como si fuera el futuro de México?",
        "La consolidación silenciosa del periodismo independiente en Latinoamérica",
        "¿Ya murió la semana laboral de cuatro días sin que nadie lo reconozca?",
        "¿Por qué cada historia de Silicon Valley empieza a sonar igual?",
      ],
    },
  },
  {
    id: "plugged_in_younger_18_29",
    label: "Plugged-in younger adults",
    ageBand: "18–29",
    mindset:
      "Online-native. Reads vibes, group chats, and memes first. Wants prompts that mirror things they've already half-noticed about themselves or the people around them.",
    interests: [
      "identity",
      "internet culture",
      "relationships",
      "aesthetics",
      "humor",
      "social behavior",
      "generational habits",
    ],
    tonalRegister:
      "Playful, chatty, sometimes a little self-aware. Talks to the listener like a friend who just noticed something weird at a party.",
    exemplars: {
      en: [
        "Are we all pretending to like voice notes more than we actually do?",
        "Are we in our landline era now?",
        "Why does every 24-year-old suddenly have a newsletter?",
        "Is it rude to leave someone on read in 2026?",
      ],
      es: [
        "¿Estamos todos fingiendo que nos gustan los audios de WhatsApp?",
        "¿Ya entramos a la era del teléfono fijo otra vez?",
        "¿Por qué todos los de 24 tienen un newsletter ahora?",
        "¿En 2026 sigue siendo grosero dejar a alguien en visto?",
      ],
    },
  },
  {
    id: "thoughtful_mainstream_30_45",
    label: "Thoughtful mainstream adults",
    ageBand: "30–45",
    mindset:
      "Too busy for takes that waste time. Wants prompts that feel practical, grounded, and relevant to real life — work, money, wellness, family — framed with enough tension to be worth the listen.",
    interests: [
      "practical life questions",
      "work and money",
      "media and culture",
      "wellness",
      "family",
      "lifestyle",
    ],
    tonalRegister:
      "Conversational. Clear, warm, not preachy. Asks the question you've already been chewing on in the car.",
    exemplars: {
      en: [
        "When did health start feeling like a full-time job?",
        "What actually matters when you're picking a side hustle?",
        "Why does every parenting trend sound like it was designed to make us feel behind?",
        "What people get wrong about burnout right now",
      ],
      es: [
        "¿Cuándo se convirtió la salud en un segundo trabajo?",
        "¿Qué importa de verdad al elegir un side hustle?",
        "¿Por qué cada tendencia de crianza parece diseñada para hacernos sentir atrás?",
        "Lo que la gente se equivoca sobre el burnout ahora mismo",
      ],
    },
  },
];

export const AUDIENCE_BY_ID: Record<AudienceId, Audience> = Object.fromEntries(
  AUDIENCES.map((a) => [a.id, a]),
) as Record<AudienceId, Audience>;

export const AUDIENCE_IDS = AUDIENCES.map((a) => a.id) as readonly AudienceId[];
