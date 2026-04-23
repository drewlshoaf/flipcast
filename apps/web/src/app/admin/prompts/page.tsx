import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { UserChip, type SessionUser } from "@/components/auth/user-chip";
import { PromptEngineDebug } from "@/components/admin/prompt-engine-debug";
import { AUDIENCES } from "@/lib/prompt-engine/audiences";
import { MODES } from "@/lib/prompt-engine/modes";
import { TRIGGERS } from "@/lib/prompt-engine/triggers";

export default async function AdminPromptsPage() {
  const session = await requireAdmin();
  if (!session) redirect("/login?next=/admin/prompts");

  const sessionUser: SessionUser = {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
    isAdmin: true,
  };

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
        <Link
          href="/admin/test-studio"
          className="rounded-full px-4 py-1.5 text-sm font-medium text-ink-500 ring-1 ring-transparent hover:bg-ink-50 hover:text-ink-900"
        >
          Test Studio
        </Link>
        <span className="rounded-full bg-ink-900 px-4 py-1.5 text-sm font-semibold text-white">
          Prompt Engine
        </span>
      </nav>

      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900">
          Prompt Engine
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Stage-1 audience-fit prompt generation. Run a fresh batch, inspect
          raw Claude output + self-scores, see what the filter drops and why.
          Locale follows the app-level EN/ES toggle.
        </p>
      </div>

      <PromptEngineDebug
        audiences={AUDIENCES.map((a) => ({ id: a.id, label: a.label }))}
        modes={MODES.map((m) => ({ id: m.id, label: m.label }))}
        triggers={TRIGGERS.map((t) => ({ id: t.id, label: t.label }))}
      />
    </div>
  );
}
