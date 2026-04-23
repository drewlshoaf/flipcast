import { NextResponse } from "next/server";
import { flipcastRequests } from "@flipcast/server-db";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

// Bulk delete every flipcast request row. DB-only — S3 objects get orphaned
// exactly like the per-row DELETE endpoint. Admin-only; no-op guard-rail is
// client-side (confirm dialog) since the caller is a trusted admin surface.
export async function DELETE() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const result = await db
    .delete(flipcastRequests)
    .returning({ id: flipcastRequests.id });

  return NextResponse.json({ deleted: result.length });
}
