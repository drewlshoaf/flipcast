import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { sanitizeInterests } from "@flipaudio/types";
import { users } from "@flipaudio/server-db";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { interests?: unknown };
  try {
    body = (await req.json()) as { interests?: unknown };
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const interests = sanitizeInterests(body.interests);
  await db
    .update(users)
    .set({ interests, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ interests });
}
