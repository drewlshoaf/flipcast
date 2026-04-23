import Anthropic from "@anthropic-ai/sdk";
import {
  transcriptTurnSchema,
  voicesForEngine,
  VOICE_BY_ID,
  formatConfig,
  formatTypeForFlipcastFormat,
  TIME_CONTEXTS,
  TOPIC_DOMAINS,
  USER_INTENTS,
  TONE_PROFILES,
  FRESHNESS_LEVELS,
  FACT_SENSITIVITY_LEVELS,
  SPEAKER_PATTERNS,
  VALIDATION_SEVERITIES,
  type Character,
  type ClaudeCallUsage,
  type EpisodeMetadata,
  type EpisodeSetup,
  type EpisodeValidation,
  type FactSensitivity,
  type FreshnessRequirement,
  type SpeakerPattern,
  type TimeContext,
  type ToneProfile,
  type TopicDomain,
  type TranscriptTurn,
  type TtsEngine,
  type UserIntent,
  type VoiceOption,
  type FlipcastFormat,
  type SceneOutline,
} from "@flipcast/types";

const SETUP_MODEL = "claude-sonnet-4-6";
const NEWSCAST_MODEL = "claude-sonnet-4-6";
const SCENE_MODEL = "claude-sonnet-4-6";
// Lightweight pre-generation classifier — runs once per episode to produce
// the metadata that drives downstream prompt branching. Haiku is plenty for
// this; output is short, structured, and not the place to burn Sonnet tokens.
const CLASSIFIER_MODEL = "claude-haiku-4-5-20251001";
// Post-generation validator — same Haiku model. Reads the assembled
// transcript and emits a small report on five recurring failure modes.
const VALIDATOR_MODEL = "claude-haiku-4-5-20251001";

// English-only after the Spanish teardown. ContentLocale is kept as a type
// alias so existing call signatures still compile, but it has only one
// inhabitant. LOCALE_GUIDANCE collapses to a single object.
type ContentLocale = "en";

const LOCALE_GUIDANCE = {
  languageDirective:
    "Write everything in English (names, bios, dialogue, transitions). Every verbatim line below is also in English.",
  culturalContext:
    "Audience is primarily U.S. English-speaking. Use natural American references and idiom.",
  welcomeFinal: {
    solo: "We'll be right with you after this ad.",
    pals: "We're cracking it open right after this ad.",
    panel: "We're gathering the panelists and we'll start shortly, right after this ad.",
  },
  adBreakExample:
    "a transition out that fits THIS specific scene's energy. The seeds below describe SHAPES, not phrases — invent the actual wording fresh each time. SHAPE OPTIONS (not to copy as phrases): tease the next beat by name ('I want to come back to [the specific thing they said]'), set up a question that will land after the break ('there's one more thing I want to push on when we're back'), end on a thought the listener wants resolved, or just trail off into the break with a fragment. BANNED across all scenes regardless of which words you use: any 'Quick + [break/pause/reset/aside/recap/detour]' opener — the entire family is out. Also banned: 'stay with us', 'don't go anywhere', 'more after the break', 'we'll be right back' as a tic. NO transition phrase is allowed to repeat across scenes — if scene 1 ends one way, scene 2 must end with a different shape AND different words",
  soloWelcomeFinalInstruction:
    "End with this EXACT line as the final sentence (verbatim, no paraphrasing): \"We'll be right with you after this ad.\"",
  backFromBreakOpeners:
    "a return-to-show beat OR — preferred default — no acknowledgement of the break at all. The strongest opener is usually just resuming the conversation: a direct callback to where you left off ('so back to what [name] was saying about [specific thing] —'), a sharp question to a panelist, or a fresh thought that picks up the thread. SHAPE OPTIONS (not to copy as phrases): name-callback, sharp question, fresh thought, single-word reaction. NO opener phrase is allowed to repeat across scenes. BANNED across all scenes: 'And we're back' as a default opener (use at most once per episode if at all); 'Quick + [break/pause/reset/recap/aside/detour]' — entire family is out",
} as const;

function localeFor(_locale: ContentLocale | undefined): ContentLocale {
  return "en";
}

function languagePreambleFor(_locale: ContentLocale): string {
  return [
    "",
    "— OUTPUT LANGUAGE —",
    LOCALE_GUIDANCE.languageDirective,
    "",
    "— CULTURAL CONTEXT —",
    LOCALE_GUIDANCE.culturalContext,
    "",
  ].join("\n");
}

// Fish Audio S2 Pro accepts inline bracketed direction tags that shape
// delivery. The synth reads tags as performance cues, not speech, so
// they never land as literal audio. Reused across every prompt that
// produces spoken text so the welcome, every scene, and the solo newscast
// all get the same vocabulary.
const FISH_TAG_GUIDANCE = [
  "",
  "— VOICE DIRECTION (Fish Audio S2 Pro inline tags) —",
  "Place bracketed performance tags inside the spoken text. Tags affect the phrase around them, not the whole turn, so drop them where the performance should change. Lowercase, spelled exactly.",
  "",
  "RELIABLE PRESETS (use these first — officially supported):",
  "  Pauses & timing: [pause], [short pause]",
  "  Breath & vocals: [inhale], [exhale], [sigh], [panting], [clearing throat], [tsk]",
  "  Laughter: [laughing], [laughing tone], [chuckle], [chuckling], [audience laughter]",
  "  Emotions: [excited], [excited tone], [angry], [sad], [delight], [surprised], [shocked]",
  "  Volume & quality: [whisper], [low voice], [low volume], [loud], [shouting], [screaming], [volume up], [volume down], [echo]",
  "  Delivery: [emphasis], [singing], [interrupting], [with strong accent]",
  "",
  "FREE-FORM (also work in practice — use when a preset doesn't fit):",
  "  Pauses: [gasp], [long pause], [beat], [slight pause], [sharp inhale], [startled gasp], [deep breath], [slightly out of breath]",
  "  Emotional nuance: [nervous], [scared], [confident], [sarcastic], [curious], [disappointed], [relieved], [hopeful], [annoyed], [disgusted], [mysterious], [proud]",
  "  Delivery style: [whisper in small voice], [whispers sweetly], [laughing nervously], [professional broadcast tone], [newscaster style], [narrator], [pitch up], [pitch down], [slow], [fast], [dramatic], [monotone]",
  "",
  "RULES:",
  "  1. One or two tags per turn is usually enough. At most three stacked (e.g. `[whisper][nervous]`). More than that and delivery gets muddy.",
  "  2. Not every turn needs a tag. Use them where they meaningfully change delivery; let plain lines stay plain. Punctuation (commas, em-dashes, ellipses) already shapes pacing.",
  "  3. Let the topic's register pick the tags — sincere/serious topics stay restrained, playful or absurd ones can lean into [laughing] / [delight] / [chuckle], thoughtful explainers reach for [curious] / [mysterious], easy chats use [sigh] / [slow] / [chuckle] sparingly.",
  "  4. Exact spelling matters: `[laughing]` and `[laugh]` are NOT the same tag. Stick to the vocabulary above or use a plain natural-language phrase in brackets if you need something specific.",
  "  5. Never use the multi-speaker syntax `<|speaker:N|>` — each turn is synthesized on its own voice.",
  "  6. Do NOT tag the verbatim ad-break transition line or the verbatim sign-off line. Leave those clean.",
].join("\n");

// Baked once per prompt build so the model has a concrete "now" anchor.
// Without this, Claude drifts into whatever time period it has the crispest
// memories of — usually 2023-era material presented as current. The caller
// passes locale so formatting matches the output language.
function todayBlurb(_locale: ContentLocale): { iso: string; long: string; year: string } {
  const now = new Date();
  const iso = now.toISOString().slice(0, 10);
  const long = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);
  return { iso, long, year: String(now.getFullYear()) };
}

// Temporal framing — fixes the biggest drift we see: confident present-tense
// narration of prior-year events. Establishes "now", then either pins the
// timing mode (when the classifier decided one) or asks the model to
// self-classify. The date is re-evaluated per call so it's always fresh.
function timingModeRules(t: { iso: string; long: string; year: string }, mode: TimeContext): string[] {
  switch (mode) {
    case "current":
      return [
        "MODE: current/live — what's happening now or imminent. The listener expects PRESENT-DAY relevance.",
        `  • Establish what is true NOW (recent weeks/months of ${t.year}) BEFORE reaching back for older context.`,
        "  • CURRENT-LABELING IS NOT ENOUGH. Saying 'in the last six months' or naming the current year does NOT make a claim feel current — it just labels it as such. Current FRAMING with stale CONTENT underneath reads as fake. To feel genuinely current, every major claim about a fluid topic must come with a specific present companion: a recent mechanism (why this is happening NOW vs two years ago), a recent condition (what changed lately), a present-tense practical implication (what this means for whom, today), or a concrete recent example (a specific deal, person, decision, market movement). 'VC is being squeezed from both ends' is a current-framed thesis — it needs the next breath to land an example: which fund, which round, which LP type pulling back, which founder felt it. A current frame around general analysis is still general analysis.",
        "  • Do not present prior-year events, statistics, or narratives as the PRIMARY basis of the script. If the freshest material you have is from a year or more ago, treat it as BACKGROUND — not current state.",
        "  • If you genuinely don't know what's happened recently in this topic, do not manufacture confident present-tense events. Frame openly — what's the open question, what's being debated, what people are watching for. Honest uncertainty beats fluent fabrication.",
        "  • Older context is welcome as background explaining HOW we got here. Verbal tells: 'a year ago', 'historically', 'back when', 'the original framing was'. Don't conflate background with current state.",
      ];
    case "recent_recap":
      return [
        "MODE: recent retrospective — an explicit look back at a recent period (e.g. 'last quarter', 'a year on from X').",
        "  • Anchor the recap in its time frame on the FIRST mention; don't make the listener guess which window you're discussing.",
        "  • Connect what happened to where things stand NOW. The recap exists to inform the present — surface the implications and the through-line, not just the chronology.",
        "  • Avoid drift into pure history. The user asked for 'recent' for a reason; keep the through-line to today taut.",
      ];
    case "historical":
      return [
        "MODE: historical — events, era, or period explicitly in the past.",
        "  • Make the time frame explicit early. Anchor the discussion in the relevant year/era — don't leave the listener wondering when this happened.",
        "  • Do NOT frame events as if unfolding now. Past tense, past-perfect where appropriate.",
        "  • Modern parallels are fine if the user asked for them; otherwise resist the urge to bend the historical material into 'and that's still happening today' — sometimes the past is the point.",
      ];
    case "timeless":
      return [
        "MODE: timeless / evergreen — concepts, principles, durable questions.",
        "  • Avoid forced current-events framing. The topic doesn't need a 'this matters right now' hook to be worth discussing.",
        "  • Prioritize conceptual clarity, durable insight, and accessible examples (which can be from any era).",
        "  • Specific recent stories are useful only when they sharpen the concept — not as a way to make the conversation feel newsy.",
      ];
  }
}

function timingModesMenu(t: { iso: string; long: string; year: string }): string[] {
  // Used when no metadata pins the mode. The model picks one and applies the
  // matching block.
  return [
    "Before drafting, classify the topic's timing mode:",
    "  • current/live — what's happening now or imminent",
    "  • recent retrospective — explicit framing like 'a year on from X', 'looking back at last quarter'",
    "  • historical — explicit framing like 'in 1968', 'the dot-com bust'",
    "  • timeless / general — concepts, principles, evergreen questions",
    "",
    "If the user did NOT specify a time frame, default to current/live. Do not silently slide into older framings because older facts feel more crystallized in memory.",
    "",
    ...timingModeRules(t, "current"),
    "",
    ...timingModeRules(t, "recent_recap"),
    "",
    ...timingModeRules(t, "historical"),
    "",
    ...timingModeRules(t, "timeless"),
  ];
}

function temporalGuidance(locale: ContentLocale, mode?: TimeContext): string {
  const t = todayBlurb(locale);
  const body = mode ? timingModeRules(t, mode) : timingModesMenu(t);
  return [
    "",
    "— TIMING & TEMPORAL FRAMING —",
    `Today is ${t.long} (${t.iso}). Treat that as "now" everywhere in this script.`,
    "",
    ...body,
    "",
    "Confidence ↔ certainty. Match how confident the writing sounds to how confident you actually are. A fluid, uncertain topic should sound like a smart person navigating uncertainty — not an anchor reading off a teleprompter.",
  ].join("\n");
}

// Forced pre-draft planning — makes the model commit to decisions (timing,
// format, speaker roles, factual specificity) before writing, instead of
// sliding every topic into the same polished anchor-news cadence.
const PREDRAFT_PLANNING = [
  "",
  "— PRE-DRAFT PLANNING (do this silently before writing a line) —",
  "Decide these before generating, and let your decisions visibly shape the output:",
  "  1. Timing mode (current/live | recent retrospective | historical | timeless). Default current/live if unspecified.",
  "  2. Format register. The requested format is given below — MATCH its rhythm. A pals chat is not a panel; a panel is not a newscast; a silly riff is not an explainer. Do NOT collapse every format into a polished anchor cadence.",
  "  3. Speaker roles in multi-person formats. Each speaker needs a distinct conversational function — questioner, contrarian, insider, skeptic, comic, expert, friend-who's-been-through-it. They should NOT all sound like polished mini-essays in the same register.",
  "  4. Audience expectation for THIS topic. A vibes question wants a friend conversation; a market story wants reported analysis; a society question wants lived experience; a silly topic wants a silly riff.",
  "  5. Degree of factual specificity warranted. Use grounded specifics when you have them; lean on questions, examples, and reframings when you don't — not on fabricated experts and stats.",
  "  6. Whether historical context is helpful. If yes, decide where it goes and label it as background, not as the current state.",
].join("\n");

// Craft rules — writing for the ear, naming subjects early, banning the
// stock-anchor phrases that creep in by default. Separate from topic-intent
// guidance because it applies to EVERY register (news, culture, silly).
const CRAFT_GUIDANCE = [
  "",
  "— CRAFT (writing for the ear) —",
  "  • Name the central subject — person, company, event, question — early. Don't bury the lede behind atmospheric setup.",
  "  • CLAIM → PAYOFF PAIRING (most important rule on this list). NO broad / summary / framing claim survives more than one sentence without a CONCRETE companion. After 'the market is consolidating', 'consumer behavior shifted', 'X is being squeezed from both ends', 'a lot has changed', the very next breath MUST land a name, a number, a recent moment, a mechanism (why this dynamic exists), a practical implication (what the listener does about it), or a sharp specific example. A thesis sentence is a setup, NEVER a payoff — it is a debt that has to be paid off in the very next sentence. If you can't follow a broad claim with a specific within one or two sentences, CUT THE BROAD CLAIM — keep only the specific. The biggest failure mode of this system is intelligent-sounding sentences that are not earned by what comes after them. Don't write them.",
  "  • NO TWO BROAD FRAMING LINES IN A ROW. Two consecutive sentences each making a broad claim is forbidden — the second is supposed to be the payoff for the first. If you find yourself writing 'X is changing fast' followed by 'and the rules of the game are being rewritten', you've stacked two thesis sentences with no specific between them. Insert a concrete or cut one of the lines.",
  "  • Sound NATIVE to the topic. Venture writing should sound like venture writing, sports like sports, culture like culture. Don't be a generic narrator wearing the topic's vocabulary.",
  "  • Audio-first. Read every line in your head; if it stacks clauses awkwardly when spoken, rewrite it. Clean sentences beat literary ones.",
  "  • Match confidence to certainty. Hedge when you should hedge; assert when you can actually back it. On dynamic topics (markets, politics, AI, culture in motion), distinguish observed patterns from universal truths — 'we're seeing X', 'the pressure is Y', 'a lot of founders are reporting Z' beats flat declarations. If everything sounds maximally certain, nothing sounds genuinely current.",
  "",
  "BANNED-BY-DEFAULT broadcast filler — these rot every podcast they touch. Do not use them unless the user explicitly asked for stiff anchor-news copy:",
  '  "and we\'re back" (used as a default opener every scene) / "stay with us" / "don\'t go anywhere" / "what we\'re watching" / "this moment could reshape ___" / "deserves your attention" / "in today\'s episode" / "buckle up" / "let\'s dive in" / "the question on everyone\'s mind" / "more after the break" used as a tic / "sit tight" / "one of the sharpest conversations we\'ve had on this show" / "the most important conversation right now" / "we\'re cracking it open" / "hold that thought" / "if this made you think" / "share it with one person" / "hit like" / "if you got something out of this".',
  '  Spanish equivalents to avoid: "no se vayan" / "quédense con nosotros" / "hoy en este episodio" / "sin más preámbulo" / "un momento que podría redefinir ___" / "una de las conversaciones más importantes" / "si esto te hizo pensar" / "compártelo con alguien" / "dale like".',
  "  BAN BY STRUCTURAL FORM — paraphrasing around a banned phrase doesn't fix the problem; the FORM is the problem. The following sentence-shapes are forbidden regardless of which words you use:",
  '    • "if this [made/got/helped/has you] [VERB] X" → forbids "if this got you thinking about your own portfolio", "if this made you reconsider your stack", "if this has you wondering about your retirement", and every other variant. The whole conditional-CTA shape is out.',
  '    • "send this to / share this with [someone in your life]" → same form, different words.',
  '    • "Quick [break / reset / recap / detour / aside / pause]" used as a scene-out or scene-opener → all members of this family read as identical broadcast filler. Vary the verb AND the structure (e.g. just keep talking, or land on a question, or trail off into the break).',
  '    • "[Number] things [to watch / to know / to remember]" → forbidden as a closing summary.',
  '    • "What this really comes down to is X" / "the bigger story here is Y" → these are slogan-summaries dressed up; the CRAFT rule against floating thesis sentences applies even harder to these phrasings.',
  "  EXAMPLES IN THIS PROMPT ARE SEEDS, NOT TEMPLATES. When the prompt offers a list of phrasings (back-from-break beats, ad-out transitions, etc.), they are starting points to think with — do NOT copy any of them verbatim. The model that copies a suggested phrase across multiple scenes is the giveaway that the script is auto-generated. Each transition should be invented fresh, fitting the prior beat's specific energy.",
  "  STRUCTURAL TEMPLATE TELLS — also avoid REUSING THE SAME SHAPE: 'confident opener → thesis → tension phrase → break tease → tidy closing insight → like/share outro' is the house chassis the system defaults to, and listeners can hear it across episodes. Vary the SHAPE, not just the words: sometimes open with a question, sometimes a story, sometimes a name, sometimes an aside. Sometimes end with a question instead of a thesis. Sometimes there is no neat closing insight at all — the conversation can just stop on a sharp specific.",
  "  Variety is mandatory. The verbatim welcome-out and sign-off lines (supplied by the system) are the ONE controlled cliché. Everything else should sound like a real person talking, not a broadcast template.",
].join("\n");

// Topic intent guidance — split into News (A) and Cultural (B) halves so the
// classifier can pick the right one. When metadata is absent (e.g. legacy
// callers), both halves ship with selection guidance for self-classification.
const NEWS_INTENT_RULES = [
  "(A) NEWS / ACADEMIC / COGNITIVE register — current events, politics, business, science, technology, law, economics, public health, finance. Treat like reporting + analysis. The rules below apply when you genuinely know the story:",
  "  • ACCURACY-BEATS-FLUENCY OPENING NOTE — Use real, recent specifics when you have them. When you DON'T — story too fresh, too obscure, names you can't actually vouch for — do not invent confident-sounding ones. Fabricated 'Senator Maria Reyes', 'Atlas Networks', 'a 2024 deposition' that doesn't exist destroys the show's credibility worse than vagueness ever could. Restructure: frame around the open question, the angles being debated, what listeners should watch for. Honest uncertainty beats fluent fabrication.",
  "  • When you DO know the players — NAME them. First + last name plus role/title on first reference. 'A tech billionaire' is forbidden if you can name them. 'Marcus Vance, founder of Atlas Networks' is the form.",
  "  • NAME the companies, agencies, courts, publications, schools when you actually know them. 'A federal judge' → 'Judge Amelia Park of the Northern District of California' ONLY if Amelia Park is real and on this case.",
  "  • ATTRIBUTE quotes only to real named people in real venues. If you can't cite a real quote, don't paraphrase one into existence — drop it and use plain analysis instead.",
  "  • SOURCE factual claims when you can — internal documents, filings, studies, datasets you genuinely know. Don't gesture at sources you'd be making up.",
  "  • Numbers and dates beat adjectives WHEN the numbers are real. A confident-sounding fake '47 million users' is worse than 'a userbase well into the tens of millions'.",
  "  • For non-news cognitive topics (deep how-does-X-work explainers), reach for named experts and real institutions you actually know. Same rule: if you don't know the leading researcher in this area, talk about the IDEA in concrete terms rather than inventing 'Dr. Lena Rao at MIT'.",
];

const CULTURAL_INTENT_RULES = [
  "(B) CULTURAL / GABBY / LIGHT register — conversation starters, hot takes about modern life, dating, friendships, social rituals, vibes, weird internet stuff, opinion-bait, pop-culture observations. Treat like a casual riff between friends:",
  "  • Skip the heavy attribution. Personal anecdote and lived experience > expert citation. 'I have a friend who…', 'I was at a wedding last month and…', 'You know that one moment in The Office where…'",
  "  • Funny, neutral, small-talky. Not preachy, not dramatic, not faux-academic. The hosts are reacting like normal people, not delivering a TED talk.",
  "  • Pop-culture references and shared cultural moments anchor the show — TV shows, songs, viral tweets, brand names, generational shorthand. Real public figures by name are fine when relevant.",
  "  • DO NOT fabricate quoted experts, fake studies, or made-up court filings for a topic that's clearly a vibes question. Inventing 'sociology professor Dr. So-and-so at Columbia' for 'why everyone's into pickleball' makes the show feel ridiculous. If you don't have a real expert, don't invent one — talk to the audience as a friend would.",
  "  • Embrace 'I think', 'maybe', 'honestly', 'idk', 'low-key' — the register is conversational, not editorial.",
];

// Domain → register bucket. Sports + general_question are genuinely
// ambiguous; humor_absurdity always goes cultural; etc.
function registerBucketFor(domain: TopicDomain, intent?: UserIntent): "news" | "cultural" | "both" {
  switch (domain) {
    case "news_current_events":
    case "business_finance":
    case "technology_ai":
    case "science_health":
      return "news";
    case "culture_society":
    case "lifestyle_fashion":
    case "entertainment_media":
    case "humor_absurdity":
      return "cultural";
    case "sports":
      // Sports flips on intent: analyze/inform → news; riff/entertain → cultural.
      if (intent === "analyze" || intent === "inform" || intent === "explain")
        return "news";
      if (intent === "riff" || intent === "entertain" || intent === "react")
        return "cultural";
      return "both";
    case "general_question":
      // Default to cultural unless the intent is clearly analytical.
      if (intent === "analyze" || intent === "explain" || intent === "inform")
        return "news";
      return "cultural";
  }
}

function topicIntentGuidance(domain?: TopicDomain, intent?: UserIntent): string {
  const bucket = domain ? registerBucketFor(domain, intent) : "both";
  const lines: string[] = ["", "— TOPIC INTENT (the register this episode lives in) —"];

  if (bucket === "news") {
    lines.push("Use the NEWS / ACADEMIC / COGNITIVE register for the whole episode. Commit to it; don't half-slip into a vibes-chat tone.");
    lines.push(...NEWS_INTENT_RULES);
  } else if (bucket === "cultural") {
    lines.push("Use the CULTURAL / GABBY / LIGHT register for the whole episode. Commit to it; don't half-slip into faux-academic explainer mode.");
    lines.push(...CULTURAL_INTENT_RULES);
  } else {
    // Either no metadata or genuinely ambiguous topic — surface both menus
    // and require the model to commit.
    lines.push(
      "First, classify what the topic is actually asking for. Two registers:",
      "",
      ...NEWS_INTENT_RULES,
      "",
      ...CULTURAL_INTENT_RULES,
      "",
      "Borderline cases: if the topic asks 'what happened with X' it's news. If it asks 'what's the deal with X' or 'why is everyone doing Y' it's cultural. If it sits in the middle, pick the lighter side and use a named expert or real public figure ONLY when you'd actually quote them in real life.",
      "Whichever register you pick, commit to it for the whole episode. Don't half-source a vibes topic; don't undercite a news topic.",
    );
  }
  return lines.join("\n");
}

const ZERO_USAGE: ClaudeCallUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
};

function extractUsage(response: Anthropic.Message): ClaudeCallUsage {
  const u = response.usage as
    | {
        input_tokens?: number;
        output_tokens?: number;
        cache_read_input_tokens?: number | null;
        cache_creation_input_tokens?: number | null;
      }
    | undefined;
  return {
    inputTokens: u?.input_tokens ?? 0,
    outputTokens: u?.output_tokens ?? 0,
    cacheReadTokens: u?.cache_read_input_tokens ?? 0,
    cacheCreationTokens: u?.cache_creation_input_tokens ?? 0,
  };
}
import { z } from "zod";
import { env } from "../env";

// ---------- Panel setup tool ----------

const PANEL_SETUP_TOOL = {
  name: "emit_setup",
  description:
    "Emit the episode setup: topic context, three cast members (with voice picks), welcome message.",
  input_schema: {
    type: "object",
    properties: {
      topicContext: {
        type: "string",
        description:
          "A short (1-2 sentence) description of the requested topic, framing what the conversation will cover.",
      },
      panelists: {
        type: "array",
        description:
          "Exactly three cast members — one moderator, two panelists. Sharply distinct. Randomize names and ethnic origins across runs.",
        items: {
          type: "object",
          properties: {
            role: {
              type: "string",
              enum: ["moderator", "panelist_1", "panelist_2"],
            },
            name: { type: "string" },
            gender: { type: "string", enum: ["male", "female", "neutral"] },
            ethnicity: { type: "string" },
            bio: {
              type: "string",
              description:
                "A two-to-three-second spoken bio (~7-10 words). Used when the moderator introduces the cast.",
            },
            persona: {
              type: "string",
              description:
                "A dramatic 4-6 sentence character description covering background, personality, speaking style, signature quirk, and what makes them electric on a panel.",
            },
            voice_id: {
              type: "string",
              description:
                "Best-fit voice id from the catalog. Priority: (1) gender MUST match; (2) origin should match ethnicity as closely as possible; (3) no two cast members may share a voice.",
            },
          },
          required: ["role", "name", "gender", "ethnicity", "bio", "persona", "voice_id"],
        },
      },
      welcomeText: {
        type: "string",
        description:
          "A ~30 second (~75 words) spoken welcome message from the moderator. Frame the topic with real context (2-3 sentences), then briefly tease each of the two panelists by name with a one-line hint at the angle they'll bring. First-person moderator voice.",
      },
    },
    required: ["topicContext", "panelists", "welcomeText"],
  },
} as const;

// ---------- Solo setup tool (newscast + story) ----------

const SOLO_SETUP_TOOL = {
  name: "emit_setup",
  description:
    "Emit the episode setup: topic context, a single host, welcome message.",
  input_schema: {
    type: "object",
    properties: {
      topicContext: { type: "string" },
      panelists: {
        type: "array",
        description: "Exactly ONE host (the narrator or anchor).",
        items: {
          type: "object",
          properties: {
            role: { type: "string", enum: ["moderator"] },
            name: { type: "string" },
            gender: { type: "string", enum: ["male", "female", "neutral"] },
            ethnicity: { type: "string" },
            bio: {
              type: "string",
              description: "A short spoken bio.",
            },
            persona: {
              type: "string",
              description:
                "4-6 sentences describing the host's voice, background, and style.",
            },
            voice_id: { type: "string" },
          },
          required: ["role", "name", "gender", "ethnicity", "bio", "persona", "voice_id"],
        },
      },
      welcomeText: {
        type: "string",
        description:
          "A ~30 second (~75 words) spoken opening in the host's own first-person voice. Frame the topic with real context (3-4 sentences — what it is, why it matters, what the listener will get from this report).",
      },
    },
    required: ["topicContext", "panelists", "welcomeText"],
  },
} as const;

// ---------- Full-newscast tool (single-call solo generation) ----------

const FULL_NEWSCAST_TOOL = {
  name: "emit_newscast",
  description:
    "Emit the full newscast episode in one response: anchor setup, welcome message, and every scene's transcript.",
  input_schema: {
    type: "object",
    properties: {
      topicContext: { type: "string" },
      anchor: {
        type: "object",
        properties: {
          name: { type: "string" },
          gender: {
            type: "string",
            enum: ["male", "female", "neutral"],
          },
          ethnicity: { type: "string" },
          bio: { type: "string" },
          persona: { type: "string" },
          voice_id: {
            type: "string",
            description:
              "Best-fit voice id from the catalog. Must match the anchor's gender.",
          },
        },
        required: ["name", "gender", "ethnicity", "bio", "persona", "voice_id"],
      },
      welcomeText: {
        type: "string",
        description:
          "The host's opening words right after the station intro and first ads. ~75 words. Frame the topic with real context (3-4 sentences — what it is, why it matters right now, what the listener will get from this report). Do NOT re-greet with 'welcome to flipcast'. End with the verbatim line: \"We'll be right with you after this ad.\"",
      },
      scenes: {
        type: "array",
        description:
          "One entry per scene, in order. Each scene opens with 'And we're back.' or 'Welcome back.' and dives into that scene's beat.",
        items: {
          type: "object",
          properties: {
            sceneIndex: { type: "number" },
            turns: {
              type: "array",
              description:
                "A handful of monologue segments for this scene; the host breaks the content into turns to allow for natural pauses. Each turn uses the anchor as speaker.",
              items: {
                type: "object",
                properties: {
                  sequence: { type: "number" },
                  text: { type: "string" },
                  pauseMsAfter: { type: "number" },
                },
                required: ["sequence", "text"],
              },
            },
          },
          required: ["sceneIndex", "turns"],
        },
      },
    },
    required: ["topicContext", "anchor", "welcomeText", "scenes"],
  },
} as const;

const fullNewscastPayloadSchema = z.object({
  topicContext: z.string().min(1),
  anchor: z.object({
    name: z.string().min(1),
    gender: z.enum(["male", "female", "neutral"]),
    ethnicity: z.string().min(1),
    bio: z.string().min(1),
    persona: z.string().min(1),
    voice_id: z.string().min(1),
  }),
  welcomeText: z.string().min(1),
  scenes: z
    .array(
      z.object({
        sceneIndex: z.number().int().min(1),
        turns: z
          .array(
            z.object({
              sequence: z.number().int().nonnegative().optional(),
              text: z.string().min(1),
              pauseMsAfter: z.number().int().nonnegative().optional(),
            }),
          )
          .min(1),
      }),
    )
    .min(2),
});

// ---------- Scene tool ----------

const SCENE_TOOL = {
  name: "emit_scene",
  description: "Emit the dialogue turns for a single scene.",
  input_schema: {
    type: "object",
    properties: {
      turns: {
        type: "array",
        items: {
          type: "object",
          properties: {
            sequence: { type: "number" },
            speaker: {
              type: "string",
              enum: ["moderator", "panelist_1", "panelist_2"],
            },
            text: { type: "string" },
            pauseMsAfter: { type: "number" },
          },
          required: ["sequence", "speaker", "text"],
        },
      },
    },
    required: ["turns"],
  },
} as const;

// ---------- Zod payload schemas ----------

const panelistSchema = z.object({
  role: z.enum(["moderator", "panelist_1", "panelist_2"]),
  name: z.string().min(1),
  gender: z.enum(["male", "female", "neutral"]),
  ethnicity: z.string().min(1),
  bio: z.string().min(1),
  persona: z.string().min(1),
  voice_id: z.string().min(1),
});

const setupPayloadSchema = z.object({
  topicContext: z.string().min(1),
  panelists: z.array(panelistSchema).min(1).max(3),
  welcomeText: z.string().min(1),
});

const scenePayloadSchema = z.object({
  turns: z.array(transcriptTurnSchema.omit({ isAd: true })).min(1),
});

// ---------- Helpers ----------

function client(): Anthropic {
  if (!env.anthropicApiKey) throw new Error("ANTHROPIC_API_KEY not set");
  return new Anthropic({ apiKey: env.anthropicApiKey });
}

function formatCatalog(pool: VoiceOption[]): string {
  return pool
    .map(
      (v) =>
        `  - id: ${v.id} | gender: ${v.gender} | origin: ${v.origin} | label: ${v.label}`,
    )
    .join("\n");
}

function pickFallbackVoice(
  gender: string,
  usedIds: Set<string>,
  pool: VoiceOption[],
): VoiceOption {
  const candidates = pool.filter(
    (v) => v.gender === gender && !usedIds.has(v.id),
  );
  if (candidates.length > 0) {
    return candidates[Math.floor(Math.random() * candidates.length)]!;
  }
  const anyUnused = pool.filter((v) => !usedIds.has(v.id));
  if (anyUnused.length > 0) {
    return anyUnused[Math.floor(Math.random() * anyUnused.length)]!;
  }
  return pool[Math.floor(Math.random() * pool.length)]!;
}

function formatBlurb(format: FlipcastFormat): string {
  switch (format) {
    case "panel":
      return "a three-person panel discussion — one moderator and two distinct panelists who interact with each other";
    case "pals":
      return "a two-host show — two co-equal hosts with chemistry, riffing as friends rather than interviewer/guest";
    case "newscast":
      return "a newscast — one authoritative anchor delivering a crisp, informative report, no panel interaction";
  }
}

// ---------- Pre-generation classifier ----------

const CLASSIFIER_TOOL = {
  name: "emit_episode_metadata",
  description:
    "Emit the v1 metadata fields that drive downstream prompt branching for this episode.",
  input_schema: {
    type: "object",
    properties: {
      time_context: { type: "string", enum: TIME_CONTEXTS },
      topic_domain: { type: "string", enum: TOPIC_DOMAINS },
      user_intent: { type: "string", enum: USER_INTENTS },
      tone_profile: { type: "string", enum: TONE_PROFILES },
      freshness_requirement: { type: "string", enum: FRESHNESS_LEVELS },
      fact_sensitivity: { type: "string", enum: FACT_SENSITIVITY_LEVELS },
      // Required only when format has multiple speakers; classifier should
      // omit (or pass null) for monologues.
      speaker_pattern: {
        type: ["string", "null"],
        enum: [...SPEAKER_PATTERNS, null],
      },
    },
    required: [
      "time_context",
      "topic_domain",
      "user_intent",
      "tone_profile",
      "freshness_requirement",
      "fact_sensitivity",
    ],
  },
} as const;

const classifierPayloadSchema = z.object({
  time_context: z.enum(TIME_CONTEXTS),
  topic_domain: z.enum(TOPIC_DOMAINS),
  user_intent: z.enum(USER_INTENTS),
  tone_profile: z.enum(TONE_PROFILES),
  freshness_requirement: z.enum(FRESHNESS_LEVELS),
  fact_sensitivity: z.enum(FACT_SENSITIVITY_LEVELS),
  speaker_pattern: z.enum(SPEAKER_PATTERNS).nullish(),
});

// Reasonable defaults when the API key is missing or the classifier fails.
// Better to ship the episode with conservative metadata than to fail the run.
function defaultMetadata(format: FlipcastFormat): EpisodeMetadata {
  const format_type = formatTypeForFlipcastFormat(format);
  return {
    time_context: "current",
    topic_domain: "general_question",
    user_intent: "explain",
    format_type,
    tone_profile: "conversational",
    freshness_requirement: "medium",
    fact_sensitivity: "medium",
    speaker_pattern:
      format_type === "monologue_1p" ? undefined : "balanced_panel",
  };
}

export async function classifyEpisode(args: {
  topic: string;
  format: FlipcastFormat;
  locale?: ContentLocale;
}): Promise<EpisodeMetadata & { model: string; usage: ClaudeCallUsage }> {
  const formatType = formatTypeForFlipcastFormat(args.format);
  if (!env.anthropicApiKey) {
    return {
      ...defaultMetadata(args.format),
      model: CLASSIFIER_MODEL,
      usage: ZERO_USAGE,
    };
  }

  const isMulti = formatType !== "monologue_1p";
  const today = todayBlurb(localeFor(args.locale));

  const system = [
    "You classify a podcast topic into a small metadata object that controls downstream prompt branching.",
    `Today is ${today.long}.`,
    "",
    "Field guidance:",
    "  • time_context — 'current' if the topic is dynamic and the user did not specify a time frame; 'recent_recap' if the user explicitly asked for a look back at a recent period; 'historical' if the user named a past era; 'timeless' for evergreen ideas/concepts. DEFAULT TO 'current' for any time-sensitive topic without an explicit time frame.",
    "  • topic_domain — pick the closest single primary domain.",
    "  • user_intent — what the listener expects this script TO DO. 'explain' (clarify a concept), 'analyze' (interpret + tradeoffs), 'inform' (report what's happening), 'debate' (argue), 'answer' (direct response to a question), 'react' (commentary on something specific), 'entertain' (story/show), 'riff' (loose, conversational), 'speculate' (reasoned guesses about the future).",
    "  • tone_profile — single primary tone. Match what the topic genuinely calls for, not what sounds prestigious.",
    "  • freshness_requirement — 'high' for news, politics, business, markets, AI, sports, public figures, trend-driven topics; 'medium' for culture/society where current framing helps but precision is less critical; 'low' for timeless/silly/evergreen.",
    "  • fact_sensitivity — 'high' for anything where incorrect timing or fake specifics undermine trust; 'medium' for analysis that mixes opinion + reporting; 'low' for playful or mostly creative content.",
    isMulti
      ? "  • speaker_pattern — pick the cast dynamic. 'host_analyst' (host + steady analyst), 'host_skeptic' (host + pushback), 'host_comedian' (host + comic foil), 'host_analyst_skeptic' (host + analyst + skeptic — typical for substantive panels), 'host_comedian_analyst' (host + comic + analyst — for cultural topics), 'balanced_panel' (three roughly equal panelists)."
      : "  • speaker_pattern — this is a single-host format; pass null.",
    "",
    "Be decisive. Pick the single best value for each field. Do NOT over-explain.",
    "Emit strictly via the `emit_episode_metadata` tool.",
  ].join("\n");

  const userMsg = [
    `Topic: ${args.topic}`,
    `Format (already chosen by user): ${args.format} (${formatType})`,
    `Output language: English`,
  ].join("\n");

  const response = await client().messages.create({
    model: CLASSIFIER_MODEL,
    max_tokens: 256,
    system,
    tools: [CLASSIFIER_TOOL],
    tool_choice: { type: "tool", name: "emit_episode_metadata" },
    messages: [{ role: "user", content: userMsg }],
  });
  const usage = extractUsage(response);

  const block = response.content.find(
    (b) => b.type === "tool_use" && b.name === "emit_episode_metadata",
  );
  if (!block || block.type !== "tool_use") {
    // Don't fail the run; fall back to defaults.
    return {
      ...defaultMetadata(args.format),
      model: CLASSIFIER_MODEL,
      usage,
    };
  }

  const parsed = classifierPayloadSchema.safeParse(block.input);
  if (!parsed.success) {
    return {
      ...defaultMetadata(args.format),
      model: CLASSIFIER_MODEL,
      usage,
    };
  }

  return {
    time_context: parsed.data.time_context,
    topic_domain: parsed.data.topic_domain,
    user_intent: parsed.data.user_intent,
    format_type: formatType,
    tone_profile: parsed.data.tone_profile,
    freshness_requirement: parsed.data.freshness_requirement,
    fact_sensitivity: parsed.data.fact_sensitivity,
    speaker_pattern: isMulti
      ? (parsed.data.speaker_pattern ?? "balanced_panel")
      : undefined,
    model: CLASSIFIER_MODEL,
    usage,
  };
}

// Translates the metadata object into a prompt directive that gets injected
// into every downstream system prompt. Each line states the chosen value AND
// the rule it implies — this is where classification becomes generation
// behavior, not just a label.
function timeContextRule(tc: TimeContext): string {
  switch (tc) {
    case "current":
      return "current — listener expects PRESENT-DAY relevance. Establish what is true now BEFORE adding any background. Older events/data are background only and must be labeled as such; do not present them as the basis of the script.";
    case "recent_recap":
      return "recent_recap — explicit look back at a recent period. Anchor the recap in its time frame, then synthesize what changed.";
    case "historical":
      return "historical — make the time frame explicit early. Anchor the discussion in the relevant year/era. Do NOT frame events as if unfolding now unless the user asked for the modern parallel.";
    case "timeless":
      return "timeless — avoid forced current-events framing. Prioritize conceptual clarity, durable insight, and relatability.";
  }
}

function userIntentRule(intent: UserIntent): string {
  switch (intent) {
    case "inform":
      return "inform — report what is happening; lead with what's new, follow with why it matters.";
    case "explain":
      return "explain — clarify a concept; build understanding step by step with concrete examples.";
    case "analyze":
      return "analyze — go beyond reporting; surface mechanisms, tradeoffs, second-order effects, what-this-means-for-whom.";
    case "debate":
      return "debate — multiple positions in genuine tension. Don't stage agreement; let the disagreement breathe.";
    case "answer":
      return "answer — the topic is a question. Address it directly and early; don't bury the answer behind preamble.";
    case "react":
      return "react — commentary on a specific thing. The thing being reacted to should be clearly named upfront.";
    case "entertain":
      return "entertain — primary job is engagement; lean into voice, character, and momentum.";
    case "riff":
      return "riff — loose, conversational, observational. Premise-driven rather than thesis-driven.";
    case "speculate":
      return "speculate — reasoned guesses about the future. Distinguish 'likely' from 'wild card'; mark speculation explicitly so listeners can calibrate.";
  }
}

function toneRule(tone: ToneProfile): string {
  switch (tone) {
    case "serious":
      return "serious — sober register; weight the subject without theatrical solemnity.";
    case "conversational":
      return "conversational — like talking to a smart friend; clean and natural, not formal.";
    case "analytical":
      return "analytical — emphasize definitions, distinctions, mechanisms, tradeoffs. Reduce hype language. Favor clarity over theatrics.";
    case "warm":
      return "warm — personable and inviting; the audience feels welcomed in.";
    case "witty":
      return "witty — sharp observations, callbacks, lighter phrasing. Keep grounded in the topic; do NOT slip back into formal explainer mode.";
    case "playful":
      return "playful — bright, spirited, free to make jokes. Stay grounded in the topic; do NOT default back to explainer mode.";
    case "provocative":
      return "provocative — willing to take a stance and defend it. Pointed, not reckless.";
    case "reflective":
      return "reflective — slower pace, room for ambiguity, the speaker is thinking out loud.";
    case "absurd":
      return "absurd — prioritize comic escalation, premise consistency, and surprise. Factual realism is secondary unless the user asked otherwise.";
  }
}

function freshnessRule(level: FreshnessRequirement): string {
  switch (level) {
    case "high":
      return "high — present-day framing is required; older context must be clearly labeled as background. A current LABEL is not enough — claims need a present-day mechanism, condition, or example to land as actually current.";
    case "medium":
      return "medium — current framing helps but precision is less critical. Older examples are fine if they illuminate the topic.";
    case "low":
      return "low — timing isn't load-bearing; pick the strongest illustration regardless of when it happened.";
  }
}

function factRule(level: FactSensitivity): string {
  switch (level) {
    case "high":
      return "high — avoid fake specificity, vague authority claims, and overstated certainty. Do NOT invent experts, institutions, numbers, court filings, or events for texture. If you don't have a real specific, restructure around the open question.";
    case "medium":
      return "medium — mixed reporting + opinion is fine; cite when you can, hedge when you can't, never fabricate plausible-sounding details.";
    case "low":
      return "low — optimize for voice, premise, rhythm, and entertainment. Factual exactness matters less than coherence and tone.";
  }
}

function speakerPatternRule(pattern: SpeakerPattern): string {
  switch (pattern) {
    case "host_analyst":
      return "host_analyst — host steers + asks questions; the analyst delivers structured analysis. Different cognitive shapes: host's role is curiosity-driven, analyst's role is framework-driven.";
    case "host_skeptic":
      return "host_skeptic — host frames; the skeptic pushes back, names assumptions, asks 'wait, is that actually true?'. The pushback is conversational, not combative.";
    case "host_comedian":
      return "host_comedian — host steers; the comic foil reacts, undercuts, finds the absurd angle. Lighter rhythm, faster reactions, more interruptions.";
    case "host_analyst_skeptic":
      return "host_analyst_skeptic — host steers + synthesizes; analyst delivers the structural take; skeptic pushes back. Three different cognitive shapes (curious / framework / contrarian) — they should not all sound like polished mini-essays in the same register.";
    case "host_comedian_analyst":
      return "host_comedian_analyst — host steers; analyst grounds the conversation; comic foil keeps it light. Different rhythms: analyst longer turns, comic shorter punches, host moderate.";
    case "balanced_panel":
      return "balanced_panel — three roughly co-equal voices. Assign each a distinct cognitive style (structural / anecdotal / tactical / contrarian — pick three) so they sound materially different, not just tonally different.";
  }
}

// Topic-native style fingerprint. Different domains have different idiom,
// different rhythm, different reach. The classifier picks the domain; this
// function turns that into actual writing direction so the show stops
// sounding like the same generic narrator wearing each topic's vocabulary.
function topicNativeStyle(domain: TopicDomain): string {
  switch (domain) {
    case "news_current_events":
      return "Sound like reporting + analysis: short factual sentences anchoring the story, then interpretation. Names, dates, places carry weight. Avoid op-ed flourish; let the facts do the work.";
    case "business_finance":
      return "Sound like a business desk: deal mechanics, cap-table thinking, market structure, incentive analysis. People who run companies talking shop. Specific firms / specific deals / specific numbers when known. Avoid management-consultant vocabulary ('synergies', 'value creation', 'paradigm shift').";
    case "technology_ai":
      return "Sound like people who build or cover the technology: distinctions matter, mechanisms matter, capability claims need grounding. Avoid hype vocabulary ('game-changing', 'revolutionary', 'transforms everything') and avoid corporate-deck language ('unlocks', 'enables', 'empowers').";
    case "culture_society":
      return "Sound like a smart, curious person noticing something. Anecdotes, observations, personal angle. Skip academic framing; this is friends pulling on a thread. Don't reach for theory when an example will do.";
    case "lifestyle_fashion":
      return "Sound personal and observational. Specific scenes, specific people, specific things (brand names, items, places). Skip 'lifestyle journalism' voice — this is closer to a conversation than a magazine piece.";
    case "sports":
      return "Sound like sports talk. Specific games, specific players, specific moments, specific stats. Strong opinions delivered fast. Don't drift into corporate-PR sports language.";
    case "science_health":
      return "Sound like an explainer that respects the listener. Mechanisms, evidence quality, what's known vs. what's still open. Cite real researchers/journals when you genuinely know them; otherwise describe the work without inventing names. Avoid 'studies show' floating without a study.";
    case "entertainment_media":
      return "Sound like someone who actually consumes this stuff. Specific shows, specific moments, specific creative choices. Cultural references land naturally rather than being explained.";
    case "general_question":
      return "Sound conversational and curious — closer to a friend thinking out loud than a host delivering material. Keep specifics personal where possible.";
    case "humor_absurdity":
      return "Sound funny on purpose. Premise, escalation, callback. Comic logic > factual rigor. Land the bit; don't explain the bit.";
  }
}

// Strict analytical mode — fires when the topic is high-stakes (current,
// fact-sensitive, fresh) AND the intent is to actually inform/analyze. This
// is where the model's biggest failure mode lives: confident-sounding
// summary sentences that aren't grounded fast enough. Strict mode
// explicitly suppresses sloganization.
function shouldUseStrictAnalyticalMode(meta: EpisodeMetadata): boolean {
  const heavyDomain =
    meta.topic_domain === "news_current_events" ||
    meta.topic_domain === "business_finance" ||
    meta.topic_domain === "technology_ai" ||
    meta.topic_domain === "science_health";
  const heavyIntent =
    meta.user_intent === "analyze" ||
    meta.user_intent === "explain" ||
    meta.user_intent === "inform" ||
    meta.user_intent === "debate";
  const stakes =
    meta.freshness_requirement === "high" ||
    meta.fact_sensitivity === "high";
  return heavyDomain && heavyIntent && stakes;
}

const STRICT_ANALYTICAL_MODE = [
  "",
  "— STRICT ANALYTICAL MODE (this episode is current + fact-sensitive + analytical) —",
  "Default-mode polish is the failure mode here. Tighten everything:",
  "  • NO SLOGAN SUMMARIES. Ban the 'X is being squeezed from both ends' / 'the rules of the game have changed' / 'a quiet revolution is underway' / 'the goalposts have moved' style of sentence. They sound smart but they aren't analysis — they're framing posing as analysis.",
  "  • Prefer GROUNDED DISTINCTIONS over polished rhetoric. 'Late-stage rounds at $1B+ are pricing flat to down; seed is still hot' is a real distinction. 'The market is bifurcating' is empty.",
  "  • Calibrated certainty. 'We're seeing X', 'most operators are reporting Y', 'the data we have suggests Z' beats flat assertion. Save full confidence for things you can actually back.",
  "  • No vague authority language: avoid 'experts say', 'analysts agree', 'sources tell us', 'the data shows' without naming the source. If you can't name it, restructure.",
  "  • Don't sound MORE current than you actually are. If your freshest verifiable detail is months old, frame it that way; don't dress it up as breaking.",
  "  • Every broad claim must be cashed within ONE sentence by an example, mechanism, or implication (CRAFT rule). In strict mode this is enforced — don't let any framing claim float.",
  "  • Resist compressing complexity. A real analytical episode names two or three competing readings rather than one tidy thesis.",
  "  • SPEAKER-CONTRAST GUARD — strict-analytical mode does NOT mean every speaker sounds the same. The 'be grounded and calibrated' bar applies to all speakers, but each speaker still owes a distinct cognitive STYLE under that bar. The analyst leads with mechanisms and structures the question. The skeptic punctures premises with specific counter-cases ('but what about the seed funds that just pulled in $400M — does that not break your thesis?'). The host steers + asks the pointed follow-up. If two speakers are both leading with mechanisms and numbers, you've lost the contrast — rewrite so the skeptic actually pushes back rather than co-analyzing.",
].join("\n");

// Loose riff mode — opposite end of the dial. Cultural / playful / vibes
// topics shouldn't be forced through analytical scaffolding.
function shouldUseLooseRiffMode(meta: EpisodeMetadata): boolean {
  const lightDomain =
    meta.topic_domain === "culture_society" ||
    meta.topic_domain === "lifestyle_fashion" ||
    meta.topic_domain === "humor_absurdity" ||
    meta.topic_domain === "entertainment_media";
  const lightTone =
    meta.tone_profile === "playful" ||
    meta.tone_profile === "witty" ||
    meta.tone_profile === "absurd" ||
    meta.tone_profile === "conversational";
  const lightIntent =
    meta.user_intent === "riff" ||
    meta.user_intent === "entertain" ||
    meta.user_intent === "react" ||
    meta.user_intent === "speculate";
  return lightDomain && (lightTone || lightIntent);
}

const LOOSE_RIFF_MODE = [
  "",
  "— LOOSE RIFF MODE (this episode is a cultural / playful / vibes piece) —",
  "Drop the explainer scaffolding. Specifically:",
  "  • No thesis-and-support architecture. The conversation is allowed to wander, double back, and never resolve. That's the form.",
  "  • Personal observation > expert framing. 'You know how everyone has started doing X?' beats 'a recent shift in consumer behavior shows X'.",
  "  • Permission to be funny. Jokes, tangents, callbacks, mild absurdity. Don't perform seriousness this topic doesn't warrant.",
  "  • Skip the 'this matters because…' move. Sometimes the topic is just interesting and that's enough.",
  "  • Sentence rhythm should be loose: contractions, fragments, half-finished thoughts. Avoid the well-formed declarative paragraph.",
  "  • The closing doesn't need a tidy insight. A laugh, an open question, a 'hm', or a sharp specific is a fine landing.",
].join("\n");

// Practical / advice mode — fires for "what should I do about X" type
// episodes. Different shape from analytical (mechanism-first) and from riff
// (vibes-first); these episodes need decision pressure or common mistake
// up front, then concrete moves the listener can take.
function shouldUsePracticalAdviceMode(meta: EpisodeMetadata): boolean {
  // Don't compete with strict-analytical or loose-riff — let those fire if
  // they match. This mode is for the in-between: an explain/answer intent
  // on a topic where the listener is asking for guidance.
  if (shouldUseStrictAnalyticalMode(meta)) return false;
  if (shouldUseLooseRiffMode(meta)) return false;
  const helpfulIntent =
    meta.user_intent === "explain" ||
    meta.user_intent === "answer" ||
    meta.user_intent === "inform";
  const helpfulDomain =
    meta.topic_domain === "general_question" ||
    meta.topic_domain === "lifestyle_fashion" ||
    meta.topic_domain === "science_health" ||
    meta.topic_domain === "business_finance";
  return helpfulIntent && helpfulDomain;
}

const PRACTICAL_ADVICE_MODE = [
  "",
  "— PRACTICAL / ADVICE MODE (this episode is helping the listener decide or do something) —",
  "Different shape from both analytical and riff:",
  "  • Open with DECISION PRESSURE or a common mistake — not with framing. 'The first thing most people get wrong about X is Y' beats 'X is an interesting topic that…'",
  "  • Concrete moves > abstract principles. Every section should leave the listener with one thing they could actually do, try, ask, watch for, or avoid.",
  "  • Real examples > hypothetical ones. 'A friend of mine was paying $400/mo for storage they never used' beats 'imagine someone who…'",
  "  • Honest about what the listener should NOT do. Practical episodes earn trust by warning off the wrong moves, not just championing the right ones.",
  "  • Keep the rhetoric quiet. This is a friend explaining over coffee, not a TED talk.",
].join("\n");

// Welcome-register alignment — the welcome's opening should match the topic
// title's register. A chatty/social title should not open with mechanism
// analysis; an analytical title should not open with personal anecdote;
// a question should not bury the answer behind preamble. This is the
// title-to-script alignment rule.
function welcomeRegisterRule(meta?: EpisodeMetadata): string {
  if (!meta) {
    return "Open with whatever fits the topic — recognition, mechanism, or question. Don't default to atmospheric setup.";
  }
  const intent = meta.user_intent;
  const tone = meta.tone_profile;
  const domain = meta.topic_domain;
  // Ordered checks: most specific first.
  if (intent === "answer") {
    return "The topic IS a question. Open by addressing the question directly — name the question, then start answering. Do NOT bury the answer behind 2-3 sentences of context.";
  }
  if (intent === "riff" || tone === "playful" || tone === "absurd" || tone === "witty" || domain === "humor_absurdity") {
    return "Open with RECOGNITION + lived texture — a 'you know how everyone has started doing X?' or 'I noticed something this week —' or a quick observation. Personality first; framing later (if at all). Do not open with 'today we're discussing' or any thesis-style opener.";
  }
  if (
    intent === "analyze" ||
    intent === "debate" ||
    tone === "analytical" ||
    domain === "news_current_events" ||
    domain === "business_finance" ||
    domain === "technology_ai" ||
    domain === "science_health"
  ) {
    return "Open with a MECHANISM, a contradiction, or a specific recent moment — not with a topic-introduction sentence. 'Three months ago [specific thing happened]; here's what nobody is saying about why' beats 'today we're going to look at X'.";
  }
  if (
    shouldUsePracticalAdviceMode(meta) ||
    intent === "explain"
  ) {
    return "Open with DECISION PRESSURE or a common mistake — 'most people [do the wrong thing here] / [misunderstand this part]' — then start unpacking. Don't open with 'today we're going to explain X'.";
  }
  return "Open with whatever fits the topic — recognition, mechanism, or question. Don't default to atmospheric setup or 'today we're discussing X'.";
}

// Whether the final-scene like/share CTA should fire. The CTA is one of the
// loudest template tells in the system; when the episode register is silly /
// playful / absurd, forcing it makes the show feel like a corporate read
// stitched onto a riff. Metadata-aware gate keeps it for serious-register
// shows where it lands naturally and skips it elsewhere.
function shouldIncludeCta(meta?: EpisodeMetadata): boolean {
  if (!meta) return true;
  if (meta.tone_profile === "absurd") return false;
  if (meta.topic_domain === "humor_absurdity") return false;
  if (
    (meta.tone_profile === "playful" || meta.tone_profile === "witty") &&
    (meta.user_intent === "riff" ||
      meta.user_intent === "entertain" ||
      meta.user_intent === "react")
  ) {
    return false;
  }
  return true;
}

function metadataDirective(meta: EpisodeMetadata): string {
  const lines: string[] = [
    "",
    "— EPISODE METADATA (from pre-generation classifier; treat as authoritative for THIS episode) —",
    `Time context: ${timeContextRule(meta.time_context)}`,
    `Topic domain: ${meta.topic_domain}.`,
    `Topic-native style: ${topicNativeStyle(meta.topic_domain)}`,
    `User intent: ${userIntentRule(meta.user_intent)}`,
    `Format type: ${meta.format_type}.`,
    `Tone profile: ${toneRule(meta.tone_profile)}`,
    `Freshness requirement: ${freshnessRule(meta.freshness_requirement)}`,
    `Fact sensitivity: ${factRule(meta.fact_sensitivity)}`,
  ];
  if (meta.speaker_pattern) {
    lines.push(`Speaker pattern: ${speakerPatternRule(meta.speaker_pattern)}`);
  }

  // Mode blocks — fire when metadata combinations indicate a particular
  // register. Mutually exclusive: at most one mode fires per episode. They
  // sit on top of the per-field rules so a strict-analytical panel scene
  // gets the strict block AND every per-field rule above it.
  if (shouldUseStrictAnalyticalMode(meta)) {
    lines.push(STRICT_ANALYTICAL_MODE);
  } else if (shouldUseLooseRiffMode(meta)) {
    lines.push(LOOSE_RIFF_MODE);
  } else if (shouldUsePracticalAdviceMode(meta)) {
    lines.push(PRACTICAL_ADVICE_MODE);
  }

  lines.push(
    "",
    "These fields specialize the general rules below for THIS episode. Read the general rules through this lens — when a general rule and the metadata pull in different directions, the metadata wins.",
  );
  return lines.join("\n");
}

// ---------- Post-generation validator ----------

const VALIDATOR_TOOL = {
  name: "emit_episode_validation",
  description:
    "Emit a quality-check report on the generated episode. Seven categories, each with a severity (none/minor/major) and a one-line note when severity is not none.",
  input_schema: {
    type: "object",
    properties: {
      stale_timing: {
        type: "object",
        description:
          "Older facts/years/narratives presented as the current state of a topic that should be current.",
        properties: {
          severity: { type: "string", enum: VALIDATION_SEVERITIES },
          note: { type: "string" },
        },
        required: ["severity"],
      },
      missing_subject_naming: {
        type: "object",
        description:
          "The central subject (person, company, event, question) is not clearly named in the welcome or opening minute.",
        properties: {
          severity: { type: "string", enum: VALIDATION_SEVERITIES },
          note: { type: "string" },
        },
        required: ["severity"],
      },
      generic_filler: {
        type: "object",
        description:
          "Two failure modes folded together: (a) canned podcast PHRASES overused — 'and we're back', 'stay with us', 'what we're watching', 'this moment could reshape', 'deserves your attention', 'in today's episode', 'buckle up', 'let's dive in', 'sit tight', 'we're cracking it open', 'hold that thought', 'quick break', 'if this made you think', 'share it with one person', 'hit like'. (b) Structural TEMPLATE reuse — predictable scene shape across every scene (confident opener → tidy thesis → tension phrase → break tease → tidy closing insight → like/share outro). Same shape episode-to-episode is itself a tell. Weight both.",
        properties: {
          severity: { type: "string", enum: VALIDATION_SEVERITIES },
          note: { type: "string" },
        },
        required: ["severity"],
      },
      interchangeable_speakers: {
        type: "object",
        description:
          "In a multi-speaker format, the speakers sound like the same person — same sentence shapes, same hedging, same cognitive style. No real differentiation. (For monologue formats, set severity to 'none'.)",
        properties: {
          severity: { type: "string", enum: VALIDATION_SEVERITIES },
          note: { type: "string" },
        },
        required: ["severity"],
      },
      overconfident_claims: {
        type: "object",
        description:
          "Confident assertions of facts the script can't actually back up — invented experts, fake numbers, manufactured quotes, pseudo-precise dates that read as fabricated. Match certainty to evidence.",
        properties: {
          severity: { type: "string", enum: VALIDATION_SEVERITIES },
          note: { type: "string" },
        },
        required: ["severity"],
      },
      title_script_mismatch: {
        type: "object",
        description:
          "The episode's opening register doesn't match what the topic title promises. A chatty/social title that opens with mechanism analysis. An analytical title that opens with personal anecdote. A question-shaped title that buries the answer behind 2-3 sentences of preamble. A practical/advice title that opens with topic-introduction instead of decision pressure or a common mistake. Read the topic, then read the welcome + first scene's first 3 turns; flag if they're in different registers.",
        properties: {
          severity: { type: "string", enum: VALIDATION_SEVERITIES },
          note: { type: "string" },
        },
        required: ["severity"],
      },
      weak_early_payoff: {
        type: "object",
        description:
          "The first scene drifts in atmospheric setup or framing without landing a real payoff (specific, mechanism, example, sharp question, named person, recent moment) early. By the end of the first ~30 seconds of the first scene, the listener should have received at least one CONCRETE thing, not just framing about the topic. Flag if the opening minute is all setup with no payoff.",
        properties: {
          severity: { type: "string", enum: VALIDATION_SEVERITIES },
          note: { type: "string" },
        },
        required: ["severity"],
      },
    },
    required: [
      "stale_timing",
      "missing_subject_naming",
      "generic_filler",
      "interchangeable_speakers",
      "overconfident_claims",
      "title_script_mismatch",
      "weak_early_payoff",
    ],
  },
} as const;

const validationCheckSchema = z.object({
  severity: z.enum(VALIDATION_SEVERITIES),
  note: z.string().optional(),
});

const validatorPayloadSchema = z.object({
  stale_timing: validationCheckSchema,
  missing_subject_naming: validationCheckSchema,
  generic_filler: validationCheckSchema,
  interchangeable_speakers: validationCheckSchema,
  overconfident_claims: validationCheckSchema,
  title_script_mismatch: validationCheckSchema,
  weak_early_payoff: validationCheckSchema,
});

// Renders the assembled episode as a single markdown-ish blob the validator
// can read. Keeps it compact: the cast, the welcome, then each scene's turns.
function renderEpisodeForValidator(args: {
  topic: string;
  setup: EpisodeSetup;
  scenes: { sceneIndex: number; turns: TranscriptTurn[] }[];
}): string {
  const lines: string[] = [];
  lines.push(`# Topic: ${args.topic}`);
  lines.push("");
  lines.push("## Cast");
  for (const c of args.setup.panelists) {
    lines.push(
      `- ${c.role}: ${c.name} (${c.gender ?? "?"}${c.ethnicity ? `, ${c.ethnicity}` : ""}) — ${c.persona}`,
    );
  }
  lines.push("");
  lines.push("## Welcome");
  lines.push(args.setup.welcomeText);
  lines.push("");
  for (const s of args.scenes) {
    lines.push(`## Scene ${s.sceneIndex}`);
    for (const t of s.turns) {
      lines.push(`[${t.speaker}] ${t.text}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

export async function validateEpisode(args: {
  topic: string;
  setup: EpisodeSetup;
  scenes: { sceneIndex: number; turns: TranscriptTurn[] }[];
  metadata?: EpisodeMetadata;
  locale?: ContentLocale;
}): Promise<EpisodeValidation & { model: string; usage: ClaudeCallUsage }> {
  // Conservative no-op result used when the API key is missing. We never
  // want validation to block a successful run.
  const noop: EpisodeValidation = {
    stale_timing: { severity: "none" },
    missing_subject_naming: { severity: "none" },
    generic_filler: { severity: "none" },
    interchangeable_speakers: { severity: "none" },
    overconfident_claims: { severity: "none" },
    title_script_mismatch: { severity: "none" },
    weak_early_payoff: { severity: "none" },
  };
  if (!env.anthropicApiKey) {
    return { ...noop, model: VALIDATOR_MODEL, usage: ZERO_USAGE };
  }

  const isMulti =
    args.metadata?.format_type !== "monologue_1p" &&
    args.setup.panelists.length > 1;
  const today = todayBlurb(localeFor(args.locale));

  const system = [
    "You are a podcast quality reviewer. You read the generated episode below and emit a small report on seven recurring failure modes. Be calibrated — many episodes will be 'none' on most checks.",
    `Today is ${today.long}. Use this as the anchor for any timing-related judgments.`,
    "",
    "Severity guidance:",
    "  • none — the check is fine; the episode does not exhibit this failure.",
    "  • minor — present but mild, won't ruin the episode but worth noting.",
    "  • major — clearly damages the episode; would disappoint a careful listener.",
    "",
    "Per-check guidance:",
    "  • stale_timing — does the script present old facts (year-or-more-old events, prior-year statistics, narratives from a previous era) as the CURRENT state? Frame around what the listener would think 'now' means today. Mode hint: classifier said this episode's time_context is " + (args.metadata?.time_context ?? "unspecified") + ".",
    "  • missing_subject_naming — is the central subject (person, company, event, question being discussed) clearly named in the welcome or the first scene's opening minute? Vague atmospheric setup that delays the subject is a fail.",
    "  • generic_filler — two things: (1) canned phrases ('and we're back' as default scene opener, 'stay with us', 'what we're watching', 'this moment could reshape', 'deserves your attention', 'in today's episode', 'buckle up', 'let's dive in', 'sit tight', 'we're cracking it open', 'hold that thought', 'quick break', 'if this made you think', 'share it with one person', 'hit like'). One use = none. Multiple uses of the same phrase across scenes = minor or major. (2) STRUCTURAL TEMPLATE reuse — does the episode follow the predictable house chassis (confident opener → tidy thesis → tension line → break tease → tidy closing insight → like/share outro)? If every scene has the same shape, flag it: that's templating posing as variety.",
    isMulti
      ? "  • interchangeable_speakers — do the speakers sound like distinct people with different cognitive styles (one anecdotal, one structural, one tactical, etc.) or do they all deliver the same shape of polished thesis-driven turns with just different attitudes? Look at sentence length, hedging behavior, what they reach for first."
      : "  • interchangeable_speakers — this is a single-host format; set severity to 'none'.",
    "  • overconfident_claims — are there confidently asserted facts that look fabricated? Invented expert names, suspiciously precise numbers, quoted lines attributed to people the model is unlikely to actually know quoted, made-up filings or studies. Hedged or honest-uncertainty framing is FINE — only flag when the script is performing certainty it can't back up.",
    "  • title_script_mismatch — does the episode's opening register match what the topic title promises? Read the topic, then read the welcome + the first scene's first 3 turns. A chatty/social title that opens with mechanism analysis = mismatch. An analytical/news title that opens with personal anecdote = mismatch. A question-shaped title that buries the answer behind 2-3 sentences of preamble = mismatch. A practical/advice title that opens with topic-introduction instead of decision pressure or a common mistake = mismatch. Topic for THIS episode: " + JSON.stringify(args.topic) + ".",
    "  • weak_early_payoff — does the first scene land a CONCRETE thing (specific, mechanism, example, sharp question, named person, recent moment) within the first ~30 seconds? Or does it drift in atmospheric setup and framing without giving the listener anything specific? The opening minute should not be all setup with no payoff.",
    "",
    "Be precise in notes — when severity is minor or major, the note should point at the specific phrase or pattern that triggered it.",
    "Emit strictly via the `emit_episode_validation` tool.",
  ].join("\n");

  const userMsg = renderEpisodeForValidator(args);

  const response = await client().messages.create({
    model: VALIDATOR_MODEL,
    max_tokens: 1024,
    system,
    tools: [VALIDATOR_TOOL],
    tool_choice: { type: "tool", name: "emit_episode_validation" },
    messages: [{ role: "user", content: userMsg }],
  });
  const usage = extractUsage(response);

  const block = response.content.find(
    (b) => b.type === "tool_use" && b.name === "emit_episode_validation",
  );
  if (!block || block.type !== "tool_use") {
    return { ...noop, model: VALIDATOR_MODEL, usage };
  }
  const parsed = validatorPayloadSchema.safeParse(block.input);
  if (!parsed.success) {
    return { ...noop, model: VALIDATOR_MODEL, usage };
  }
  return { ...parsed.data, model: VALIDATOR_MODEL, usage };
}

// ---------- Public API ----------

export async function generateSetup(args: {
  topic: string;
  format: FlipcastFormat;
  engine: TtsEngine;
  outline: SceneOutline[];
  presetVoiceIds?: string[]; // if the user picked voices
  // Generated-content language. "es" switches system prompts + verbatim
  // lines to Spanish and biases cast + references toward U.S. Latino and
  // Latin American culture. Defaults to English.
  locale?: "en";
  // Pre-classified metadata for this episode. When provided, its directive
  // is injected at the top of the system prompt so format/tone/freshness
  // rules specialize the generic guidance for THIS episode.
  metadata?: EpisodeMetadata;
}): Promise<EpisodeSetup & { model: string; usage: ClaudeCallUsage }> {
  const cfg = formatConfig(args.format);
  const pool = voicesForEngine(args.engine);
  if (pool.length < cfg.castSize) {
    throw new Error(
      `Engine ${args.engine} has fewer voices than the cast size (${cfg.castSize}) for format ${args.format}.`,
    );
  }

  if (!env.anthropicApiKey) {
    return { ...stubSetup(args, pool), model: SETUP_MODEL, usage: ZERO_USAGE };
  }

  // Single-speaker formats use the solo tool. Multi-speaker formats (pals=2,
  // panel=3) share the panel tool — its panelists array accepts 1–3.
  const useSolo = cfg.castSize === 1;
  const isPals = cfg.castSize === 2;
  const toolDef = useSolo ? SOLO_SETUP_TOOL : PANEL_SETUP_TOOL;
  const roles = useSolo
    ? ["moderator"]
    : isPals
      ? ["moderator", "panelist_1"]
      : ["moderator", "panelist_1", "panelist_2"];

  let castInstructions: string;
  if (useSolo) {
    castInstructions =
      "Invent ONE news anchor — credible, authoritative, with a clear voice. Give them a plausible name, ethnicity, and short on-air bio.";
  } else if (isPals) {
    castInstructions = [
      "Invent TWO co-host characters with established chemistry — a duo who riff as equals (think a podcast pair, not interviewer/guest). They should have distinct backgrounds, temperaments, and rhythms but feel like longtime friends.",
      "Vary names and origins widely across runs. Traditional American names (Michael Davidson, Sarah Carter, David Thompson, Jennifer Walsh, Ryan Sullivan, Emily Roberts, etc.) are great and often the best fit — don't default to the same distinctive non-American names every time. AVOID repeat offenders like 'Dmitri Volkov', 'Amara Okafor', 'Priya Patel', and 'Maya Desai'. Pull from a fresh, wide pool each run.",
      "Use the role 'moderator' for the lead host (the one who opens the welcome) and 'panelist_1' for the co-host. Do NOT include a panelist_2.",
    ].join(" ");
  } else {
    castInstructions = [
      "Invent three vivid, dramatic characters: one moderator and two panelists, sharply distinct in background, temperament, and cadence.",
      "Vary names and origins widely across runs. Traditional American names (Michael Davidson, Sarah Carter, David Thompson, Jennifer Walsh, Ryan Sullivan, Emily Roberts, etc.) are great and often the best fit — don't default to the same distinctive non-American names every time. AVOID repeat offenders like 'Dmitri Volkov', 'Amara Okafor', 'Priya Patel', and 'Maya Desai' — the user has seen them too many times. Pull from a fresh, wide pool each run.",
    ].join(" ");
  }

  const voiceInstructions = args.presetVoiceIds && args.presetVoiceIds.length > 0
    ? [
        "The user has preselected voices. Assign them to roles in order:",
        ...args.presetVoiceIds.map((id, i) => `  - ${roles[i]} → ${id}`),
        "Use these exact voice_id values for the matching roles. The character's gender must match the voice's gender.",
      ].join("\n")
    : [
        "Assign a voice from the catalog to each character. Matching rules, in priority order:",
        "  1. voice.gender MUST equal the character's gender.",
        "  2. voice.origin should match the character's ethnicity as closely as possible; pick the closest-sounding option when no exact match exists.",
        "  3. No two cast members may share the same voice.",
      ].join("\n");

  const locale = localeFor(args.locale);
  const lg = LOCALE_GUIDANCE;
  const welcomeFinalLine = useSolo
    ? lg.welcomeFinal.solo
    : isPals
      ? lg.welcomeFinal.pals
      : lg.welcomeFinal.panel;

  const system = [
    `You are casting ${formatBlurb(args.format)} for flipcast.`,
    languagePreambleFor(locale),
    args.metadata ? metadataDirective(args.metadata) : "",
    temporalGuidance(locale, args.metadata?.time_context),
    PREDRAFT_PLANNING,
    castInstructions,
    "For each character, emit name, gender, a one- or two-word ethnic/accent descriptor, bio (~7-10 words, spoken out loud in the intro), and a 4-6 sentence theatrical persona.",
    `WELCOME REGISTER (title-to-script alignment): ${welcomeRegisterRule(args.metadata)}`,
    useSolo
      ? `The welcome is the host's first on-air moment, AFTER a branded station intro has already greeted the listener. Do NOT re-greet with any "welcome to flipcast" phrase. Jump straight in — apply the WELCOME REGISTER above to the very first sentence — then frame the topic with real context: 3-4 sentences. End with this EXACT line as the final sentence (verbatim, no paraphrasing): "${welcomeFinalLine}" First-person host voice, ~75 words total.`
      : isPals
        ? `The welcome is spoken by the LEAD host (the moderator role) only — single voice, AFTER a branded station intro has already greeted the listener. Do NOT re-greet with any "welcome to flipcast" phrase. Apply the WELCOME REGISTER above to the very first sentence. Then (a) frame the topic with real context: 2-3 sentences on what it is, why it matters, and what makes it compelling right now, and (b) briefly tease the co-host (panelist_1) by name with a one-line hint at the angle they'll bring. End the welcome with this EXACT line as the final sentence (verbatim, no paraphrasing): "${welcomeFinalLine}" First-person lead-host voice, ~75 words total.`
        : `The welcome is the moderator's first on-air moment, AFTER a branded station intro has already greeted the listener. Do NOT re-greet with any "welcome to flipcast" phrase. Apply the WELCOME REGISTER above to the very first sentence. Then (a) frame the topic with real context: 2-3 sentences on what it is, why it matters, and what makes it compelling right now, and (b) briefly tease each panelist by name with a one-line hint at the angle they'll bring. End the welcome with this EXACT line as the final sentence (verbatim, no paraphrasing): "${welcomeFinalLine}" First-person moderator voice, ~75 words total.`,
    voiceInstructions,
    "",
    `Voice catalog (engine: ${args.engine}):`,
    formatCatalog(pool),
    CRAFT_GUIDANCE,
    topicIntentGuidance(args.metadata?.topic_domain, args.metadata?.user_intent),
    FISH_TAG_GUIDANCE,
    "",
    "Emit strictly via the `emit_setup` tool.",
  ].join("\n");

  const response = await client().messages.create({
    model: SETUP_MODEL,
    max_tokens: 3072,
    system,
    tools: [toolDef],
    tool_choice: { type: "tool", name: "emit_setup" },
    messages: [{ role: "user", content: `Topic: ${args.topic}` }],
  });
  const usage = extractUsage(response);

  const block = response.content.find(
    (b) => b.type === "tool_use" && b.name === "emit_setup",
  );
  if (!block || block.type !== "tool_use") {
    throw new Error("emit_setup tool output missing from model response.");
  }
  const parsed = setupPayloadSchema.parse(block.input);

  // Validate + repair voice picks.
  const usedIds = new Set<string>();
  const panelists: Character[] = parsed.panelists.map((p, i) => {
    const forcedId = args.presetVoiceIds?.[i];
    let voice: VoiceOption | undefined;
    if (forcedId) {
      voice = VOICE_BY_ID.get(forcedId);
    } else {
      voice = VOICE_BY_ID.get(p.voice_id);
    }
    if (
      !voice ||
      !voice.engines.includes(args.engine) ||
      (!forcedId && voice.gender !== p.gender) ||
      usedIds.has(voice.id)
    ) {
      voice = pickFallbackVoice(p.gender, usedIds, pool);
    }
    usedIds.add(voice.id);
    return {
      role: p.role,
      name: p.name,
      gender: p.gender,
      ethnicity: p.ethnicity,
      bio: p.bio,
      persona: p.persona,
      voiceId: voice.id,
      voiceLabel: voice.label,
    };
  });

  return {
    topicContext: parsed.topicContext,
    panelists,
    welcomeText: parsed.welcomeText,
    outline: args.outline,
    model: SETUP_MODEL,
    usage,
  };
}

export async function generateFullNewscast(args: {
  topic: string;
  engine: TtsEngine;
  outline: SceneOutline[]; // sceneIndex + targetSeconds (focus left blank)
  presetVoiceIds?: string[]; // at most one voice id for solo format
  locale?: "en";
  // Pre-classified metadata; injected as the first directive after language.
  metadata?: EpisodeMetadata;
}): Promise<{
  setup: EpisodeSetup;
  scenes: { sceneIndex: number; turns: TranscriptTurn[] }[];
  model: string;
  usage: ClaudeCallUsage;
}> {
  const pool = voicesForEngine(args.engine);
  if (pool.length < 1) {
    throw new Error(`Engine ${args.engine} has no voices available.`);
  }

  if (!env.anthropicApiKey) {
    return {
      ...stubFullNewscast(args, pool),
      model: NEWSCAST_MODEL,
      usage: ZERO_USAGE,
    };
  }

  const locale = localeFor(args.locale);
  const lg = LOCALE_GUIDANCE;

  const includeCta = shouldIncludeCta(args.metadata);
  const ctaInstructionForFinal = includeCta
    ? "DEFAULT TO NO CTA. Most episodes should end without any like/share/subscribe ask — a clean sign-off lands better than a podcast-y CTA. Only include one if there's a GENUINELY natural beat for it that doesn't read as a CTA at all. The CTA must be invisible-as-CTA: woven into a thought the host was already having, not a tacked-on outro line. Forbidden phrasings (do not paraphrase around them either — the FORM is banned, not just the words): 'if this made you think', 'if this got you thinking', 'if this helped you', 'if you got something out of this', 'share it with one person', 'send this to someone', 'hit like'. If you can't include the CTA without falling into one of those shapes, leave it out."
    : "Do NOT include any like/share/subscribe ask — this register doesn't carry it.";
  const scenesBrief = args.outline
    .map((o) => {
      const isFinal = o.sceneIndex === args.outline.length;
      const targetWords = Math.round((o.targetSeconds / 60) * 150);
      return `  Scene ${o.sceneIndex} — ${o.targetSeconds}s (~${targetWords} words total). ${
        isFinal
          ? `FINAL scene: wrap-up with closing thoughts and a sign-off. Do NOT end with a 'we'll be right back' transition. ${ctaInstructionForFinal} The closing doesn't need a tidy thesis — a sharp specific or a question is also a fine landing.`
          : `Open with ${lg.backFromBreakOpeners} then deliver this beat. End with the moderator transitioning to an ad break (${lg.adBreakExample}). NEVER specify how long the break or show is — no 'back in an hour', 'back in thirty minutes', 'see you next week', or any other time reference. The break is a few seconds; do not imply otherwise.`
      }`;
    })
    .join("\n");

  const voiceInstruction = args.presetVoiceIds?.[0]
    ? `The user preselected voice id "${args.presetVoiceIds[0]}" for the anchor. Use it and match the anchor's gender to the voice.`
    : [
        "Pick one voice from the catalog below for the anchor. Rules:",
        "  1. voice.gender MUST equal the anchor's gender.",
        "  2. voice.origin should match the anchor's ethnicity as closely as possible.",
      ].join("\n");

  const system = [
    "You are producing a complete newscast episode of flipcast in a single response.",
    languagePreambleFor(locale),
    args.metadata ? metadataDirective(args.metadata) : "",
    temporalGuidance(locale, args.metadata?.time_context),
    PREDRAFT_PLANNING,
    "Invent ONE credible, authoritative anchor — plausible name, gender, ethnicity, short on-air bio, and a 4-6 sentence persona.",
    "Vary names widely across runs. Traditional American names (Michael Davidson, Sarah Carter, David Thompson, Jennifer Walsh, etc.) are great and often the best fit — avoid defaulting to the same distinctive non-American names. AVOID 'Dmitri Volkov', 'Amara Okafor', 'Priya Patel', 'Maya Desai'.",
    "",
    `WELCOME REGISTER (title-to-script alignment): ${welcomeRegisterRule(args.metadata)}`,
    `Write the welcome message (host's opening after the station intro + first ads) — ~75 words. Apply the WELCOME REGISTER above to the very first sentence; then frame the topic with real context (3-4 sentences). No re-greeting with any "welcome to flipcast" phrase. ${lg.soloWelcomeFinalInstruction}`,
    "",
    "Then write all scenes in order. Each scene is a monologue broken into a handful of `turns` (to allow natural pauses). Target durations:",
    scenesBrief,
    "",
    voiceInstruction,
    "",
    `Voice catalog (engine: ${args.engine}):`,
    formatCatalog(pool),
    CRAFT_GUIDANCE,
    topicIntentGuidance(args.metadata?.topic_domain, args.metadata?.user_intent),
    FISH_TAG_GUIDANCE,
    "",
    "Emit strictly via the `emit_newscast` tool.",
  ].join("\n");

  const response = await client().messages.create({
    model: NEWSCAST_MODEL,
    max_tokens: 6144,
    system,
    tools: [FULL_NEWSCAST_TOOL],
    tool_choice: { type: "tool", name: "emit_newscast" },
    messages: [{ role: "user", content: `Topic: ${args.topic}` }],
  });
  const usage = extractUsage(response);

  const block = response.content.find(
    (b) => b.type === "tool_use" && b.name === "emit_newscast",
  );
  if (!block || block.type !== "tool_use") {
    throw new Error("emit_newscast tool output missing from model response.");
  }
  const parsed = fullNewscastPayloadSchema.parse(block.input);

  // Resolve the anchor's voice (presetVoiceIds > Claude's pick > fallback).
  const usedIds = new Set<string>();
  const forcedId = args.presetVoiceIds?.[0];
  let voice = forcedId ? VOICE_BY_ID.get(forcedId) : VOICE_BY_ID.get(parsed.anchor.voice_id);
  if (
    !voice ||
    !voice.engines.includes(args.engine) ||
    (!forcedId && voice.gender !== parsed.anchor.gender)
  ) {
    voice = pickFallbackVoice(parsed.anchor.gender, usedIds, pool);
  }
  usedIds.add(voice.id);

  const anchor: Character = {
    role: "moderator",
    name: parsed.anchor.name,
    gender: parsed.anchor.gender,
    ethnicity: parsed.anchor.ethnicity,
    bio: parsed.anchor.bio,
    persona: parsed.anchor.persona,
    voiceId: voice.id,
    voiceLabel: voice.label,
  };

  const setup: EpisodeSetup = {
    topicContext: parsed.topicContext,
    panelists: [anchor],
    welcomeText: parsed.welcomeText,
    outline: args.outline,
  };

  const scenes = parsed.scenes
    .slice()
    .sort((a, b) => a.sceneIndex - b.sceneIndex)
    .map((s) => ({
      sceneIndex: s.sceneIndex,
      turns: s.turns.map((t, i) => ({
        sequence: typeof t.sequence === "number" ? t.sequence : i,
        speaker: "moderator" as const,
        text: t.text,
        pauseMsAfter:
          typeof t.pauseMsAfter === "number" ? t.pauseMsAfter : 150,
        isAd: false,
      })),
    }));

  return { setup, scenes, model: NEWSCAST_MODEL, usage };
}

export async function generateScene(args: {
  topic: string;
  setup: EpisodeSetup;
  sceneIndex: number;
  totalScenes: number;
  format: FlipcastFormat;
  locale?: "en";
  // Pre-classified metadata; injected into the cached stable prompt so the
  // metadata directive applies to every scene in this episode without
  // breaking the per-episode prompt cache.
  metadata?: EpisodeMetadata;
  priorScenesBrief?: string;
}): Promise<{ turns: TranscriptTurn[]; model: string; usage: ClaudeCallUsage }> {
  const sceneOutline = args.setup.outline.find(
    (o) => o.sceneIndex === args.sceneIndex,
  );
  if (!sceneOutline) {
    throw new Error(`No outline entry for scene ${args.sceneIndex}`);
  }
  const isFinal = args.sceneIndex === args.totalScenes;
  const targetSeconds = sceneOutline.targetSeconds;
  const approxWords = Math.round((targetSeconds / 60) * 150);
  const cfg = formatConfig(args.format);
  const useSolo = cfg.castSize === 1;
  const isPals = cfg.castSize === 2;

  if (!env.anthropicApiKey) {
    return {
      turns: stubSceneTurns(args, targetSeconds, isFinal, useSolo),
      model: SCENE_MODEL,
      usage: ZERO_USAGE,
    };
  }

  const castBrief = args.setup.panelists
    .map(
      (c) =>
        `- ${c.role} — ${c.name} (${c.gender ?? ""}${c.ethnicity ? `, ${c.ethnicity}` : ""}): ${c.persona}`,
    )
    .join("\n");

  const outlineBrief = args.setup.outline
    .map((o) => `  Scene ${o.sceneIndex} (${o.targetSeconds}s): ${o.focus}`)
    .join("\n");

  const formatGuidance = useSolo
    ? [
        "This is a SOLO format: a single host delivering the material in first person. All turns use speaker 'moderator'.",
        "",
        "STRUCTURAL ARC for solo episodes:",
        "  • Stronger internal arc than a multi-speaker show. The scene needs to MOVE — start somewhere, end somewhere different. The listener should feel something resolved, opened, or sharpened by the end of each scene.",
        "  • Fewer theatrical transitions. No 'meanwhile' / 'pivoting to' / 'now let's turn to' — just keep the through-line taut. Sections shift because the thinking moved, not because the host announced a shift.",
        "  • More direct payoffs. With no co-host to bounce off, every turn carries more weight; weak filler turns are more visible. Cut sentences that exist only to set up the next sentence.",
        "  • Style cadence depends on whether this is a newscast (anchor-style: crisp, factual, structured) or a solo monologue (essayistic, exploratory, personal). Match cadence to topic register.",
      ].join("\n")
    : isPals
    ? [
        "This is a TWO-host conversation between equals — a duo with chemistry, not interviewer/guest. Speakers alternate between 'moderator' (the lead host) and 'panelist_1' (the co-host). Never use 'panelist_2'.",
        "",
        "STRUCTURAL ARC for pals episodes:",
        "  • Asymmetry within the chemistry. The two hosts shouldn't be equally invested in every beat — one might lean in on a topic the other shrugs at, then the roles flip. That asymmetry is what makes pals feel like real friends rather than a balanced segment.",
        "  • Mutual buildup. One host plants a thought, the other lifts it somewhere unexpected, the first one builds on that. The conversation should compound rather than alternate.",
        "  • Tangents are welcome. A small detour about something one host saw or remembered is part of the form. Don't keep the conversation perfectly on-topic — that reads as scripted. The detour should land back on the topic, but it doesn't have to be quick.",
        "",
        "Conversation dynamics:",
        "  • Keep most turns short — one or two sentences. Many turns should be even shorter: a fragment, a one-line reaction, a single word ('Right.' / 'Wait —' / 'Exactly.' / 'Oh come on.').",
        "  • The two hosts riff together — they finish each other's thoughts, push back, react audibly, and disagree without it ever feeling combative. They're friends.",
        "  • Neither host is a moderator-of-the-other. The lead host steers gently but the co-host can also shift the topic, lob a question back, or call a beat.",
        "  • Tight back-and-forth: in a 30-second chunk you should see 6–10 short turns, not 2–3 long speeches.",
        "  • Use `[chuckle]` / `[laughing]` / `[surprised]` / `[emphasis]` for quick reactions. `[interrupting]` when one cuts the other off. Let lines trail off with em-dashes when interrupted.",
        "",
        "COGNITIVE DIFFERENTIATION (more important than tonal differentiation, and the easiest place to fail):",
        "  • Don't just make one host snarkier and the other measured. Give them DIFFERENT THINKING STYLES. Tonal contrast alone produces two voices delivering the same shape of thought in different attitudes.",
        "  • Pick a CONTRAST in cognitive mode — e.g. one ANECDOTAL (reaches for stories, real people, scenes they remember) vs one ANALYTICAL (frameworks, mechanisms, counter-arguments). Or one TACTICAL (numbers, what-this-means-for-you specifics) vs one STRUCTURAL (the bigger pattern, second-order effects). Or one BLUNT (short asserted takes) vs one EXPLORATORY (turns claims into questions).",
        "  • These styles produce different SHAPES of speech. The story-thinker takes longer turns and starts with 'so I was talking to someone last month —'. The framework-thinker frames before answering: 'there are two things going on here —'. The tactical thinker drops a number then a 'so what'. Sentence length varies by style.",
        "  • Hedging varies by style. The anecdotal one hedges with 'maybe this is just one data point but —'. The tactical one asserts when they have the number. The structural one names the limits of their framing. The blunt one doesn't hedge.",
        "  • Reaction repertoire varies — not just `[chuckle]` for both. One might react with a question ('wait, who?'), the other with a direct counter ('no, I don't buy it'). One pulls the conversation toward stories, the other toward principles.",
        "  • Each host gets a SOCIAL FUNCTION too. One is the asker / opener / pivoter; the other is the explainer / pusher / closer. The roles can swap across scenes but each host should be doing one of these jobs in any given exchange.",
        "  • Each host gets a RHYTHM. One could be concise (short clean lines), the other layered (builds across two or three sentences). One could be interruptive (jumps in mid-thought), the other careful (waits for the opening). The rhythms must be different and audible.",
        "  • TEST THIS BEFORE YOU SHIP THE SCENE: by each speaker's third turn, their cognitive style must be unmistakable WITHOUT name labels. If a careful reader could swap the speakers' lines and the conversation would still read the same, you haven't differentiated them — you've just colored them. Rewrite until each turn could only have been spoken by the speaker it's assigned to.",
        "",
        "Pacing (pauseMsAfter — translated to inline silence in the audio):",
        "  • Tight cross-talk / interruption: 80–180 ms.",
        "  • Natural beat / shift of topic: 300–500 ms.",
        "  • Dramatic / thoughtful pause: 800–1500 ms. Use sparingly.",
      ].join("\n")
    : [
        "This is a three-person panel — a FAST, LIVELY conversation, not three monologues in sequence.",
        "",
        "STRUCTURAL ARC for panel episodes:",
        "  • The moderator TRIANGULATES — bounces a thought from one panelist to the other, surfaces disagreement on purpose, asks the panelist who hasn't talked in a beat for their read. Without active triangulation a panel collapses into two voices alternating.",
        "  • Tension is the engine. At least one beat per scene should have a real disagreement (not a contrived one). The panelists don't all have to land in the same place; the show is more interesting when they don't.",
        "  • Role contrast is visible across scenes too — the same panelist should be reaching for the same KIND of move (stories vs frameworks vs counter-examples) consistently. If one panelist suddenly switches register mid-episode, you've lost their voice.",
        "",
        "Conversation dynamics (this is the most important thing to get right):",
        "  • Keep most turns short — one or two sentences. MANY turns should be even shorter: a fragment, a one-line reaction, a single word ('Right.' / 'Wait —' / 'Exactly.' / 'Oh come on.').",
        "  • Panelists interrupt each other, finish each other's sentences, jump in mid-thought, push back, react audibly. They don't wait to be called on.",
        "  • Let panelists go at each other directly. The moderator steers and asks pointed follow-ups but does NOT have to mediate every exchange.",
        "  • Turns stack in tight back-and-forth — in a 30-second chunk of conversation you should see 6–10 short turns, not 2–3 long speeches. Aim for a heavy ratio of short reactive turns vs longer developing ones.",
        "  • Use `[interrupting]` at the start of a turn that cuts someone off. Use `[chuckle]` / `[surprised]` / `[emphasis]` for quick reactions. Let characters trail off with em-dashes when they're being cut.",
        "",
        "COGNITIVE DIFFERENTIATION (more important than tonal differentiation, and the easiest place to fail):",
        "  • The default failure is three speakers who all deliver compact, thesis-driven bursts — just with different attitudes. Tonal contrast alone (snarky / measured / earnest) is not enough.",
        "  • Assign each panelist a distinct THINKING STYLE. Pick three different cognitive modes — for example: one STRUCTURAL (thinks in frameworks, categories, second-order effects), one ANECDOTAL (reaches for stories, scenes, specific people they've met), one TACTICAL (numbers, mechanisms, what-this-means-for-you specifics). Or swap one in for CONTRARIAN (pushes back on the room's premise) or BLUNT REALIST (short asserted takes that puncture posturing) or EMOTIONAL INTERPRETER (names the feeling under the argument) when the topic warrants.",
        "  • These styles produce different SHAPES of speech. Structural frames before answering: 'there are two things going on here —'. Anecdotal opens with 'so I was talking to someone last month'. Tactical drops a number then a 'so what'. Contrarian punches short: 'I think you've got that backwards.' Sentence length varies — structural and anecdotal go longer, tactical and contrarian punch shorter.",
        "  • Hedging varies by style. Anecdotal hedges with 'maybe this is just one data point but —'. Tactical asserts confidently when they have the number, hedges hard when they don't. Structural names the limits of their own framing. Contrarian goes blunt.",
        "  • Interruption patterns vary. Contrarians cut in. Tacticals jump in to name a specific case ('actually, look at what happened with —'). Anecdotals usually wait for an opening then take their time. The moderator may interrupt for sharpness, but rarely.",
        "  • Even a 4-word turn should sound like only that speaker — and the way they THINK should be visible, not just their attitude.",
        "  • Each panelist also gets a SOCIAL FUNCTION inside the conversation: explainer, skeptic, comedian, realist, contrarian, host (the moderator). These are different from cognitive style — a structural thinker can be the skeptic OR the explainer; the social function shapes what they DO in the conversation, not how they think.",
        "  • Each panelist gets a RHYTHM. Concise / layered / interruptive / careful are the four basic rhythms — pick a different one for each panelist. The moderator is usually careful (steers and sets up). The contrarian is usually interruptive. The structural thinker is usually layered. The tactical thinker is usually concise.",
        "  • TEST THIS BEFORE YOU SHIP THE SCENE: by each speaker's third turn, their cognitive style must be unmistakable WITHOUT name labels. If a careful reader could swap any two panelists' lines and the conversation would still read the same, you haven't differentiated them — you've just colored them. Rewrite until each turn could only have been spoken by the speaker it's assigned to.",
        "",
        "Pacing (pauseMsAfter — translated to inline silence in the audio):",
        "  • Tight cross-talk / interruption: 80–180 ms. This is the default for reactive turns.",
        "  • Natural beat / shift of topic: 300–500 ms.",
        "  • Dramatic / thoughtful pause: 800–1500 ms. Use sparingly.",
      ].join("\n");

  const locale = localeFor(args.locale);
  const lg = LOCALE_GUIDANCE;

  const openingGuidance = useSolo
    ? [
        `Open the scene by resuming the conversation after the ad break — then dive into this scene's beat. Opening style is your call: ${lg.backFromBreakOpeners}.`,
      ].join(" ")
    : isPals
    ? [
        `OPEN the scene by resuming the conversation after the ad break with the lead host (moderator), then immediately bounce a thought to the co-host (panelist_1) BY NAME or invite their reaction to something. The co-host should answer back quickly so the back-and-forth is established within the first three turns.`,
        `Opening style is your call: ${lg.backFromBreakOpeners}.`,
        "Alternate which host opens vs. which one drives the topic across scenes so it doesn't feel like an interview.",
      ].join(" ")
    : [
        `OPEN the scene by resuming the conversation after the ad break with the moderator, then hand off to one of the panelists BY NAME with a specific, pointed prompt or question that launches this scene's beat.`,
        `Opening style is your call: ${lg.backFromBreakOpeners}.`,
        "Rotate which panelist is prompted first across scenes so both panelists get handoffs.",
      ].join(" ");

  const includeCta = shouldIncludeCta(args.metadata);
  const ctaInstructionForFinal = includeCta
    ? "DEFAULT TO NO CTA. Most episodes should end without any like/share/subscribe ask — a clean sign-off lands better than a podcast-y CTA. Only include one if there's a GENUINELY natural beat for it that doesn't read as a CTA at all. The CTA must be invisible-as-CTA: woven into a thought the host was already having, not a tacked-on outro line. Forbidden phrasings (do not paraphrase around them either — the FORM is banned, not just the words): 'if this made you think', 'if this got you thinking', 'if this helped you', 'if you got something out of this', 'share it with one person', 'send this to someone', 'hit like'. If you can't include the CTA without falling into one of those shapes, leave it out."
    : "Do NOT include any like/share/subscribe ask — this register doesn't carry it.";
  const endingGuidance = isFinal
    ? [
        `This is the FINAL scene — about ${targetSeconds} seconds of wrap-up.`,
        useSolo
          ? "After the welcome-back opening, the host delivers closing thoughts, a short reflection, and a sign-off (thanks for listening)."
          : isPals
          ? "After the welcome-back opening, both hosts trade closing thoughts — let the co-host (panelist_1) get a real beat, not just a goodbye. The lead host (moderator) delivers the actual sign-off (thanks for listening), but the co-host can chime in with a final line."
          : "After the welcome-back opening, the moderator delivers closing thoughts, thanks the panelists by name, and a thanks-for-listening sign-off.",
        "Do NOT end with a 'we'll be right back' ad transition — this is the ending.",
        "The closing doesn't need a tidy thesis or 'big takeaway' — a sharp specific, an open question, or even a quiet exit can be the right landing. Vary the SHAPE of the ending across episodes; the audience should not be able to predict the closing move.",
        ctaInstructionForFinal,
      ].join(" ")
    : [
        `This is scene ${args.sceneIndex} of ${args.totalScenes} — about ${targetSeconds} seconds.`,
        `The final line of the scene MUST be the moderator delivering a brief, natural transition to an ad break — something equivalent to ${lg.adBreakExample}. Intentional, not abrupt.`,
        "NEVER specify how long the ad break or the show is — no concrete time references. The break is only a few seconds of audio; do not imply otherwise.",
        "AT THE POINT OF WRITING THIS SCENE-OUT, re-check these phrase + structure bans (they are the model's most common failure here):",
        "  • Phrases banned even once in this turn: 'hold that thought', 'quick break', 'quick pause', 'quick reset', 'and we're back' as scene-opener, 'stay with us', 'don't go anywhere', 'more after the break', 'sit tight', 'we'll be right back' as a tic.",
        "  • Structural form banned: 'POSE A QUESTION → \"right after this\" / \"after the break\" / \"when we\\'re back\"' is the house template the system defaults to. Use it AT MOST ONCE per episode. Other scenes must end with a different shape entirely — trail off mid-thought, end on a sharp specific, name the next beat without phrasing it as a question, or just stop.",
        "  • If the prior scene already used a question-tease, this scene MUST NOT use one. Track what came before and pick a different shape.",
      ].join(" ");

  // System prompt is split so the stable portion can be cached across scene calls
  // within the same episode (5-min TTL on ephemeral cache). Today's date is
  // baked into the stable portion — it changes once per day, not per scene,
  // so the cache hits across all scenes within the same episode render.
  const stableSystem = [
    `You write one scene of a flipcast episode using the provided cast and outline.`,
    languagePreambleFor(locale),
    args.metadata ? metadataDirective(args.metadata) : "",
    temporalGuidance(locale, args.metadata?.time_context),
    PREDRAFT_PLANNING,
    formatGuidance,
    openingGuidance,
    "Lean theatrical — vivid language, strong voice, never bland — but never theatrical at the cost of accuracy or audio-natural phrasing.",
    CRAFT_GUIDANCE,
    topicIntentGuidance(args.metadata?.topic_domain, args.metadata?.user_intent),
    FISH_TAG_GUIDANCE,
    "Emit strictly via the `emit_scene` tool.",
  ].join("\n");

  const dynamicSystem = [
    endingGuidance,
    `Target length: roughly ${targetSeconds} seconds (~${approxWords} words total across all turns).`,
  ].join("\n");

  // User message split the same way: topic/cast/outline are stable; scene focus
  // + prior-scene summary are dynamic.
  const stableUser = [
    `Topic: ${args.topic}`,
    `Topic framing: ${args.setup.topicContext}`,
    `\nCast:\n${castBrief}`,
    `\nFull scene outline:\n${outlineBrief}`,
  ].join("\n");

  const dynamicUser = [
    `\nCurrent scene focus (scene ${args.sceneIndex}): ${sceneOutline.focus}`,
    args.priorScenesBrief
      ? `\n\nWhat has already happened this episode:\n${args.priorScenesBrief}`
      : "",
  ].join("\n");

  const response = await client().messages.create({
    model: SCENE_MODEL,
    max_tokens: 2048,
    system: [
      { type: "text", text: stableSystem, cache_control: { type: "ephemeral" } },
      { type: "text", text: dynamicSystem },
    ],
    tools: [SCENE_TOOL],
    tool_choice: { type: "tool", name: "emit_scene" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: stableUser, cache_control: { type: "ephemeral" } },
          { type: "text", text: dynamicUser },
        ],
      },
    ],
  });
  const usage = extractUsage(response);

  const block = response.content.find(
    (b) => b.type === "tool_use" && b.name === "emit_scene",
  );
  if (!block || block.type !== "tool_use") {
    throw new Error("emit_scene tool output missing from model response.");
  }
  const parsed = scenePayloadSchema.parse(block.input);
  const turns: TranscriptTurn[] = parsed.turns.map((t, i) => ({
    sequence: typeof t.sequence === "number" ? t.sequence : i,
    // Force all single-speaker turns to 'moderator' regardless of what Claude picked.
    speaker: useSolo ? "moderator" : t.speaker,
    text: t.text,
    pauseMsAfter: typeof t.pauseMsAfter === "number" ? t.pauseMsAfter : 150,
    isAd: false,
  }));
  return { turns, model: SCENE_MODEL, usage };
}

// ---------- Stubs (used when ANTHROPIC_API_KEY is not set) ----------

const STUB_NAMES: {
  gender: "male" | "female";
  name: string;
  ethnicity: string;
  bio: string;
}[] = [
  // Traditional American — male
  { gender: "male", name: "Michael Davidson", ethnicity: "American", bio: "a longtime broadcast journalist from Chicago" },
  { gender: "male", name: "David Thompson", ethnicity: "American", bio: "a former trial lawyer turned podcast host" },
  { gender: "male", name: "James O'Brien", ethnicity: "American", bio: "a Boston newsroom veteran with four decades of stories" },
  { gender: "male", name: "Christopher Walsh", ethnicity: "American", bio: "a magazine features editor from Brooklyn" },
  { gender: "male", name: "Ryan Sullivan", ethnicity: "American", bio: "a sports-radio host with a second act in culture" },
  { gender: "male", name: "Mark Johnson", ethnicity: "American", bio: "a tech columnist turned cranky observer" },
  { gender: "male", name: "Kevin Murphy", ethnicity: "American", bio: "a Texas-raised essayist with a slow-building cadence" },
  { gender: "male", name: "Scott Bradley", ethnicity: "American", bio: "an economics writer who swears he's fun at parties" },
  { gender: "male", name: "Tyler Morrison", ethnicity: "American", bio: "a former congressional staffer turned commentator" },
  { gender: "male", name: "Brandon Wheeler", ethnicity: "American", bio: "a startup founder between ventures and into opinions" },
  { gender: "male", name: "Jason Palmer", ethnicity: "American", bio: "a documentary filmmaker from Atlanta" },
  { gender: "male", name: "Patrick Lane", ethnicity: "American", bio: "a historian who broke into podcasting late" },
  { gender: "male", name: "Thomas Wright", ethnicity: "American", bio: "a former diplomat with strong coffee opinions" },
  { gender: "male", name: "Kyle Donovan", ethnicity: "American", bio: "an investigative reporter out of Philly" },
  { gender: "male", name: "Nathan Stone", ethnicity: "American", bio: "a civil-rights lawyer by day, essayist by night" },
  { gender: "male", name: "Aaron Fitzgerald", ethnicity: "American", bio: "a former Army officer turned policy wonk" },
  { gender: "male", name: "Jeffrey Baker", ethnicity: "American", bio: "a hedge-fund analyst with a literature habit" },
  { gender: "male", name: "Eric Hollis", ethnicity: "American", bio: "a Midwestern English teacher turned cultural critic" },
  { gender: "male", name: "Andrew Castellano", ethnicity: "American", bio: "a former congressional reporter from D.C." },
  { gender: "male", name: "Greg Wallace", ethnicity: "American", bio: "a veteran science writer who still sends handwritten notes" },

  // Traditional American — female
  { gender: "female", name: "Sarah Carter", ethnicity: "American", bio: "a longtime newspaper columnist from Minneapolis" },
  { gender: "female", name: "Jennifer Walsh", ethnicity: "American", bio: "a former White House correspondent" },
  { gender: "female", name: "Jessica Reynolds", ethnicity: "American", bio: "a Substack writer with a cult following" },
  { gender: "female", name: "Emily Roberts", ethnicity: "American", bio: "an economics professor who left academia for media" },
  { gender: "female", name: "Lauren Bennett", ethnicity: "American", bio: "a tech-industry reporter from San Francisco" },
  { gender: "female", name: "Rebecca Hayes", ethnicity: "American", bio: "a former ad-agency strategist with a sharp tongue" },
  { gender: "female", name: "Amanda Reed", ethnicity: "American", bio: "a memoirist turned essay-podcast host" },
  { gender: "female", name: "Megan Foster", ethnicity: "American", bio: "a former public defender now writing about justice" },
  { gender: "female", name: "Stephanie Vaughn", ethnicity: "American", bio: "a food writer from Nashville with wide-ranging tastes" },
  { gender: "female", name: "Victoria Brooks", ethnicity: "American", bio: "a Brooklyn-based critic with sharp elbows" },
  { gender: "female", name: "Angela Carter", ethnicity: "American", bio: "a political scientist with a knack for a quick story" },
  { gender: "female", name: "Melissa Frank", ethnicity: "American", bio: "a business journalist from Philadelphia" },
  { gender: "female", name: "Heather Price", ethnicity: "American", bio: "a travel writer who now covers labor" },
  { gender: "female", name: "Caroline Hughes", ethnicity: "American", bio: "a former prosecutor now reporting on crime" },
  { gender: "female", name: "Rachel Greene", ethnicity: "American", bio: "a long-form essayist from upstate New York" },
  { gender: "female", name: "Nicole Langford", ethnicity: "American", bio: "a cultural anthropologist turned podcaster" },
  { gender: "female", name: "Ashley Donovan", ethnicity: "American", bio: "a former late-night TV writer from L.A." },
  { gender: "female", name: "Kristen Moore", ethnicity: "American", bio: "a climate reporter from Denver" },
  { gender: "female", name: "Natalie Chase", ethnicity: "American", bio: "a financial-literacy educator with a cult newsletter" },
  { gender: "female", name: "Erin Sutton", ethnicity: "American", bio: "a tech critic who misses having a tv to throw things at" },

  // International variety (kept modest — traditional American is the default bias)
  { gender: "female", name: "Elena Costa", ethnicity: "Portuguese", bio: "a Lisbon historian with a podcast habit" },
  { gender: "female", name: "Sofia Rossi", ethnicity: "Italian", bio: "a Milan-based design critic" },
  { gender: "female", name: "Hannah Lindqvist", ethnicity: "Swedish", bio: "a Stockholm-based behavioral economist" },
  { gender: "female", name: "Rosa Hernandez", ethnicity: "Mexican", bio: "a bilingual culture reporter from San Antonio" },
  { gender: "female", name: "Anjali Mehta", ethnicity: "Indian-American", bio: "a science journalist from the Bay Area" },
  { gender: "male", name: "Kenji Nakamura", ethnicity: "Japanese", bio: "a Tokyo-based engineer and essayist" },
  { gender: "male", name: "Liam O'Sullivan", ethnicity: "Irish", bio: "a Dublin-based political reporter" },
  { gender: "male", name: "Marco Bellini", ethnicity: "Italian", bio: "a Rome-based opera-turned-tech writer" },
  { gender: "male", name: "Chidi Okonkwo", ethnicity: "Nigerian", bio: "a Lagos-raised economist now teaching in London" },
  { gender: "male", name: "Andre Dubois", ethnicity: "French-American", bio: "a New Orleans food historian" },
];

function stubSetup(
  args: {
    topic: string;
    format: FlipcastFormat;
    engine: TtsEngine;
    outline: SceneOutline[];
    presetVoiceIds?: string[];
  },
  pool: VoiceOption[],
): EpisodeSetup {
  const cfg = formatConfig(args.format);
  const shuffled = [...STUB_NAMES].sort(() => Math.random() - 0.5);
  const roles: Character["role"][] =
    cfg.castSize === 1
      ? ["moderator"]
      : ["moderator", "panelist_1", "panelist_2"];
  const used = new Set<string>();
  const panelists: Character[] = roles.map((role, i) => {
    const pick = shuffled.shift()!;
    const forcedId = args.presetVoiceIds?.[i];
    let voice = forcedId ? VOICE_BY_ID.get(forcedId) : undefined;
    if (!voice) voice = pickFallbackVoice(pick.gender, used, pool);
    used.add(voice.id);
    return {
      role,
      name: pick.name,
      gender: pick.gender,
      ethnicity: pick.ethnicity,
      bio: pick.bio,
      persona: `Stub persona for ${pick.name} — a credible voice on today's topic.`,
      voiceId: voice.id,
      voiceLabel: voice.label,
    };
  });

  const mod = panelists[0]!;
  const welcomeText =
    cfg.castSize === 1
      ? `Hi, I'm ${mod.name}. Today — ${args.topic}. It's one of those stories that sounds familiar at first, but there are layers here most coverage misses. In the next few minutes I'll walk you through what's happening, why it matters right now, and the quieter consequences worth paying attention to. We'll be right with you after this ad.`
      : `Hi, I'm ${mod.name}. Today's topic — ${args.topic}. It's a subject that looks simple until you pull on a thread, and then it gets surprisingly textured. Joining me: ${panelists[1]?.name}, ${panelists[1]?.bio} — expect a from-the-trenches view. And ${panelists[2]?.name}, ${panelists[2]?.bio} — expect the uncomfortable question nobody else is asking. We're gathering the panelists and we'll start shortly, right after this ad.`;

  return {
    topicContext: `A short discussion of ${args.topic}.`,
    panelists,
    welcomeText,
    outline: args.outline,
  };
}

function stubFullNewscast(
  args: {
    topic: string;
    engine: TtsEngine;
    outline: SceneOutline[];
    presetVoiceIds?: string[];
  },
  pool: VoiceOption[],
): {
  setup: EpisodeSetup;
  scenes: { sceneIndex: number; turns: TranscriptTurn[] }[];
} {
  const setup = stubSetup(
    {
      topic: args.topic,
      format: "newscast",
      engine: args.engine,
      outline: args.outline,
      presetVoiceIds: args.presetVoiceIds,
    },
    pool,
  );
  const scenes = args.outline.map((o) => ({
    sceneIndex: o.sceneIndex,
    turns: stubSceneTurns(
      {
        topic: args.topic,
        setup,
        sceneIndex: o.sceneIndex,
        totalScenes: args.outline.length,
      },
      o.targetSeconds,
      o.sceneIndex === args.outline.length,
      true,
    ),
  }));
  return { setup, scenes };
}

function stubSceneTurns(
  args: {
    topic: string;
    setup: EpisodeSetup;
    sceneIndex: number;
    totalScenes: number;
  },
  targetSeconds: number,
  isFinal: boolean,
  useSolo: boolean,
): TranscriptTurn[] {
  const mod = args.setup.panelists[0]!;
  if (useSolo) {
    if (isFinal) {
      return [
        { sequence: 0, speaker: "moderator", text: `And we're back. Before we close out — here's what stuck with me about ${args.topic}.`, pauseMsAfter: 150, isAd: false },
        { sequence: 1, speaker: "moderator", text: `Thanks for listening to flipcast — we'll see you next time.`, pauseMsAfter: 250, isAd: false },
      ];
    }
    return [
      { sequence: 0, speaker: "moderator", text: `And we're back. Here's what matters about ${args.topic}.`, pauseMsAfter: 150, isAd: false },
      { sequence: 1, speaker: "moderator", text: `The landscape shifted quickly — and most people missed the reason why.`, pauseMsAfter: 150, isAd: false },
      { sequence: 2, speaker: "moderator", text: `Hold that thought — we'll be right back after this short break.`, pauseMsAfter: 250, isAd: false },
    ];
  }
  const p1 = args.setup.panelists[1];
  const p2 = args.setup.panelists[2];
  const leadWith = args.sceneIndex % 2 === 1 ? p1 : p2;
  const followWith = leadWith === p1 ? p2 : p1;
  if (isFinal) {
    return [
      { sequence: 0, speaker: "moderator", text: `Welcome back. ${leadWith?.name}, give me the one line you want listeners to walk away with on ${args.topic}.`, pauseMsAfter: 150, isAd: false },
      { sequence: 1, speaker: leadWith === p1 ? "panelist_1" : "panelist_2", text: `Stay curious about ${args.topic}. That's the whole game.`, pauseMsAfter: 150, isAd: false },
      { sequence: 2, speaker: followWith === p1 ? "panelist_1" : "panelist_2", text: `And read something tomorrow you wouldn't normally read.`, pauseMsAfter: 150, isAd: false },
      { sequence: 3, speaker: "moderator", text: `Beautiful. Thanks ${p1?.name}, ${p2?.name}. Thanks for listening to flipcast.`, pauseMsAfter: 200, isAd: false },
    ];
  }
  return [
    { sequence: 0, speaker: "moderator", text: `Welcome back. ${leadWith?.name}, I want to pick up where we left off — what's the part of ${args.topic} people keep getting wrong?`, pauseMsAfter: 150, isAd: false },
    { sequence: 1, speaker: leadWith === p1 ? "panelist_1" : "panelist_2", text: `The most underrated part of ${args.topic} is how fast the goalposts move.`, pauseMsAfter: 150, isAd: false },
    { sequence: 2, speaker: followWith === p1 ? "panelist_1" : "panelist_2", text: `Push back — the fundamentals haven't changed, the hype has.`, pauseMsAfter: 150, isAd: false },
    { sequence: 3, speaker: "moderator", text: `Hold that thread — we'll be right back after this short break.`, pauseMsAfter: 250, isAd: false },
  ];
}
