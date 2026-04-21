import { createRedisPublisher, publishSseEvent } from "@flipaudio/queue";
import type { SseEvent, SseEventName } from "@flipaudio/types";
import { env } from "./env";

const pub = createRedisPublisher(env.redisUrl);

export async function emit(
  event: SseEventName,
  requestId: string,
  extra: Partial<Omit<SseEvent, "event" | "requestId" | "timestamp">> = {},
) {
  await publishSseEvent(pub, {
    event,
    requestId,
    timestamp: new Date().toISOString(),
    ...extra,
  });
}
