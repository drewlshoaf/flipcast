import { Queue, type ConnectionOptions } from "bullmq";
import Redis from "ioredis";
import { sseChannel, type SseEvent } from "@flipcast/types";

export const FLIPCAST_QUEUE = "flipcast";

export interface FlipcastJobData {
  requestId: string;
  // Admin-only fast-iteration mode: skip Fish TTS synthesis. Worker still
  // runs the full Claude pipeline (classify → setup → scenes → validate),
  // but no audio is produced. Default false; only honored when the API
  // confirmed the requesting user is an admin.
  transcriptOnly?: boolean;
}

export function redisConnectionFromUrl(url: string): ConnectionOptions {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    password: u.password || undefined,
    username: u.username || undefined,
    maxRetriesPerRequest: null,
  };
}

export function createFlipcastQueue(connection: ConnectionOptions) {
  return new Queue<FlipcastJobData>(FLIPCAST_QUEUE, { connection });
}

export function createRedisPublisher(url: string) {
  return new Redis(url, { maxRetriesPerRequest: null });
}

export function createRedisSubscriber(url: string) {
  return new Redis(url, { maxRetriesPerRequest: null });
}

export async function publishSseEvent(
  pub: Redis,
  event: SseEvent,
): Promise<void> {
  await pub.publish(sseChannel(event.requestId), JSON.stringify(event));
}
