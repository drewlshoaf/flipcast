import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { flipcastRequests } from "@flipaudio/server-db";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserChip, type SessionUser } from "@/components/auth/user-chip";
import { ForMeRail } from "@/components/library/for-me-rail";

const FORMAT_LABEL: Record<string, string> = {
  newscast: "Anchor",
  pals: "Pals",
  panel: "Panel",
};

function statusBadge(status: string): { label: string; chip: string } {
  if (status === "complete") return { label: "Ready", chip: "chip-mint" };
  if (status === "failed" || status === "rejected")
    return { label: "Failed", chip: "chip chip-slate text-rose-700 ring-rose-200" };
  return { label: "In progress", chip: "chip-pink" };
}

function timeAgo(date: Date): string {
  const ms = Date.now() - date.getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default async function LibraryPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login?next=/library");
  }

  const sessionUser: SessionUser = {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
    isAdmin: session.user.isAdmin ?? false,
  };

  const rows = await db
    .select({
      id: flipcastRequests.id,
      topic: flipcastRequests.topic,
      format: flipcastRequests.format,
      vibe: flipcastRequests.vibe,
      status: flipcastRequests.status,
      createdAt: flipcastRequests.createdAt,
    })
    .from(flipcastRequests)
    .where(eq(flipcastRequests.userId, session.user.id))
    .orderBy(desc(flipcastRequests.createdAt))
    .limit(100);

  return (
    <div className="mx-auto max-w-[960px] px-6 py-6 md:px-10">
      <header className="mb-10 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-gradient shadow-glow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M7 5v14l12-7-12-7z" fill="white" />
            </svg>
          </span>
          <span className="text-base font-semibold tracking-tight text-ink-900">
            flip.audio
          </span>
        </Link>
        <UserChip user={sessionUser} />
      </header>

      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink-900">
            Your library
          </h1>
          <p className="mt-1 text-base text-ink-500">
            Every flip.audio you've made.
          </p>
        </div>
        <Link
          href="/studio"
          className="inline-flex h-11 items-center rounded-full bg-brand-gradient px-6 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.02]"
        >
          Make a new one
        </Link>
      </div>

      <div className="mb-8">
        <ForMeRail />
      </div>

      {rows.length === 0 ? (
        <div className="glass rounded-3xl p-10 text-center shadow-card">
          <div className="text-lg font-semibold text-ink-900">
            No casts yet.
          </div>
          <p className="mt-2 text-sm text-ink-500">
            Head into the studio and make your first one.
          </p>
          <Link
            href="/studio"
            className="mt-5 inline-flex h-11 items-center rounded-full bg-brand-gradient px-6 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.02]"
          >
            Open Studio
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => {
            const badge = statusBadge(r.status);
            const formatLabel = FORMAT_LABEL[r.format] ?? r.format;
            const playable = r.status === "complete";
            return (
              <li
                key={r.id}
                className="glass overflow-hidden rounded-3xl shadow-card transition hover:shadow-cardHover"
              >
                <Link
                  href={`/player/${r.id}`}
                  className={`flex items-center gap-4 p-5 ${
                    playable ? "" : "opacity-90"
                  }`}
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-gradient shadow-glow">
                    <svg width="16" height="16" viewBox="0 0 24 24">
                      <path d="M7 5v14l12-7-12-7z" fill="white" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold text-ink-900">
                      {r.topic}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <span className="chip chip-sky">{formatLabel}</span>
                      {r.vibe && (
                        <span className="chip chip-pink capitalize">
                          {r.vibe}
                        </span>
                      )}
                      <span className={`chip ${badge.chip}`}>
                        {badge.label}
                      </span>
                      <span className="text-ink-400">
                        · {timeAgo(new Date(r.createdAt))}
                      </span>
                    </div>
                  </div>
                  <span className="hidden text-sm font-medium text-ink-400 transition group-hover:text-ink-700 md:block">
                    Open →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
