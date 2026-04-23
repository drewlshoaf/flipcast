import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { flipcastRequests } from "@flipcast/server-db";
import { db } from "@/lib/db";
import { s3 } from "@/lib/s3";
import { env } from "@/lib/env";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;

  // Delete every S3 object under requests/{id}/ (paginated; DeleteObjects caps
  // at 1000 keys per call).
  const client = s3();
  let continuationToken: string | undefined = undefined;
  let deletedCount = 0;
  do {
    const list = await client.send(
      new ListObjectsV2Command({
        Bucket: env.s3Bucket,
        Prefix: `requests/${id}/`,
        ContinuationToken: continuationToken,
      }),
    );
    const keys = (list.Contents ?? [])
      .map((o) => o.Key)
      .filter((k): k is string => !!k);
    if (keys.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: env.s3Bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      deletedCount += keys.length;
    }
    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);

  const result = await db
    .delete(flipcastRequests)
    .where(eq(flipcastRequests.id, id))
    .returning({ id: flipcastRequests.id });

  if (result.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ purged: id, s3Objects: deletedCount });
}
