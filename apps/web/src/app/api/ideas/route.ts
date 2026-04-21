import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface IdeasPayload {
  todaysNews: string[];
  learnAbout: string[];
  talkAbout: string[];
  generatedAt: string;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

declare global {
  // eslint-disable-next-line no-var
  var __flipcastIdeasCache:
    | { data: IdeasPayload; expiresAt: number }
    | undefined;
}

const IDEAS_TOOL = {
  name: "emit_ideas",
  description: "Emit Flip.audio topic ideas across three categories.",
  input_schema: {
    type: "object",
    properties: {
      todaysNews: {
        type: "array",
        items: { type: "string" },
        description:
          "Six topic ideas that feel like fresh current-affairs conversation — politics, tech, business, sports, culture. Not literal headlines; podcast-ready framing. 8-14 words each.",
      },
      learnAbout: {
        type: "array",
        items: { type: "string" },
        description:
          "Six niche, curious, 'learn something new' topics drawn from different domains — science, history, hidden industries, obscure biology, strange subcultures, economics. Vary widely. 8-14 words each.",
      },
      talkAbout: {
        type: "array",
        items: { type: "string" },
        description:
          "Six gossip / social / cultural conversation starters — celebrity moments, relationship dynamics, viral trends, water-cooler topics, modern dating, workplace tension. 8-14 words each.",
      },
    },
    required: ["todaysNews", "learnAbout", "talkAbout"],
  },
} as const;

async function generateIdeas(): Promise<IdeasPayload> {
  if (!env.anthropicApiKey) {
    return fallbackIdeas();
  }

  const client = new Anthropic({ apiKey: env.anthropicApiKey });
  const system = [
    "You generate fresh podcast topic ideas for Flip.audio, a personalized on-demand podcast.",
    "Output 6 ideas per category, each 8-14 words, written as concrete Flip.audio prompts a user could submit directly.",
    "Vary widely across runs — don't repeat obvious topics. Be specific, opinionated, and slightly provocative.",
    "Emit strictly via the `emit_ideas` tool.",
  ].join(" ");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system,
    tools: [IDEAS_TOOL],
    tool_choice: { type: "tool", name: "emit_ideas" },
    messages: [
      {
        role: "user",
        content: `Generate six topic ideas for each of the three Flip.audio categories: today's news, learn about, talk about. Timestamp: ${new Date().toISOString()}.`,
      },
    ],
  });

  const block = response.content.find(
    (b) => b.type === "tool_use" && b.name === "emit_ideas",
  );
  if (!block || block.type !== "tool_use") {
    throw new Error("emit_ideas tool output missing.");
  }
  const raw = block.input as Record<string, unknown>;
  const sanitize = (list: unknown): string[] =>
    Array.isArray(list)
      ? list.filter((x): x is string => typeof x === "string").slice(0, 8)
      : [];

  return {
    todaysNews: sanitize(raw.todaysNews),
    learnAbout: sanitize(raw.learnAbout),
    talkAbout: sanitize(raw.talkAbout),
    generatedAt: new Date().toISOString(),
  };
}

function fallbackIdeas(): IdeasPayload {
  return {
    todaysNews: [
      "How rate cuts might shift the tech hiring cycle",
      "The quiet consolidation happening in independent journalism",
      "Why satellite launch backlogs are suddenly a political story",
      "The unexpected comeback of nuclear power in blue states",
      "Sports analytics hitting its weird experimental phase",
      "What college admissions look like in the post-DEI era",
    ],
    learnAbout: [
      "The economics of abandoned industrial cities in the Rust Belt",
      "How coral reefs actually recover — and when they don't",
      "A brief history of the competitive chess cheating scandal",
      "Why deep-sea cables are the true backbone of the internet",
      "The strange tax status of racehorses",
      "How professional jingle writers secretly built modern pop",
    ],
    talkAbout: [
      "Why nobody can agree on what 'soft launching' a partner means",
      "The great backlash against group chats that never end",
      "Why your most extroverted friend is secretly exhausted",
      "The new rules of workplace dating nobody actually knows",
      "Celebrity feuds that are clearly manufactured — and work anyway",
      "Why everyone's suddenly into cottage-core finance",
    ],
    generatedAt: new Date().toISOString(),
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const refresh = url.searchParams.get("refresh") === "1";

  const now = Date.now();
  if (
    !refresh &&
    globalThis.__flipcastIdeasCache &&
    globalThis.__flipcastIdeasCache.expiresAt > now
  ) {
    return NextResponse.json(globalThis.__flipcastIdeasCache.data);
  }

  try {
    const data = await generateIdeas();
    globalThis.__flipcastIdeasCache = {
      data,
      expiresAt: now + CACHE_TTL_MS,
    };
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate ideas";
    // Fall back to stale cache if we have one.
    if (globalThis.__flipcastIdeasCache) {
      return NextResponse.json(globalThis.__flipcastIdeasCache.data);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
