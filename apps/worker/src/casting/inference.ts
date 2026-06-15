// Showbiz inference — single Haiku call that produces the structured
// labels driving downstream casting. Authoritative for moderation +
// sensitivity + subtype + complexity + discussion value.
//
// Why a separate call from the existing classifyEpisode:
//   - moderation has to gate the whole pipeline; it must run before
//     anything else and reject early
//   - the showbiz schema (sensitivity bands, subtype, disallowed
//     classes) is meaningfully different from EpisodeMetadata and we
//     don't want to overload Haiku's tool-output complexity
//   - both calls are cheap; running them in parallel keeps wall time low

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  DISALLOWED_TOPIC_CLASSES,
  TOPIC_LEVELS,
  TOPIC_SENSITIVITIES,
  TOPIC_SUBTYPES,
  TOPIC_BAND_EXAMPLES,
  type ShowbizInference,
} from "@flipcast/types";
import { env } from "../env";

const SHOWBIZ_INFERENCE_MODEL = "claude-haiku-4-5-20251001";

const SHOWBIZ_INFERENCE_TOOL = {
  name: "emit_showbiz_inference",
  description:
    "Classify the topic for the showbiz casting pipeline. Decide moderation + sensitivity + complexity + discussion value + (when applicable) a topic_subtype that biases vibe-adjustment routing.",
  input_schema: {
    type: "object",
    properties: {
      topic_type: {
        type: "string",
        description:
          "Free-form one-line label for the topic shape — e.g. 'current event', 'evergreen explainer', 'social observation', 'personal advice', 'cultural riff', 'policy analysis'. Pick the closest fit.",
      },
      topic_complexity: {
        type: "string",
        enum: TOPIC_LEVELS,
        description:
          "How much explanation the topic actually needs to land. Low = single point; medium = a couple of distinctions; high = many moving parts that benefit from multiple framings.",
      },
      topic_sensitivity: {
        type: "string",
        enum: TOPIC_SENSITIVITIES,
        description:
          "Sensitivity band. green=low (sports, pop culture, tech, lifestyle, etc.); yellow=moderate (layoffs, burnout, illness, controversial social issues); orange=high but allowed (death, war, abuse recovery, atrocities, terminal illness, severe trauma); red=disallowed (set disallowed=true with a reason code).",
      },
      topic_subtype: {
        type: ["string", "null"],
        enum: [...TOPIC_SUBTYPES, null],
        description:
          "Optional fine-grained signal that biases adjustment routing. Set when the topic clearly carries this shape; null otherwise. Tragedy = a singular tragic event; loss = grief / death of a person; atrocity = mass-scale violence; grave_current_event = serious live news.",
      },
      discussion_value: {
        type: "string",
        enum: TOPIC_LEVELS,
        description:
          "How much value comes from multiple perspectives. Low = single point of view does it; medium = a counter-take helps; high = the topic genuinely benefits from a panel disagreeing.",
      },
      disallowed: {
        type: "boolean",
        description:
          "TRUE only if the topic falls into one of the disallowed classes (see disallowed_reason_code enum). Be strict but precise: discussing addiction recovery is allowed (yellow); instructions for drug manufacturing is disallowed.",
      },
      disallowed_reason_code: {
        type: ["string", "null"],
        enum: [...DISALLOWED_TOPIC_CLASSES, null],
        description:
          "If disallowed=true, the matching class. Null when disallowed=false.",
      },
    },
    required: [
      "topic_type",
      "topic_complexity",
      "topic_sensitivity",
      "topic_subtype",
      "discussion_value",
      "disallowed",
      "disallowed_reason_code",
    ],
  },
} as const;

const showbizInferenceSchema = z.object({
  topic_type: z.string().min(1),
  topic_complexity: z.enum(TOPIC_LEVELS),
  topic_sensitivity: z.enum(TOPIC_SENSITIVITIES),
  topic_subtype: z.enum(TOPIC_SUBTYPES).nullable(),
  discussion_value: z.enum(TOPIC_LEVELS),
  disallowed: z.boolean(),
  disallowed_reason_code: z.enum(DISALLOWED_TOPIC_CLASSES).nullable(),
});

export interface InferShowbizArgs {
  topic: string;
}

export interface InferShowbizResult {
  inference: ShowbizInference;
  durationMs: number;
}

export async function inferShowbizEpisode(
  args: InferShowbizArgs,
): Promise<InferShowbizResult> {
  if (!env.anthropicApiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set; showbiz inference requires it.",
    );
  }

  const sensitivityGuidance = (
    ["green", "yellow", "orange"] as const
  )
    .map((band) => {
      const examples = TOPIC_BAND_EXAMPLES[band].slice(0, 6).join(", ");
      return `  ${band}: ${examples}.`;
    })
    .join("\n");

  const system = [
    "You are a topic classifier for the flipcast casting pipeline. Output a single structured object. Be decisive and well-calibrated; do NOT over-explain.",
    "",
    "Field guidance:",
    "  topic_complexity — how much the topic needs to land. Low = a single point; medium = a few distinctions; high = many moving parts.",
    "  topic_sensitivity — band examples:",
    sensitivityGuidance,
    "    red: handled by setting disallowed=true.",
    "  topic_subtype — set ONLY when the topic clearly carries this shape, otherwise null. tragedy=a singular tragic event; loss=grief/death of a person; atrocity=mass-scale violence; grave_current_event=serious live news.",
    "  discussion_value — high when the topic genuinely benefits from multiple perspectives disagreeing; low when a single voice does it.",
    "  disallowed — TRUE only for the listed disallowed classes. Discussion of addiction recovery, mental-health struggles, or controversial social issues is allowed (yellow/orange). Instruction to do harm or content involving minors / non-consent is disallowed.",
    "",
    "Be strict on disallowed but careful: do NOT block legitimate discussion of difficult topics (abuse recovery, suicide as a societal topic without instruction, war, atrocities as historical/news topics). Block only when the request itself is asking for instruction, encouragement, glorification, or explicitly graphic content.",
    "",
    "Emit strictly via the `emit_showbiz_inference` tool.",
  ].join("\n");

  const t0 = Date.now();
  const client = new Anthropic({ apiKey: env.anthropicApiKey });
  const response = await client.messages.create({
    model: SHOWBIZ_INFERENCE_MODEL,
    max_tokens: 256,
    system,
    tools: [SHOWBIZ_INFERENCE_TOOL],
    tool_choice: { type: "tool", name: "emit_showbiz_inference" },
    messages: [{ role: "user", content: `Topic: ${args.topic}` }],
  });
  const durationMs = Date.now() - t0;

  const block = response.content.find(
    (b) => b.type === "tool_use" && b.name === "emit_showbiz_inference",
  );
  if (!block || block.type !== "tool_use") {
    throw new Error("emit_showbiz_inference tool output missing.");
  }
  const parsed = showbizInferenceSchema.safeParse(block.input);
  if (!parsed.success) {
    throw new Error(
      `emit_showbiz_inference output failed validation: ${JSON.stringify(parsed.error.flatten())}`,
    );
  }

  // Belt-and-suspenders: if disallowed=true but no reason_code came
  // back, force a generic reason. The tool schema requires both fields,
  // but defensive normalization here lets downstream code rely on the
  // invariant "disallowed → reason_code present".
  if (parsed.data.disallowed && !parsed.data.disallowed_reason_code) {
    return {
      inference: {
        ...parsed.data,
        disallowed_reason_code: "abuse_coercion_instruction",
      },
      durationMs,
    };
  }
  if (!parsed.data.disallowed && parsed.data.disallowed_reason_code) {
    return {
      inference: { ...parsed.data, disallowed_reason_code: null },
      durationMs,
    };
  }

  return { inference: parsed.data, durationMs };
}
