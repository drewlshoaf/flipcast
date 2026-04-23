import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { flipcastRequests, users } from "@flipcast/server-db";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { UserChip, type SessionUser } from "@/components/auth/user-chip";
import { TestStudioClient, type SourceRun } from "@/components/admin/test-studio-client";

export default async function TestStudioPage() {
  const session = await requireAdmin();
  if (!session) redirect("/login?next=/admin/test-studio");

  const sessionUser: SessionUser = {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
    isAdmin: true,
  };

  // Pull the last 50 *completed* flipcasts across all users; the client will
  // let the admin pick a smaller subset to re-run. Completed-only so we're
  // replaying things that are known-good.
  const rows = await db
    .select({
      id: flipcastRequests.id,
      topic: flipcastRequests.topic,
      format: flipcastRequests.format,
      locale: flipcastRequests.locale,
      moderatorVoiceId: flipcastRequests.moderatorVoiceId,
      panelist1VoiceId: flipcastRequests.panelist1VoiceId,
      panelist2VoiceId: flipcastRequests.panelist2VoiceId,
      engine: flipcastRequests.engine,
      requestedDurationSecondsTarget:
        flipcastRequests.requestedDurationSecondsTarget,
      createdAt: flipcastRequests.createdAt,
      ownerEmail: users.email,
    })
    .from(flipcastRequests)
    .leftJoin(users, eq(flipcastRequests.userId, users.id))
    .where(eq(flipcastRequests.status, "complete"))
    .orderBy(desc(flipcastRequests.createdAt))
    .limit(50);

  const sourceRuns: SourceRun[] = rows.map((r) => ({
    id: r.id,
    topic: r.topic,
    format: r.format,
    locale: r.locale ?? "en",
    engine: r.engine,
    voiceIds: [
      r.moderatorVoiceId,
      r.panelist1VoiceId,
      r.panelist2VoiceId,
    ].filter((v): v is string => !!v),
    lengthMinutes: Math.round(r.requestedDurationSecondsTarget / 60),
    createdAt:
      r.createdAt instanceof Date
        ? r.createdAt.toISOString()
        : String(r.createdAt),
    ownerEmail: r.ownerEmail ?? null,
  }));

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6 md:px-10">
      <header className="mb-8 flex items-center justify-between">
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
        <Link
          href="/admin/flipcasts"
          className="rounded-full px-4 py-1.5 text-sm font-medium text-ink-500 ring-1 ring-transparent hover:bg-ink-50 hover:text-ink-900"
        >
          Flipcasts
        </Link>
        <span className="rounded-full bg-ink-900 px-4 py-1.5 text-sm font-semibold text-white">
          Test Studio
        </span>
        <Link
          href="/admin/prompts"
          className="rounded-full px-4 py-1.5 text-sm font-medium text-ink-500 ring-1 ring-transparent hover:bg-ink-50 hover:text-ink-900"
        >
          Prompt Engine
        </Link>
      </nav>

      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900">
          Test Studio
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Replay recent completed flipcasts in a serial queue. Each run uses
          the source's topic, format, locale, and voice picks. Transcripts
          stream into a single document you can copy at the end.
        </p>
      </div>

      <TestStudioClient sourceRuns={sourceRuns} />
    </div>
  );
}
