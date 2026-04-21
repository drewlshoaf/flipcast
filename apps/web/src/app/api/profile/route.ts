import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { users } from "@flipaudio/server-db";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { name?: string };
  try {
    body = (await req.json()) as { name?: string };
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const name =
    typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  await db
    .update(users)
    .set({ name: name.length > 0 ? name : null, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ name: name.length > 0 ? name : null });
}
