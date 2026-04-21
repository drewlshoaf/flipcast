import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { flipcastRequests } from "@flipaudio/server-db";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const result = await db
    .delete(flipcastRequests)
    .where(eq(flipcastRequests.id, id))
    .returning({ id: flipcastRequests.id });

  if (result.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ deleted: id });
}
