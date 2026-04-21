import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ads, users } from "@flipaudio/server-db";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AdSlot {
  id: string;
  product: string;
  voice: string;
  url: string;
  durationSeconds: number;
  interests: string[];
  matchedInterests: string[];
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const countParam = Number(url.searchParams.get("count") ?? "5");
  const count = Number.isFinite(countParam)
    ? Math.max(1, Math.min(10, Math.floor(countParam)))
    : 5;

  // User's interests (if logged in) drive targeting.
  let userInterests: string[] = [];
  const session = await getSession();
  if (session?.user?.id) {
    const rows = await db
      .select({ interests: users.interests })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    userInterests = rows[0]?.interests ?? [];
  }

  const activeAds = await db
    .select({
      id: ads.id,
      product: ads.product,
      voiceId: ads.voiceId,
      audioUrl: ads.audioUrl,
      durationSeconds: ads.durationSeconds,
      interests: ads.interests,
    })
    .from(ads)
    .where(eq(ads.active, true));

  if (activeAds.length === 0) {
    // Fallback to baked-in static ads if DB is empty.
    const fallback: AdSlot[] = Array.from({ length: count }, (_, i) => ({
      id: `static-${i}`,
      product: `Sponsor ${i + 1}`,
      voice: "static",
      url: `/ads/ad-${(i % 6) + 1}.mp3`,
      durationSeconds: 25,
      interests: [],
      matchedInterests: [],
    }));
    return NextResponse.json({ ads: fallback, targeted: false });
  }

  // Score: count of overlap with user interests. Shuffle within each score bucket.
  const interestSet = new Set(userInterests);
  const scored = activeAds.map((a) => {
    const overlap = a.interests.filter((t) => interestSet.has(t));
    return { ad: a, score: overlap.length, overlap };
  });

  const grouped = new Map<number, typeof scored>();
  for (const row of scored) {
    const list = grouped.get(row.score) ?? [];
    list.push(row);
    grouped.set(row.score, list);
  }
  const buckets = [...grouped.keys()].sort((a, b) => b - a);
  const ordered: typeof scored = [];
  for (const k of buckets) ordered.push(...shuffle(grouped.get(k)!));

  // Take `count`, but if we have more than count, prefer no immediate repeats by
  // skipping any duplicate ad ids we've already added.
  const seen = new Set<string>();
  const picks: typeof scored = [];
  for (const r of ordered) {
    if (seen.has(r.ad.id)) continue;
    picks.push(r);
    seen.add(r.ad.id);
    if (picks.length >= count) break;
  }
  // If still under count (small inventory), cycle through ordered to fill.
  let cycle = 0;
  while (picks.length < count && ordered.length > 0) {
    picks.push(ordered[cycle % ordered.length]!);
    cycle++;
  }

  const out: AdSlot[] = picks.map((p) => ({
    id: p.ad.id,
    product: p.ad.product,
    voice: p.ad.voiceId,
    url: p.ad.audioUrl,
    durationSeconds: p.ad.durationSeconds,
    interests: p.ad.interests,
    matchedInterests: p.overlap,
  }));

  return NextResponse.json({
    ads: out,
    targeted: userInterests.length > 0,
    userInterests,
  });
}
