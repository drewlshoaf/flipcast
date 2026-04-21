import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { users } from "@flipcast/server-db";
import { db } from "@/lib/db";
import { issueVerificationCode } from "@/lib/verification";

export const runtime = "nodejs";

interface SignupBody {
  email?: string;
  password?: string;
  name?: string;
}

export async function POST(req: Request) {
  let body: SignupBody;
  try {
    body = (await req.json()) as SignupBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body.password ?? "");
  const name = body.name ? String(body.name).trim().slice(0, 80) : null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email." },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists. Try logging in." },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [row] = await db
    .insert(users)
    .values({ email, passwordHash, name: name ?? undefined })
    .returning({ id: users.id });

  if (!row) {
    return NextResponse.json(
      { error: "Failed to create account." },
      { status: 500 },
    );
  }

  await issueVerificationCode(row.id, email);

  return NextResponse.json(
    { id: row.id, requiresVerification: true },
    { status: 201 },
  );
}
