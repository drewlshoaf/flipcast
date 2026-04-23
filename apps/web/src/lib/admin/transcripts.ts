import { eq } from "drizzle-orm";
import {
  flipcastRequests,
  transcripts,
  transcriptSegments,
} from "@flipcast/server-db";
import { db } from "@/lib/db";

// Shared transcript formatter. Kept server-side so both the admin list
// page and the per-request transcript endpoint use identical output, and
// so test-studio can stitch N runs into a single document without
// diverging from the admin-detail view.

export interface FormattedTranscriptTurn {
  sceneIndex: number | null;
  sequenceNumber: number;
  speakerRole: string | null;
  speakerName: string | null;
  text: string;
}

export function formatTranscript(
  topic: string,
  welcomeText: string | null,
  turns: FormattedTranscriptTurn[],
): string {
  const lines: string[] = [];
  lines.push(`# ${topic}`);
  lines.push("");
  if (welcomeText) {
    lines.push("## Welcome");
    lines.push(welcomeText);
    lines.push("");
  }
  const byScene = new Map<number, FormattedTranscriptTurn[]>();
  for (const t of turns) {
    const s = t.sceneIndex ?? 0;
    if (!byScene.has(s)) byScene.set(s, []);
    byScene.get(s)!.push(t);
  }
  for (const sceneIndex of [...byScene.keys()].sort((a, b) => a - b)) {
    lines.push(`## Scene ${sceneIndex}`);
    for (const t of byScene.get(sceneIndex)!) {
      const name = t.speakerName ?? t.speakerRole ?? "—";
      lines.push(`[${name}] ${t.text}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

// Fetches + formats the transcript for a single flipcast request. Returns
// null when the request row is missing.
export async function buildTranscriptForRequest(
  requestId: string,
): Promise<{ topic: string; transcript: string } | null> {
  const row = await db.query.flipcastRequests.findFirst({
    where: eq(flipcastRequests.id, requestId),
  });
  if (!row) return null;

  const segs = await db
    .select({
      sceneIndex: transcriptSegments.sceneIndex,
      sequenceNumber: transcriptSegments.sequenceNumber,
      speakerRole: transcriptSegments.speakerRole,
      speakerName: transcriptSegments.speakerName,
      text: transcriptSegments.text,
    })
    .from(transcriptSegments)
    .innerJoin(
      transcripts,
      eq(transcriptSegments.transcriptId, transcripts.id),
    )
    .where(eq(transcripts.flipcastRequestId, requestId));

  const turns = segs.slice().sort((a, b) => {
    const sa = a.sceneIndex ?? 0;
    const sb = b.sceneIndex ?? 0;
    if (sa !== sb) return sa - sb;
    return a.sequenceNumber - b.sequenceNumber;
  });

  return {
    topic: row.topic,
    transcript: formatTranscript(row.topic, row.welcomeText ?? null, turns),
  };
}
