import { createDb } from "@flipcast/server-db";
import { env } from "./env";

export const db = createDb(env.databaseUrl);
