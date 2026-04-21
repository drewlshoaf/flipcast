import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import {
  createRequestSchema,
  evaluatePolicy,
  formatConfig,
  planSequence,
  VOICE_BY_ID,
  type FlipcastFormat,
} from "@flipcast/types";
import {
  flipcastRequests,
  moderationDecisions,
} from "@flipcast/server-db";
import { publishSseEvent, createRedisPublisher } from "@flipcast/queue";
import { db } from "@/lib/db";
import { flipcastQueue } from "@/lib/queue";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = createRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const format = input.format as FlipcastFormat;
  const cfg = formatConfig(format);
  const engine = cfg.engine;

  // Validate any user-supplied voice picks.
  if (input.voiceIds && input.voiceIds.length > 0) {
    if (input.voiceIds.length !== cfg.castSize) {
      return NextResponse.json(
        {
          error: `Format "${format}" requires ${cfg.castSize} voice${cfg.castSize > 1 ? "s" : ""}, but ${input.voiceIds.length} were provided.`,
        },
        { status: 400 },
      );
    }
    for (const vid of input.voiceIds) {
      const voice = VOICE_BY_ID.get(vid);
      if (!voice) {
        return NextResponse.json(
          { error: `Unknown voice id: ${vid}` },
          { status: 400 },
        );
      }
      if (!voice.engines.includes(engine)) {
        return NextResponse.json(
          {
            error: `Voice "${voice.label}" does not support the "${engine}" engine for format "${format}".`,
          },
          { status: 400 },
        );
      }
    }
  }

  const sequence = planSequence(input.lengthMinutes);
  const targetSeconds = Math.round(input.lengthMinutes * 60);

  const session = await getSession();
  const userId = session?.user?.id ?? null;

  const [request] = await db
    .insert(flipcastRequests)
    .values({
      userId,
      topic: input.topic,
      requestedDurationLabel: `${input.lengthMinutes} min`,
      requestedDurationSecondsTarget: targetSeconds,
      engine,
      format,
      vibe: input.vibe,
      speed: input.speed ?? null,
      status: "validating",
    })
    .returning();

  if (!request) {
    return NextResponse.json(
      { error: "Failed to create request." },
      { status: 500 },
    );
  }

  const policyMatch = evaluatePolicy(input.topic);
  const pub = createRedisPublisher(env.redisUrl);
  try {
    await publishSseEvent(pub, {
      event: "request_received",
      requestId: request.id,
      timestamp: new Date().toISOString(),
      message: "Request accepted.",
    });

    await publishSseEvent(pub, {
      event: "moderation_started",
      requestId: request.id,
      timestamp: new Date().toISOString(),
    });

    if (policyMatch) {
      await db.insert(moderationDecisions).values({
        flipcastRequestId: request.id,
        inputText: input.topic,
        decision: "rejected",
        matchedPolicyCategory: policyMatch.categoryId,
        modelReasoningSummary: `Keyword match on "${policyMatch.matchedKeyword}" in category ${policyMatch.categoryLabel}.`,
      });

      await db
        .update(flipcastRequests)
        .set({
          status: "rejected",
          moderationStatus: "rejected",
          moderationReason: policyMatch.categoryLabel,
          updatedAt: new Date(),
        })
        .where(eq(flipcastRequests.id, request.id));

      await publishSseEvent(pub, {
        event: "moderation_rejected",
        requestId: request.id,
        timestamp: new Date().toISOString(),
        message: `Topic rejected: ${policyMatch.categoryLabel}.`,
        data: { category: policyMatch.categoryId },
      });

      return NextResponse.json({
        requestId: request.id,
        initialStatus: "rejected",
        moderationStatus: "rejected",
      });
    }

    await db.insert(moderationDecisions).values({
      flipcastRequestId: request.id,
      inputText: input.topic,
      decision: "approved",
    });

    await db
      .update(flipcastRequests)
      .set({
        status: "queued",
        moderationStatus: "approved",
        moderatorVoiceId: input.voiceIds?.[0] ?? null,
        panelist1VoiceId: input.voiceIds?.[1] ?? null,
        panelist2VoiceId: input.voiceIds?.[2] ?? null,
        updatedAt: new Date(),
      })
      .where(eq(flipcastRequests.id, request.id));

    await publishSseEvent(pub, {
      event: "moderation_approved",
      requestId: request.id,
      timestamp: new Date().toISOString(),
    });

    await flipcastQueue.add(
      "process",
      { requestId: request.id },
      { jobId: request.id, removeOnComplete: true, attempts: 3 },
    );

    await publishSseEvent(pub, {
      event: "queued",
      requestId: request.id,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      requestId: request.id,
      initialStatus: "queued",
      moderationStatus: "approved",
      format,
      engine,
      sequence,
    });
  } finally {
    pub.disconnect();
  }
}
