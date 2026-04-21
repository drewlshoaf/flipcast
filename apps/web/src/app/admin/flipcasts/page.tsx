import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import {
  flipcastRequests,
  users,
  transcripts,
  transcriptSegments,
  audioAssets,
} from "@flipcast/server-db";
import {
  AD_SECONDS,
  STATION_INTRO_SECONDS,
  WELCOME_ESTIMATE_SECONDS,
  adForSlot,
  claudeCostUsd,
  elevenLabsCostUsd,
  planSequence,
  type ClaudeUsageAggregate,
} from "@flipcast/types";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { UserChip, type SessionUser } from "@/components/auth/user-chip";
import {
  FlipcastsAdminTable,
  type AdminFlipcastRow,
  type AdminItem,
} from "@/components/admin/flipcasts-table";

const STATION_INTRO_TEXT =
  "Thanks for choosing Flipcast. We're assembling your Flipcast and will be with you shortly — right after these short ads.";

export default async function AdminFlipcastsPage() {
  const session = await requireAdmin();
  if (!session) redirect("/login?next=/admin/flipcasts");

  const sessionUser: SessionUser = {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
    isAdmin: true,
  };

  const requestRows = await db
    .select({
      id: flipcastRequests.id,
      topic: flipcastRequests.topic,
      format: flipcastRequests.format,
      vibe: flipcastRequests.vibe,
      status: flipcastRequests.status,
      createdAt: flipcastRequests.createdAt,
      welcomeText: flipcastRequests.welcomeText,
      claudeUsage: flipcastRequests.claudeUsage,
      durationSecondsTarget: flipcastRequests.requestedDurationSecondsTarget,
      ownerEmail: users.email,
    })
    .from(flipcastRequests)
    .leftJoin(users, eq(flipcastRequests.userId, users.id))
    .orderBy(desc(flipcastRequests.createdAt))
    .limit(500);

  const segRows = await db
    .select({
      flipcastRequestId: transcripts.flipcastRequestId,
      sceneIndex: transcriptSegments.sceneIndex,
      text: transcriptSegments.text,
    })
    .from(transcriptSegments)
    .innerJoin(
      transcripts,
      eq(transcriptSegments.transcriptId, transcripts.id),
    );

  const assetRows = await db
    .select({
      flipcastRequestId: audioAssets.flipcastRequestId,
      assetType: audioAssets.assetType,
      sceneIndex: audioAssets.sceneIndex,
      durationMs: audioAssets.durationMs,
    })
    .from(audioAssets);

  // requestId -> sceneIndex -> char count
  const sceneChars = new Map<string, Map<number, number>>();
  for (const r of segRows) {
    if (!r.flipcastRequestId) continue;
    let m = sceneChars.get(r.flipcastRequestId);
    if (!m) {
      m = new Map();
      sceneChars.set(r.flipcastRequestId, m);
    }
    const scene = r.sceneIndex ?? 0;
    m.set(scene, (m.get(scene) ?? 0) + (r.text?.length ?? 0));
  }

  // requestId -> asset lookup
  const welcomeDurMs = new Map<string, number>();
  const sceneDurMs = new Map<string, Map<number, number>>();
  for (const a of assetRows) {
    if (!a.durationMs) continue;
    if (a.assetType === "welcome") {
      welcomeDurMs.set(a.flipcastRequestId, a.durationMs);
    } else if (a.assetType === "scene" && a.sceneIndex != null) {
      let m = sceneDurMs.get(a.flipcastRequestId);
      if (!m) {
        m = new Map();
        sceneDurMs.set(a.flipcastRequestId, m);
      }
      m.set(a.sceneIndex, a.durationMs);
    }
  }

  const plan = planSequence();

  const rows: AdminFlipcastRow[] = requestRows.map((r) => {
    const sceneCharMap = sceneChars.get(r.id) ?? new Map<number, number>();
    const sceneDurMap = sceneDurMs.get(r.id) ?? new Map<number, number>();
    const welcomeChars = r.welcomeText?.length ?? 0;
    const welcomeDurSec = welcomeDurMs.has(r.id)
      ? (welcomeDurMs.get(r.id) as number) / 1000
      : WELCOME_ESTIMATE_SECONDS;

    // Walk the plan sequence and produce one breakdown row per item, pairing
    // each with its actual char count + duration.
    const items: AdminItem[] = plan.items.map((it) => {
      if (it.kind === "station_intro") {
        return {
          kind: "station_intro",
          label: "Station intro",
          chars: STATION_INTRO_TEXT.length,
          durationSec: STATION_INTRO_SECONDS,
        };
      }
      if (it.kind === "ad") {
        const ad = adForSlot(it.adIndex);
        return {
          kind: "ad",
          label: `Ad ${it.adIndex + 1} — ${ad.product}`,
          chars: ad.text.length,
          durationSec: AD_SECONDS,
        };
      }
      if (it.kind === "welcome") {
        return {
          kind: "welcome",
          label: "Welcome",
          chars: welcomeChars,
          durationSec: welcomeDurSec,
        };
      }
      const dur = sceneDurMap.get(it.sceneIndex);
      return {
        kind: "scene",
        label: it.isFinal
          ? `Scene ${it.sceneIndex} (closing)`
          : `Scene ${it.sceneIndex}`,
        chars: sceneCharMap.get(it.sceneIndex) ?? 0,
        durationSec: dur != null ? dur / 1000 : it.targetSeconds,
      };
    });

    const adChars = items
      .filter((i) => i.kind === "ad")
      .reduce((s, i) => s + i.chars, 0);
    // Scenes including welcome, per the user's definition.
    const sceneChars_ = items
      .filter((i) => i.kind === "scene" || i.kind === "welcome")
      .reduce((s, i) => s + i.chars, 0);
    const totalChars = adChars + sceneChars_ + STATION_INTRO_TEXT.length;
    const sceneCount = items.filter(
      (i) => i.kind === "scene" || i.kind === "welcome",
    ).length;
    const adCount = items.filter((i) => i.kind === "ad").length;

    const claudeUsage =
      (r.claudeUsage as ClaudeUsageAggregate | null) ?? null;

    return {
      id: r.id,
      createdAt:
        r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : String(r.createdAt),
      ownerEmail: r.ownerEmail ?? null,
      topic: r.topic,
      format: r.format,
      vibe: r.vibe ?? null,
      status: r.status,
      durationTargetSeconds: r.durationSecondsTarget,
      items,
      sceneCount,
      adCount,
      adChars,
      sceneChars: sceneChars_,
      totalChars,
      claudeCostUsd: claudeUsage ? claudeCostUsd(claudeUsage) : null,
      elevenLabsCostUsd: elevenLabsCostUsd(sceneChars_),
      claudeUsage,
    };
  });

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6 md:px-10">
      <header className="mb-10 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-gradient shadow-glow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M7 5v14l12-7-12-7z" fill="white" />
            </svg>
          </span>
          <span className="text-base font-semibold tracking-tight text-ink-900">
            Flipcast · Admin
          </span>
        </Link>
        <UserChip user={sessionUser} />
      </header>

      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900">
          All Flipcasts
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {rows.length} request{rows.length === 1 ? "" : "s"}. Scene character
          counts are actual transcript length; ad characters come from the
          pre-recorded ad pool (slot i → ad-{"{"}i+1{"}"}). 11Labs cost is on
          scene + welcome characters only — ads are pre-recorded and not
          re-synthesized per flipcast.
        </p>
      </div>

      <FlipcastsAdminTable rows={rows} />
    </div>
  );
}
