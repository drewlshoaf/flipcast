import { createDb, type Database } from "@flipaudio/server-db";
import { env } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var __flipcastDb: Database | undefined;
}

export const db: Database =
  globalThis.__flipcastDb ?? createDb(env.databaseUrl);

if (process.env.NODE_ENV !== "production") {
  globalThis.__flipcastDb = db;
}
