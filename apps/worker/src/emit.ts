import { createRedisPublisher, publishSseEvent } from "@flipcast/queue";
import type { SseEvent, SseEventName } from "@flipcast/types";
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
