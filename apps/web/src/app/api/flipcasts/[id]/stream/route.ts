import { eq } from "drizzle-orm";
import { flipcastRequests } from "@flipaudio/server-db";
import { sseChannel, type SseEvent } from "@flipaudio/types";
import { createRedisSubscriber } from "@flipaudio/queue";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type Redis from "ioredis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params;

  const existing = await db.query.flipcastRequests.findFirst({
    where: eq(flipcastRequests.id, id),
    columns: { id: true, status: true, finalAudioUrl: true },
  });
  if (!existing) {
    return new Response("Not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let sub: Redis | undefined;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const channel = sseChannel(id);

      const close = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        sub?.disconnect();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      const safeEnqueue = (payload: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(payload);
        } catch {
          close();
        }
      };

      const send = (evt: SseEvent) => {
        safeEnqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
      };

      heartbeat = setInterval(() => {
        safeEnqueue(encoder.encode(`: ping\n\n`));
      }, 15000);

      sub = createRedisSubscriber(env.redisUrl);
      await sub.subscribe(channel);
      sub.on("message", (_ch, raw) => {
        try {
          const evt = JSON.parse(raw) as SseEvent;
          send(evt);
          if (
            evt.event === "complete" ||
            evt.event === "failed" ||
            evt.event === "moderation_rejected"
          ) {
            close();
          }
        } catch {
          /* ignore */
        }
      });

      if (existing.status === "complete" && existing.finalAudioUrl) {
        send({
          event: "complete",
          requestId: id,
          timestamp: new Date().toISOString(),
          data: { finalAudioUrl: existing.finalAudioUrl },
        });
        close();
      }
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      sub?.disconnect();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
