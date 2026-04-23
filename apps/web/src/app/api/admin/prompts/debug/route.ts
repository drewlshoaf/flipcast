import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/server";
import { generatePromptConcepts } from "@/lib/prompt-engine/generate";
import { rankConcepts } from "@/lib/prompt-engine/score";
import { filterBatch } from "@/lib/prompt-engine/filter";
import { AUDIENCE_IDS, type AudienceId } from "@/lib/prompt-engine/audiences";
import { MODE_IDS, type ModeId } from "@/lib/prompt-engine/modes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only raw-output view of the prompt engine. Bypasses the cache so
// every call is a fresh generation — admin can inspect what Claude emits,
// which items get rejected by the filter, and tweak the primitives before
// the home page consumes the output.

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    batchSize?: number;
    audiences?: string[];
    modes?: string[];
    interestBias?: string[];
  };

  const locale = getLocale();
  const audienceFilter = Array.isArray(body.audiences)
    ? (body.audiences.filter((a) =>
        (AUDIENCE_IDS as readonly string[]).includes(a),
      ) as AudienceId[])
    : undefined;
  const modeFilter = Array.isArray(body.modes)
    ? (body.modes.filter((m) =>
        (MODE_IDS as readonly string[]).includes(m),
      ) as ModeId[])
    : undefined;

  try {
    const gen = await generatePromptConcepts({
      locale,
      batchSize: body.batchSize,
      audienceFilter:
        audienceFilter && audienceFilter.length > 0 ? audienceFilter : undefined,
      modeFilter: modeFilter && modeFilter.length > 0 ? modeFilter : undefined,
      interestBias: body.interestBias,
    });
    const ranked = rankConcepts(gen.concepts, body.interestBias);
    const filtered = filterBatch(ranked);
    return NextResponse.json({
      locale,
      model: gen.model,
      kept: filtered.kept,
      rejected: filtered.rejected,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
