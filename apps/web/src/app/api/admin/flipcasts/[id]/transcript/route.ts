import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { buildTranscriptForRequest } from "@/lib/admin/transcripts";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const result = await buildTranscriptForRequest(params.id);
  if (!result) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}
