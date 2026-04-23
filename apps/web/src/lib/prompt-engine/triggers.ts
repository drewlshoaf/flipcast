// Interest-trigger archetypes. These are the "shapes" a compelling home-page
// prompt tends to take — closer to how listeners actually decide what sounds
// worth hearing than a topic category alone. Each archetype ships with a
// short rule-of-thumb for Claude plus a few opener patterns it can riff on.
//
// Keeping the opener list short on purpose. A larger list tends to make
// Claude copy them verbatim; a tight one forces it to vary phrasing while
// still landing the same beat.

export type TriggerId =
  | "curiosity"
  | "identity"
  | "practical"
  | "social"
  | "playful";

export interface Trigger {
  id: TriggerId;
  label: string;
  intent: string;
  openerPatterns: { en: string[]; es: string[] };
  styleRule: string;
}

export const TRIGGERS: Trigger[] = [
  {
    id: "curiosity",
    label: "Curiosity",
    intent:
      "Name a thing the listener has half-noticed and promise to explain what's actually going on.",
    openerPatterns: {
      en: [
        "why is everyone suddenly…",
        "what happened to…",
        "are we wrong about…",
        "what nobody's saying about…",
        "why this feels different now…",
        "the real reason…",
        "when did X become…",
        "what's actually going on with…",
      ],
      es: [
        "¿por qué todos de repente…",
        "¿qué pasó con…",
        "¿nos equivocamos sobre…",
        "lo que nadie dice sobre…",
        "¿por qué esto se siente distinto ahora…",
        "la verdadera razón por la que…",
        "¿desde cuándo X se volvió…",
        "¿qué está pasando realmente con…",
      ],
    },
    styleRule:
      "Frame something the listener has started noticing but hasn't put words to. Avoid generic 'explainer' phrasing.",
  },
  {
    id: "identity",
    label: "Identity",
    intent:
      "Reflect something back about the listener, their generation, or their social tribe.",
    openerPatterns: {
      en: [
        "are we becoming…",
        "why people like us…",
        "what this says about…",
        "why this generation…",
        "what our habits reveal…",
        "are we turning into the people who…",
      ],
      es: [
        "¿nos estamos convirtiendo en…",
        "por qué los de nuestra generación…",
        "qué dice de nosotros…",
        "por qué esta generación…",
        "qué revelan nuestros hábitos…",
        "¿nos estamos volviendo los que…",
      ],
    },
    styleRule:
      "First-person-plural energy when natural. Should feel like a mirror, not a lecture.",
  },
  {
    id: "practical",
    label: "Practical",
    intent:
      "Offer a mental model, tradeoff, or decision frame the listener can actually use.",
    openerPatterns: {
      en: [
        "how to think about…",
        "what actually matters in…",
        "what to do when…",
        "the real tradeoff behind…",
        "what people get wrong about…",
        "is X actually worth it…",
        "the hidden cost of…",
      ],
      es: [
        "cómo pensar sobre…",
        "qué importa de verdad en…",
        "qué hacer cuando…",
        "el verdadero dilema detrás de…",
        "lo que la gente se equivoca sobre…",
        "¿X realmente vale la pena…",
        "el costo oculto de…",
      ],
    },
    styleRule:
      "Concrete, not preachy. Should feel like a friend who's thought about this longer than you have.",
  },
  {
    id: "social",
    label: "Social conversation",
    intent:
      "Surface a social-etiquette or collective-behavior question we're all quietly negotiating.",
    openerPatterns: {
      en: [
        "is this rude now…",
        "when did this become normal…",
        "are we all pretending…",
        "why nobody can agree on…",
        "has this gone too far…",
        "do we secretly prefer…",
        "why is it easier to X than to Y with the people we know best…",
      ],
      es: [
        "¿ya es grosero esto…",
        "¿desde cuándo es normal…",
        "¿estamos todos fingiendo…",
        "por qué nadie se pone de acuerdo en…",
        "¿esto ya se pasó de la raya…",
        "¿en el fondo preferimos…",
        "¿por qué es más fácil X que Y con la gente cercana…",
      ],
    },
    styleRule:
      "Should feel like something you'd text a friend about. Low-stakes tension, not political drama. A socially-legible contradiction is gold here.",
  },
  {
    id: "playful",
    label: "Playful",
    intent:
      "Small, silly, or low-stakes observations with a wink — good for variety and discovery.",
    openerPatterns: {
      en: [
        "do we all secretly…",
        "are we in our ___ era…",
        "the case for bringing back…",
        "why does everyone suddenly care about…",
        "is this the new status symbol…",
      ],
      es: [
        "¿en secreto todos…",
        "¿ya entramos a nuestra era de…",
        "a favor de que regrese…",
        "¿por qué de repente a todos les importa…",
        "¿este es el nuevo símbolo de estatus…",
      ],
    },
    styleRule:
      "Keep it light. Can be a little absurd. Should make someone smile before they press play.",
  },
];

export const TRIGGER_BY_ID: Record<TriggerId, Trigger> = Object.fromEntries(
  TRIGGERS.map((t) => [t.id, t]),
) as Record<TriggerId, Trigger>;

export const TRIGGER_IDS = TRIGGERS.map((t) => t.id) as readonly TriggerId[];
