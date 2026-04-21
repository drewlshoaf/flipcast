import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { INTEREST_BY_ID } from "@flipcast/types";
import { users } from "@flipcast/server-db";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ForMePayload {
  interests: { id: string; label: string; emoji: string }[];
  ideas: string[];
  generatedAt: string;
}

const FOR_ME_TOOL = {
  name: "emit_for_me",
  description:
    "Emit Flipcast topic ideas tuned to a user's selected interests.",
  input_schema: {
    type: "object",
    properties: {
      ideas: {
        type: "array",
        items: { type: "string" },
        description:
          "Eight topic ideas drawn from the user's interests. Each 8-14 words. Concrete, opinionated, varied — don't all be from the same interest.",
      },
    },
    required: ["ideas"],
  },
} as const;

function emptyPayload(): ForMePayload {
  return { interests: [], ideas: [], generatedAt: new Date().toISOString() };
}

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const rows = await db
    .select({ interests: users.interests })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const interestIds = rows[0]?.interests ?? [];
  const resolved = interestIds
    .map((id) => INTEREST_BY_ID.get(id))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  if (resolved.length === 0) {
    return NextResponse.json({ ...emptyPayload() });
  }

  if (!env.anthropicApiKey) {
    // Fallback: hand-stub one idea per interest.
    const ideas = resolved.slice(0, 8).map(
      (i) => `Something fresh about ${i.label.toLowerCase()} that you've probably missed`,
    );
    return NextResponse.json({
      interests: resolved.map((i) => ({
        id: i.id,
        label: i.label,
        emoji: i.emoji,
      })),
      ideas,
      generatedAt: new Date().toISOString(),
    });
  }

  const client = new Anthropic({ apiKey: env.anthropicApiKey });
  const interestList = resolved
    .map((i) => `${i.label.toLowerCase()}`)
    .join(", ");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: [
      "You generate Flipcast topic ideas tailored to a specific user's interests.",
      "Each idea must be 8-14 words and read as a concrete, opinionated podcast prompt the user could submit directly.",
      "Vary the topics across the user's interests (don't pile them all into one). Be specific and slightly provocative; avoid generic 'how X is changing the world' phrasing.",
      "Emit strictly via the `emit_for_me` tool.",
    ].join(" "),
    tools: [FOR_ME_TOOL],
    tool_choice: { type: "tool", name: "emit_for_me" },
    messages: [
      {
        role: "user",
        content: `User interests: ${interestList}.\nGenerate 8 fresh topic ideas spanning these interests. Timestamp: ${new Date().toISOString()}.`,
      },
    ],
  });

  const block = response.content.find(
    (b) => b.type === "tool_use" && b.name === "emit_for_me",
  );
  let ideas: string[] = [];
  if (block && block.type === "tool_use") {
    const raw = block.input as Record<string, unknown>;
    if (Array.isArray(raw.ideas)) {
      ideas = raw.ideas
        .filter((x): x is string => typeof x === "string")
        .slice(0, 10);
    }
  }

  return NextResponse.json({
    interests: resolved.map((i) => ({
      id: i.id,
      label: i.label,
      emoji: i.emoji,
    })),
    ideas,
    generatedAt: new Date().toISOString(),
  });
}
