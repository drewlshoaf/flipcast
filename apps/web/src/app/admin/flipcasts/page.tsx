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
  ttsCostUsd,
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
  "Thanks for choosing flipcast. We're assembling your flipcast and will be with you shortly — right after these short ads.";

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
      sequenceNumber: transcriptSegments.sequenceNumber,
      speakerRole: transcriptSegments.speakerRole,
      speakerName: transcriptSegments.speakerName,
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
  // requestId -> ordered turns (used to render the full transcript in the
  // admin detail view).
  interface TranscriptTurn {
    sceneIndex: number | null;
    sequenceNumber: number;
    speakerRole: string | null;
    speakerName: string | null;
    text: string;
  }
  const turnsByRequest = new Map<string, TranscriptTurn[]>();
  for (const r of segRows) {
    if (!r.flipcastRequestId) continue;
    let m = sceneChars.get(r.flipcastRequestId);
    if (!m) {
      m = new Map();
      sceneChars.set(r.flipcastRequestId, m);
    }
    const scene = r.sceneIndex ?? 0;
    m.set(scene, (m.get(scene) ?? 0) + (r.text?.length ?? 0));

    let list = turnsByRequest.get(r.flipcastRequestId);
    if (!list) {
      list = [];
      turnsByRequest.set(r.flipcastRequestId, list);
    }
    list.push({
      sceneIndex: r.sceneIndex,
      sequenceNumber: r.sequenceNumber,
      speakerRole: r.speakerRole,
      speakerName: r.speakerName,
      text: r.text,
    });
  }
  for (const list of turnsByRequest.values()) {
    list.sort((a, b) => {
      const sa = a.sceneIndex ?? 0;
      const sb = b.sceneIndex ?? 0;
      if (sa !== sb) return sa - sb;
      return a.sequenceNumber - b.sequenceNumber;
    });
  }

  function formatTranscript(
    topic: string,
    welcomeText: string | null,
    turns: TranscriptTurn[],
  ): string {
    const lines: string[] = [];
    lines.push(`# ${topic}`);
    lines.push("");
    if (welcomeText) {
      lines.push("## Welcome");
      lines.push(welcomeText);
      lines.push("");
    }
    const byScene = new Map<number, TranscriptTurn[]>();
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

    const transcript = formatTranscript(
      r.topic,
      r.welcomeText ?? null,
      turnsByRequest.get(r.id) ?? [],
    );

    return {
      id: r.id,
      createdAt:
        r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : String(r.createdAt),
      ownerEmail: r.ownerEmail ?? null,
      topic: r.topic,
      format: r.format,
      status: r.status,
      durationTargetSeconds: r.durationSecondsTarget,
      items,
      sceneCount,
      adCount,
      adChars,
      sceneChars: sceneChars_,
      totalChars,
      claudeCostUsd: claudeUsage ? claudeCostUsd(claudeUsage) : null,
      fishCostUsd: ttsCostUsd(sceneChars_),
      claudeUsage,
      transcript,
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
            flipcast · Admin
          </span>
        </Link>
        <UserChip user={sessionUser} />
      </header>

      <nav className="mb-6 flex gap-1">
        <span className="rounded-full bg-ink-900 px-4 py-1.5 text-sm font-semibold text-white">
          Flipcasts
        </span>
        <Link
          href="/admin/test-studio"
          className="rounded-full px-4 py-1.5 text-sm font-medium text-ink-500 ring-1 ring-transparent hover:bg-ink-50 hover:text-ink-900"
        >
          Test Studio
        </Link>
        <Link
          href="/admin/prompts"
          className="rounded-full px-4 py-1.5 text-sm font-medium text-ink-500 ring-1 ring-transparent hover:bg-ink-50 hover:text-ink-900"
        >
          Prompt Engine
        </Link>
      </nav>

      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900">
          All Flipcasts
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {rows.length} request{rows.length === 1 ? "" : "s"}. Scene character
          counts are actual transcript length; ad characters come from the
          pre-recorded ad pool (slot i → ad-{"{"}i+1{"}"}). Fish TTS cost is on
          scene + welcome characters only — ads are pre-recorded and not
          re-synthesized per flipcast.
        </p>
      </div>

      <FlipcastsAdminTable rows={rows} />
    </div>
  );
}
