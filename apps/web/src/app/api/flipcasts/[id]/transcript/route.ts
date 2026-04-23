import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import {
  flipcastRequests,
  transcripts,
  transcriptSegments,
} from "@flipcast/server-db";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only: returns structured scene turns + character list for a cast.
// Used by the standalone player to render the transcript rail. Kept behind
// an admin gate because it exposes raw (tag-annotated) turn text.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const request = await db.query.flipcastRequests.findFirst({
    where: eq(flipcastRequests.id, params.id),
  });
  if (!request) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const transcript = await db.query.transcripts.findFirst({
    where: eq(transcripts.flipcastRequestId, params.id),
  });

  const sceneTurns: Record<number, {
    sequence: number;
    speaker: string;
    text: string;
  }[]> = {};
  const characters =
    (transcript?.characters as unknown as {
      role: string;
      name: string;
      voiceLabel?: string;
    }[] | null) ?? null;

  if (transcript) {
    const segments = await db
      .select({
        sceneIndex: transcriptSegments.sceneIndex,
        sequence: transcriptSegments.sequenceNumber,
        speaker: transcriptSegments.speakerRole,
        text: transcriptSegments.text,
      })
      .from(transcriptSegments)
      .where(
        and(
          eq(transcriptSegments.transcriptId, transcript.id),
          eq(transcriptSegments.isAdSegment, false),
        ),
      )
      .orderBy(
        asc(transcriptSegments.sceneIndex),
        asc(transcriptSegments.sequenceNumber),
      );

    for (const s of segments) {
      if (s.sceneIndex == null) continue;
      const list = sceneTurns[s.sceneIndex] ?? [];
      list.push({
        sequence: s.sequence,
        speaker: s.speaker,
        text: s.text,
      });
      sceneTurns[s.sceneIndex] = list;
    }
  }

  return NextResponse.json({
    sceneTurns,
    characters,
    welcomeText: request.welcomeText,
  });
}
