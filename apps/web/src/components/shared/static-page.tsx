import Link from "next/link";
import { UserChip, type SessionUser } from "@/components/auth/user-chip";

// Minimal shell for marketing / legal pages (about, terms, privacy, etc.).
// Keeps the global banner consistent and leaves the body open to a simple
// prose article. Real copy is a follow-up; for now each page passes a
// short placeholder body so the routes render instead of 404-ing.
interface Props {
  title: string;
  intro?: string;
  sessionUser: SessionUser | null;
  children?: React.ReactNode;
}

export function StaticPage({ title, intro, sessionUser, children }: Props) {
  return (
    <div className="mx-auto max-w-[880px] px-6 pt-8 pb-16 md:px-10">
      <header className="mb-12 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-brand-gradient shadow-glow">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M7 5v14l12-7-12-7z" fill="white" />
            </svg>
          </span>
          <span className="text-base font-semibold tracking-tight text-ink-900">
            flipcast
          </span>
        </Link>
        <UserChip user={sessionUser} />
      </header>

      <article className="prose prose-slate max-w-none">
        <h1 className="text-4xl font-semibold tracking-tight text-ink-900 md:text-5xl">
          {title}
        </h1>
        {intro && (
          <p className="mt-4 text-lg leading-relaxed text-ink-500">{intro}</p>
        )}
        {children && <div className="mt-8 text-base leading-relaxed text-ink-700">{children}</div>}
      </article>
    </div>
  );
}
