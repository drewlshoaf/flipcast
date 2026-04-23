import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { flipcastRequests } from "@flipcast/server-db";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

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

// User-initiated delete from /library. Scoped to the row's owner — admins
// who want to clean up other users' rows go through /api/admin/flipcasts/.
// S3 objects are intentionally orphaned; the bulk admin tools sweep those.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await db
    .delete(flipcastRequests)
    .where(
      and(
        eq(flipcastRequests.id, params.id),
        eq(flipcastRequests.userId, userId),
      ),
    )
    .returning({ id: flipcastRequests.id });

  if (result.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ deleted: params.id });
}
