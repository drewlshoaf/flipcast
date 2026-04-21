import { createDb } from "@flipaudio/server-db";
import { env } from "./env";

export const db = createDb(env.databaseUrl);
