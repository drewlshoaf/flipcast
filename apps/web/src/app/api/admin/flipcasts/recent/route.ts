import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { flipcastRequests } from "@flipcast/server-db";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin test panel data source. Returns the current admin's recent flipcast
// runs so the panel can list them and let the user pick which transcripts to
// combine. Intentionally lightweight — no transcript bodies; the panel
// fetches each selected transcript on-demand from
// /api/flipcasts/[id]/transcript when the user clicks Combine.
export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const userId = session.user!.id;

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") ?? "30");
  const limit = Number.isFinite(limitParam)
    ? Math.max(1, Math.min(100, Math.floor(limitParam)))
    : 30;

  const rows = await db
    .select({
      id: flipcastRequests.id,
      topic: flipcastRequests.topic,
      format: flipcastRequests.format,
      status: flipcastRequests.status,
      createdAt: flipcastRequests.createdAt,
      // welcomeAudioUrl is null in voiceless runs; lets the panel hint
      // which runs are "transcript-only" without storing a separate flag.
      welcomeAudioUrl: flipcastRequests.welcomeAudioUrl,
    })
    .from(flipcastRequests)
    .where(eq(flipcastRequests.userId, userId))
    .orderBy(desc(flipcastRequests.createdAt))
    .limit(limit);

  return NextResponse.json({ runs: rows });
}
