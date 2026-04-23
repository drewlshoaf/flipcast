import {
  createFlipcastQueue,
  redisConnectionFromUrl,
  type FlipcastJobData,
} from "@flipcast/queue";
import { Queue } from "bullmq";
import { env } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var __flipcastQueue: Queue<FlipcastJobData> | undefined;
}

export const flipcastQueue: Queue<FlipcastJobData> =
  globalThis.__flipcastQueue ??
  createFlipcastQueue(redisConnectionFromUrl(env.redisUrl));

if (process.env.NODE_ENV !== "production") {
  globalThis.__flipcastQueue = flipcastQueue;
}
