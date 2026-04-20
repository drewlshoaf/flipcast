import { Worker } from "bullmq";
import {
  FLIPCAST_QUEUE,
  redisConnectionFromUrl,
  type FlipcastJobData,
} from "@flipcast/queue";
import { env } from "./env";
import { runPipeline } from "./pipeline/run";

const connection = redisConnectionFromUrl(env.redisUrl);

const worker = new Worker<FlipcastJobData>(
  FLIPCAST_QUEUE,
  async (job) => {
    console.log(`[worker] processing ${job.data.requestId}`);
    await runPipeline(job.data.requestId);
    console.log(`[worker] completed ${job.data.requestId}`);
  },
  {
    connection,
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 2),
  },
);

worker.on("failed", (job, err) => {
  console.error(`[worker] job ${job?.id} failed:`, err);
});

worker.on("error", (err) => {
  console.error(`[worker] worker error:`, err);
});

console.log("[worker] ready, listening on queue:", FLIPCAST_QUEUE);

process.on("SIGTERM", async () => {
  console.log("[worker] SIGTERM, closing...");
  await worker.close();
  process.exit(0);
});
