import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { emailVerificationCodes } from "@flipcast/server-db";
import { db } from "./db";

export const CODE_TTL_MINUTES = 15;
export const MAX_ATTEMPTS = 5;
const CODE_LENGTH = 6;
const BCRYPT_COST = 6; // Codes are short-lived; lower cost keeps verify fast.

function generateCode(): string {
  // Zero-padded 6-digit numeric code. randomInt is crypto-strong.
  return randomInt(0, 10 ** CODE_LENGTH)
    .toString()
    .padStart(CODE_LENGTH, "0");
}

/**
 * Issue a new verification code for a user, overwriting any existing code.
 * Logs the plaintext to stdout so the operator can fetch it in dev via
 * `docker compose logs -f web`.
 */
export async function issueVerificationCode(
  userId: string,
  email: string,
): Promise<{ expiresAt: Date }> {
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, BCRYPT_COST);
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000);

  await db
    .insert(emailVerificationCodes)
    .values({ userId, codeHash, expiresAt, attempts: 0 })
    .onConflictDoUpdate({
      target: emailVerificationCodes.userId,
      set: { codeHash, expiresAt, attempts: 0, createdAt: new Date() },
    });

  // Operator-visible log. Shows up in `docker compose logs web`.
  // eslint-disable-next-line no-console
  console.log(
    `[verification] email=${email} code=${code} expiresAt=${expiresAt.toISOString()}`,
  );

  return { expiresAt };
}
