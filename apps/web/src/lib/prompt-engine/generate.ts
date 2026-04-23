import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import type { Locale } from "@/lib/i18n/locale";
import { AUDIENCES, AUDIENCE_IDS, type AudienceId } from "./audiences";
import { TRIGGERS, TRIGGER_IDS } from "./triggers";
import { MODES, MODE_IDS, type ModeId } from "./modes";
import {
  promptConceptSchema,
  TITLE_SHAPES,
  CATEGORIES,
  BEST_AS_FORMATS,
  TONE_TAGS,
  type PromptConcept,
} from "./schema";

// Single Claude call that emits a batch of audience-fit prompt concepts.
// Batching (rather than one call per audience × mode) keeps cost low and
// lets Claude self-moderate for variety across the set.
//
// Model: Haiku 4.5. Tool-call with strict JSON schema; Zod validates on the
// way out so malformed items are dropped rather than crashing the handler.

// Haiku 4.5 kept returning empty tool inputs on batches of 16 with the full
// score schema — it'd happily run the call (~20s) then emit `{}`. Dropping
// batch size + bumping max_tokens fixed it. Sonnet handles the full schema
// comfortably but adds cost; Haiku is sufficient if we stay under its
// apparent tool-output complexity ceiling. `loadHomePromptConcepts` runs
// two batches in parallel when it needs a bigger pool.
const PROMPT_ENGINE_MODEL = "claude-haiku-4-5-20251001";
const PROMPT_ENGINE_MAX_TOKENS = 6144;

export const DEFAULT_BATCH_SIZE = 12;

interface GenerateArgs {
  locale: Locale;
  // How many concepts to ask for. Claude may return fewer after self-moderation.
  batchSize?: number;
  // Optional bias: if the caller knows the viewer's interests (logged-in
  // user), we pass them as a soft preference. We don't filter on them —
  // they just nudge which domains Claude reaches for first.
  interestBias?: string[];
  // Optional audience filter — e.g. admin debug page wants to inspect one
  // segment in isolation. Default = all three segments in the batch.
  audienceFilter?: AudienceId[];
  // Optional mode filter. Default = all four modes in the batch.
  modeFilter?: ModeId[];
}

export interface GenerateResult {
  concepts: PromptConcept[];
  model: string;
  raw: unknown;
}

// Tool schema — mirrors promptConceptSchema. We keep it explicit rather
// than derived from Zod because Anthropic's tool input_schema wants a
// JSONSchema-shaped object and the one-off duplication is clearer than a
// runtime converter.
const PROMPT_ENGINE_TOOL = {
  name: "emit_prompt_concepts",
  description:
    "Emit a batch of audience-fit home-page prompt concepts with self-scores.",
  input_schema: {
    type: "object",
    properties: {
      concepts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            target_audience: {
              type: "string",
              enum: AUDIENCE_IDS as readonly string[],
            },
            topic_domain: { type: "string" },
            interest_trigger: {
              type: "string",
              enum: TRIGGER_IDS as readonly string[],
            },
            tone: { type: "string" },
            freshness_requirement: {
              type: "string",
              enum: ["low", "medium", "high"],
            },
            listener_payoff: { type: "string" },
            prompt_concept: { type: "string" },
            title_shape: {
              type: "string",
              enum: TITLE_SHAPES as readonly string[],
              description:
                "Surface form of the prompt_concept. statement | claim | contrast | social_observation | contradiction | question. See — TITLE-SHAPE BALANCING — in the system prompt.",
            },
            why_this_works: { type: "string" },
            scores: {
              type: "object",
              properties: {
                immediacy: { type: "integer", minimum: 1, maximum: 5 },
                relevance: { type: "integer", minimum: 1, maximum: 5 },
                novelty: { type: "integer", minimum: 1, maximum: 5 },
                emotional_recognition: { type: "integer", minimum: 1, maximum: 5 },
                social_shareability: { type: "integer", minimum: 1, maximum: 5 },
                utility: { type: "integer", minimum: 1, maximum: 5 },
                timeliness: { type: "integer", minimum: 1, maximum: 5 },
              },
              required: [
                "immediacy",
                "relevance",
                "novelty",
                "emotional_recognition",
                "social_shareability",
                "utility",
                "timeliness",
              ],
            },
            category: {
              type: "string",
              enum: CATEGORIES as readonly string[],
              description:
                "Dominant editorial category. Drives sectioning + filter chips. See — CATEGORY — in the system prompt.",
            },
            descriptor: {
              type: "string",
              description:
                "Short one-line angle clarifier shown under the title. ≤12 words. UI copy, not internal justification.",
            },
            best_as: {
              type: "string",
              enum: BEST_AS_FORMATS as readonly string[],
              description:
                "Episode format that best realizes this concept. newscast (solo) | pals (two hosts) | panel (multi-voice).",
            },
            tone_tag: {
              type: "string",
              enum: TONE_TAGS as readonly string[],
              description:
                "Closed-enum tone badge for UI. sharp | chatty | analytical | playful | reflective.",
            },
          },
          required: [
            "target_audience",
            "topic_domain",
            "interest_trigger",
            "tone",
            "freshness_requirement",
            "listener_payoff",
            "prompt_concept",
            "title_shape",
            "why_this_works",
            "scores",
            "category",
            "descriptor",
            "best_as",
            "tone_tag",
          ],
        },
      },
    },
    required: ["concepts"],
  },
} as const;

function buildSystemPrompt(_locale: Locale): string {
  const langLine =
    "Write every prompt_concept, why_this_works, and listener_payoff in English. Lean U.S. / broad English-speaking cultural context.";

  const audiences = AUDIENCES.map((a) => {
    const examples = a.exemplars.en
      .map((x) => `    • ${x}`)
      .join("\n");
    return [
      `  - ${a.id} — ${a.label} (${a.ageBand})`,
      `    Mindset: ${a.mindset}`,
      `    Interests: ${a.interests.join(", ")}`,
      `    Tone: ${a.tonalRegister}`,
      `    Exemplar prompts (match this feel):\n${examples}`,
    ].join("\n");
  }).join("\n\n");

  const triggers = TRIGGERS.map((t) => {
    const openers = t.openerPatterns.en
      .map((x) => `      "${x}"`)
      .join("\n");
    return [
      `  - ${t.id} — ${t.label}`,
      `    Intent: ${t.intent}`,
      `    Opener patterns (riff, don't copy verbatim):\n${openers}`,
      `    Style rule: ${t.styleRule}`,
    ].join("\n");
  }).join("\n\n");

  const modes = MODES.map((m) =>
    `  - ${m.id} — ${m.label}. ${m.intent} Rule: ${m.rule} (freshness=${m.freshnessRequirement})`,
  ).join("\n");

  return [
    "You generate home-page PROMPT CONCEPTS for flipcast, a personalized on-demand podcast.",
    "",
    "A home-page prompt is NOT a topic label. It is a framed question or observation a real listener would click because they have half-noticed it themselves. Your job is not to list topics. Your job is to surface prompts that feel like something worth pressing PLAY on.",
    "",
    langLine,
    "",
    "— THE FLIPCAST LANE —",
    "flipcast's strongest home-page candidates live in a specific lane. Stay in it. Lean hard on:",
    "  • modern work tension (return-to-office, side hustles, quiet layoffs, burnout nobody admits)",
    "  • money + flexibility tradeoffs (gig work math, moving cities for rent, the real cost of X)",
    "  • communication weirdness (voice notes, group chats, texting strangers vs. calling friends)",
    "  • lifestyle optimization fatigue (wellness as homework, productivity as identity)",
    "  • social behavior contradictions (things we all do but won't say we do)",
    "  • culture shifts with personal stakes (platform moves, 'cool' swaps, generational habits)",
    "Outside the lane — abstract geopolitics, academic framings, pure explainer content — is a miss.",
    "",
    "— THE DRAFT-THEN-TIGHTEN DISCIPLINE —",
    "For each concept, do this silently in your head before you emit:",
    "  1. Draft the underlying episode idea (what would the show actually argue?).",
    "  2. REWRITE that idea as a tight home-page prompt. A prompt is shorter, instinctive, and more recognizable than its underlying thesis.",
    "  3. Only emit the tight prompt in `prompt_concept`. Put the underlying idea in `why_this_works`.",
    "A homepage prompt and a transcript thesis are NOT the same thing. The homepage version is always tighter.",
    "",
    "Before/after examples of the tightening you should be doing:",
    "  'What the AI anxiety tells us about the way we think about work' → 'Why AI panic hits people with safe jobs the hardest'",
    "  'What nobody's saying about AI replacing creative jobs right now' → 'The real way AI is breaking creative careers'",
    "  'Is print magazines having a moment?' → 'Why buying a magazine suddenly feels cool again'",
    "  'Analyzing the changing norms of asynchronous communication' → 'When did voice notes become a whole negotiation?'",
    "Notice: the right side is shorter, punchier, and framed from the listener's point of view.",
    "",
    "— CONTRADICTION IS GOLD —",
    "The single strongest pattern for a home-page prompt is a socially legible contradiction — something people quietly recognize in themselves but don't say out loud. A few that land:",
    "  'Calling your best friend now feels weirdly high-stakes'",
    "  'The side hustle that costs more than it pays'",
    "  'Flexibility started to feel worse than a real schedule'",
    "  'We call it wellness when it feels like homework'",
    "When you spot a contradiction like this, favor it. Generate more of this pattern.",
    "",
    "— TITLE-SHAPE BALANCING —",
    "The model's biggest surface-level failure mode is defaulting every prompt to 'Why X…' framing. The home page should NOT be a wall of 'Why' tiles — it should feel like six different kinds of conversation invitations.",
    "Each concept must declare its `title_shape` from one of:",
    "  • STATEMENT — declarative observation in the indicative. 'Boring is starting to look like a flex.'",
    "  • CLAIM — an assertion the show will defend or test. 'Most company AI pilots were never really meant to ship.'",
    "  • CONTRAST — two halves in tension, often two short sentences. 'Health advice keeps changing. Your habits probably shouldn't.'",
    "  • SOCIAL_OBSERVATION — a noticed pattern of behavior. 'Calling your best friend now feels weirdly high-stakes.'",
    "  • CONTRADICTION — a thing people quietly do but won't say out loud. 'The side hustle that costs more than it pays.'",
    "  • QUESTION — a real question (open-ended, not a rhetorical 'Why...'). 'Are we all pretending voice notes don't feel weird?'",
    "",
    "ACROSS A BATCH OF " + String(DEFAULT_BATCH_SIZE) + " CONCEPTS, AT MOST ⌊batch / 4⌋ may use 'Why...' framing. That means in a 12-concept batch, at most 3 may start with 'Why'. Past that cap, the same concept lands harder rewritten as a STATEMENT, CLAIM, or CONTRADICTION.",
    "",
    "Concrete WAS → PREFER rewrites (the right column is the bar):",
    "  WAS: 'Why parenting feels more like a curriculum than intuition now'",
    "  PREFER: 'Parenting started to feel like homework' (statement)",
    "  WAS: 'Why your company\\'s AI pilot project is still just a pilot'",
    "  PREFER: 'Most company AI pilots were never really meant to ship' (claim)",
    "  WAS: 'Why return-to-office suddenly means keeping two apartments'",
    "  PREFER: 'Return-to-office is becoming a second-rent problem' (claim)",
    "  WAS: 'Why health advice keeps changing but your habits shouldn\\'t'",
    "  PREFER: 'Health advice keeps changing. Your habits probably shouldn\\'t.' (contrast)",
    "  WAS: 'Why it\\'s easier to text a near-stranger than call a close friend'",
    "  PREFER: 'Calling your best friend now feels weirdly high-stakes' (social_observation)",
    "  WAS: 'Are we in our \"boring is cool\" era now'",
    "  PREFER: 'Boring is starting to look like a flex' (statement)",
    "",
    "DEFAULT TO STATEMENT / CLAIM / CONTRADICTION first. Reach for QUESTION (and especially 'Why...') only when it's genuinely the strongest shape for that concept. Distribute shapes deliberately across the batch — variety in shape is as important as variety in domain.",
    "",
    "— AUDIENCES —",
    "Three segments. Distribute concepts across all three unless instructed otherwise. Each concept names exactly one target_audience.",
    "",
    audiences,
    "",
    "— INTEREST TRIGGERS —",
    "Each concept uses exactly one interest_trigger archetype. Vary across the batch. Do NOT copy the opener patterns verbatim — use them as shape references.",
    "",
    triggers,
    "",
    "— GENERATION MODES —",
    "Each concept implicitly fits one of these modes — pick tone/freshness accordingly. Mix modes across the batch.",
    "",
    modes,
    "",
    "— HARD RULES —",
    "  1. LISTENER LANGUAGE, not analyst language. If it sounds like an academic paper title or a newsroom headline, rewrite it.",
    "  2. 6–14 words per prompt_concept. Tight. A home-page tile should be scannable in one glance.",
    "  3. Specific, not broad. 'wellness' is not a prompt. 'When did health start feeling like a full-time job?' is.",
    "  4. Banned openers: 'In this episode', 'Let's dive into', 'Analyzing…', 'A deep dive', 'What the X tells us about'. Ever.",
    "  5. Banned phrasings: 'what this reveals about', 'the implications of', 'unpacking', 'exploring'. Essayist tells.",
    "  6. If the trigger is 'playful', you can lean silly — but still specific and concrete.",
    "  7. Rotate domains across the batch. No more than 3 prompts in any single domain (media, work, wellness, etc.).",
    "  8. Rotate triggers across the batch. No more than 4 prompts using the same interest_trigger archetype.",
    "  9. Score HONESTLY. A 5-star immediacy means a scanning listener clicks in 2 seconds flat. Don't inflate.",
    "",
    "— THE TAP-WORTHINESS SELF-CHECK —",
    "Before emitting any concept, ask: 'Would a real person from the target_audience actually tap this?' If the answer is 'maybe, if they're in the mood for an explainer' — that's a no. Rewrite or drop it.",
    "",
    "— SCORING DIMENSIONS (1–5) —",
    "  immediacy — would a scanning listener click within 2 seconds?",
    "  relevance — does it fit the target_audience mindset?",
    "  novelty — does it feel fresh vs. obvious takes we've all heard? Contradiction prompts score high here.",
    "  emotional_recognition — does the listener feel 'yes, I've thought this but never said it'?",
    "  social_shareability — would the listener send this to one friend who'd text back 'lol yes'?",
    "  utility — does the listener walk away with a frame, tradeoff, or fact? (Lower weight — don't inflate.)",
    "  timeliness — does this anchor to a real cultural moment? (High for current mode, low for evergreen.)",
    "",
    "— CATEGORY (editorial bucket) —",
    "Each concept is tagged with exactly one `category`. Pick the DOMINANT bucket — if a concept straddles two (e.g. AI + work), name the one a scanning listener would sort it under first.",
    "  • news — tied to a breaking story or this-week cultural moment",
    "  • work — jobs, offices, careers, RTO, quiet layoffs, burnout",
    "  • money — personal finance, cost of living, gig economy, rent",
    "  • ai — generative AI, automation, replacement anxiety, AI products",
    "  • culture — media, music, movies, online trends, taste shifts",
    "  • society — civic life, demographics, norms, housing, cities",
    "  • relationships — friendships, dating, family, communication",
    "  • wellness — health, fitness, mental health, optimization",
    "Distribute across categories in the batch — don't stack 6 concepts in one bucket.",
    "",
    "— DESCRIPTOR (UI angle line) —",
    "Each concept gets a short `descriptor` — a one-line clarifier of the angle, NOT a paragraph. ≤12 words. This is USER-FACING copy that sits under the title on the card. Different from `why_this_works` (internal justification).",
    "Examples:",
    "  Title: 'Why AI panic hits people with safe jobs the hardest'",
    "  Descriptor: 'Work anxiety, trust, and invisible employer tactics'",
    "  Title: 'Calling your best friend now feels weirdly high-stakes'",
    "  Descriptor: 'Why closeness now feels harder than distance'",
    "  Title: 'Wellness stopped being advice and became homework'",
    "  Descriptor: 'How wellness turned into guilt and performance'",
    "  Title: 'Boring is starting to look like a flex'",
    "  Descriptor: 'A status shift disguised as simplicity'",
    "",
    "— BEST-AS FORMAT —",
    "Each concept names the ONE episode format that would produce the best version of it:",
    "  • newscast — solo host, clear thesis, analytical. Fits news + claims + explainers.",
    "  • pals — two hosts riffing, chatty, relatable. Fits contradictions + social observations + lifestyle.",
    "  • panel — multi-voice, multi-POV debate. Fits controversial claims + cultural shifts with real tension.",
    "",
    "— TONE TAG —",
    "Each concept names a `tone_tag` from a closed set:",
    "  • sharp — pointed, lean, incisive",
    "  • chatty — warm, conversational, light",
    "  • analytical — careful, weighing tradeoffs",
    "  • playful — silly, surprising, self-aware",
    "  • reflective — thoughtful, slower-paced",
    "Distinct from the open-ended `tone` field (free-form hint). `tone_tag` is the UI badge.",
    "",
    "— OUTPUT —",
    "Emit via the `emit_prompt_concepts` tool. Return a diverse batch — mix of current, evergreen, practical, playful; mix of work/money, culture/identity, communication, wellness, relationships. The home page should feel ALIVE, not like ten versions of the same smart-culture take.",
  ].join("\n");
}

function buildUserMessage(args: GenerateArgs, batchSize: number): string {
  const audiences = args.audienceFilter ?? AUDIENCE_IDS;
  const modes = args.modeFilter ?? MODE_IDS;
  const lines = [
    `Generate ${batchSize} prompt concepts.`,
    `Audiences to use: ${audiences.join(", ")}.`,
    `Modes to cover: ${modes.join(", ")}.`,
    `Timestamp: ${new Date().toISOString()}.`,
  ];
  if (args.interestBias && args.interestBias.length > 0) {
    lines.push(
      `Soft bias toward these interest tags when natural (do NOT force them): ${args.interestBias.join(", ")}.`,
    );
  }
  return lines.join("\n");
}

export async function generatePromptConcepts(
  args: GenerateArgs,
): Promise<GenerateResult> {
  if (!env.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set; prompt engine requires it.");
  }
  const batchSize = args.batchSize ?? DEFAULT_BATCH_SIZE;
  const client = new Anthropic({ apiKey: env.anthropicApiKey });
  const response = await client.messages.create({
    model: PROMPT_ENGINE_MODEL,
    max_tokens: PROMPT_ENGINE_MAX_TOKENS,
    system: buildSystemPrompt(args.locale),
    tools: [PROMPT_ENGINE_TOOL],
    tool_choice: { type: "tool", name: "emit_prompt_concepts" },
    messages: [{ role: "user", content: buildUserMessage(args, batchSize) }],
  });
  console.log(
    `[prompt-engine] response stop_reason=${response.stop_reason} in_tokens=${response.usage.input_tokens} out_tokens=${response.usage.output_tokens}`,
  );

  const block = response.content.find(
    (b) => b.type === "tool_use" && b.name === "emit_prompt_concepts",
  );
  if (!block || block.type !== "tool_use") {
    throw new Error("emit_prompt_concepts tool output missing.");
  }
  const raw = block.input as { concepts?: unknown };
  const rawConcepts = Array.isArray(raw.concepts) ? raw.concepts : [];

  // Per-item Zod validation so a single malformed concept doesn't poison the
  // whole batch. Dropped items get logged; the rest flow through.
  const concepts: PromptConcept[] = [];
  for (const c of rawConcepts) {
    const parsed = promptConceptSchema.safeParse(c);
    if (parsed.success) {
      concepts.push(parsed.data);
    } else {
      console.warn(
        "[prompt-engine] dropping malformed concept:",
        parsed.error.flatten(),
      );
    }
  }
  console.log(
    `[prompt-engine] locale=${args.locale} kept=${concepts.length}/${rawConcepts.length}`,
  );

  return {
    concepts,
    model: PROMPT_ENGINE_MODEL,
    raw: rawConcepts,
  };
}
