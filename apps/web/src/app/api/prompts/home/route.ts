import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { users } from "@flipcast/server-db";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/server";
import { loadHomePromptConcepts } from "@/lib/prompt-engine";
import { rankConcepts } from "@/lib/prompt-engine/score";
import type { RankedPromptConcept } from "@/lib/prompt-engine/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Home-page prompt feed. Thin wrapper over loadHomePromptConcepts with
// per-user interest bias applied on top of the shared cached set.
//   - ?refresh=1 bypasses and repopulates the cache (admin use).
//   - ?limit=N (default 16) caps what ships to the client; the full cached
//     set lives server-side for the admin debug page to inspect.

interface PromptsResponse {
  concepts: RankedPromptConcept[];
  generatedAt: string;
  model: string;
  locale: string;
  cached: boolean;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const refresh = url.searchParams.get("refresh") === "1";
  const limitParam = Number(url.searchParams.get("limit") ?? "16");
  const limit = Number.isFinite(limitParam)
    ? Math.max(1, Math.min(32, Math.floor(limitParam)))
    : 16;

  const locale = getLocale();

  let entry;
  try {
    entry = await loadHomePromptConcepts({ locale, refresh });
  } catch (err) {
    const message = err instanceof Error ? err.message : "generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Signed-in users get interest-biased re-ranking on top of the shared
  // cached set. Interests are user-private so we don't cache the biased
  // variant — just apply fresh.
  let concepts = entry.concepts;
  const session = await getSession();
  if (session?.user?.id) {
    const row = await db
      .select({ interests: users.interests })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    const interests = row[0]?.interests ?? [];
    if (interests.length > 0) {
      concepts = rankConcepts(entry.concepts, interests);
    }
  }

  const body: PromptsResponse = {
    concepts: concepts.slice(0, limit),
    generatedAt: entry.generatedAt,
    model: entry.model,
    locale,
    cached: entry.cached,
  };
  return NextResponse.json(body);
}
