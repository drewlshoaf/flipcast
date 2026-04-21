import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { users } from "@flipaudio/server-db";
import { db } from "@/lib/db";
import { issueVerificationCode } from "@/lib/verification";

export const runtime = "nodejs";

interface ResendBody {
  email?: string;
}

export async function POST(req: Request) {
  let body: ResendBody;
  try {
    body = (await req.json()) as ResendBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email required." }, { status: 400 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  // Always respond 200 to avoid leaking whether an email exists; only issue a
  // new code if the user actually exists and isn't already verified.
  if (user && !user.emailVerified) {
    await issueVerificationCode(user.id, email);
  }
  return NextResponse.json({ ok: true });
}
