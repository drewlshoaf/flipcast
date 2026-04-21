import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { flipcastRequests } from "@flipaudio/server-db";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// Recent successful flipcasts, surfaced as a lightweight "popular" feed on
// the home page. We don't track plays yet, so "popular" == "latest that
// completed" for now. Small payload, public by design — only the fields
// needed for the rolling list chip.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? "10");
  const limit = Number.isFinite(rawLimit)
    ? Math.min(50, Math.max(1, Math.floor(rawLimit)))
    : 10;

  const rows = await db
    .select({
      id: flipcastRequests.id,
      topic: flipcastRequests.topic,
      vibe: flipcastRequests.vibe,
      format: flipcastRequests.format,
      createdAt: flipcastRequests.createdAt,
    })
    .from(flipcastRequests)
    .where(
      and(
        eq(flipcastRequests.status, "complete"),
        eq(flipcastRequests.moderationStatus, "approved"),
      ),
    )
    .orderBy(desc(flipcastRequests.createdAt))
    .limit(limit);

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      topic: r.topic,
      vibe: r.vibe,
      format: r.format,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    })),
  });
}
