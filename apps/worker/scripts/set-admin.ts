import { createDb, users } from "@flipaudio/server-db";
import { eq } from "drizzle-orm";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://flipcast:flipcast@postgres:5432/flipcast";
const db = createDb(databaseUrl);

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const flagArg = process.argv[3] ?? "true";
  if (!email) {
    console.error("Usage: pnpm tsx scripts/set-admin.ts <email> [true|false]");
    process.exit(1);
  }
  const isAdmin = flagArg !== "false";

  const result = await db
    .update(users)
    .set({ isAdmin, updatedAt: new Date() })
    .where(eq(users.email, email))
    .returning({ id: users.id, email: users.email, isAdmin: users.isAdmin });

  if (result.length === 0) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }
  console.log(`Set ${result[0]!.email} isAdmin=${result[0]!.isAdmin}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
