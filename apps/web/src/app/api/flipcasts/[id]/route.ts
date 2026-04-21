import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { flipcastRequests } from "@flipaudio/server-db";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const row = await db.query.flipcastRequests.findFirst({
    where: eq(flipcastRequests.id, params.id),
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(row);
}
