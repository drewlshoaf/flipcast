import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Best-effort like/dislike capture from the end-of-flip panel.
// Currently a no-op acknowledgement — persistence (DB column or per-user
// votes table) is a follow-up. The endpoint exists so the client ping has
// somewhere to land instead of 404'ing in the console.
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  let liked: unknown = null;
  try {
    const body = (await req.json()) as { liked?: unknown };
    liked = body?.liked;
  } catch {
    /* tolerate empty body */
  }
  if (typeof liked !== "boolean") {
    return NextResponse.json({ ok: false, ignored: true });
  }
  // Intentionally no-op for now. Add persistence here later.
  console.log(`[like] ${params.id} ${liked ? "👍" : "👎"}`);
  return NextResponse.json({ ok: true });
}
