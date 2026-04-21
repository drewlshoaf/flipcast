import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { emailVerificationCodes, users } from "@flipaudio/server-db";
import { db } from "@/lib/db";
import { MAX_ATTEMPTS } from "@/lib/verification";

export const runtime = "nodejs";

interface VerifyBody {
  email?: string;
  code?: string;
}

export async function POST(req: Request) {
  let body: VerifyBody;
  try {
    body = (await req.json()) as VerifyBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const code = String(body.code ?? "").trim();
  if (!email || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (!user) {
    // Same response shape as wrong code so we don't leak which emails exist.
    return NextResponse.json({ error: "Incorrect or expired code." }, { status: 400 });
  }
  if (user.emailVerified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const [row] = await db
    .select()
    .from(emailVerificationCodes)
    .where(eq(emailVerificationCodes.userId, user.id))
    .limit(1);
  if (!row) {
    return NextResponse.json(
      { error: "No active code. Request a new one." },
      { status: 400 },
    );
  }
  if (row.expiresAt.getTime() < Date.now()) {
    await db
      .delete(emailVerificationCodes)
      .where(eq(emailVerificationCodes.userId, user.id));
    return NextResponse.json(
      { error: "Code expired. Request a new one." },
      { status: 400 },
    );
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await db
      .delete(emailVerificationCodes)
      .where(eq(emailVerificationCodes.userId, user.id));
    return NextResponse.json(
      { error: "Too many attempts. Request a new code." },
      { status: 429 },
    );
  }

  const ok = await bcrypt.compare(code, row.codeHash);
  if (!ok) {
    await db
      .update(emailVerificationCodes)
      .set({ attempts: row.attempts + 1 })
      .where(eq(emailVerificationCodes.userId, user.id));
    return NextResponse.json({ error: "Incorrect or expired code." }, { status: 400 });
  }

  await db
    .update(users)
    .set({ emailVerified: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id));
  await db
    .delete(emailVerificationCodes)
    .where(eq(emailVerificationCodes.userId, user.id));

  return NextResponse.json({ ok: true });
}
