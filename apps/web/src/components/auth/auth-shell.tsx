import Link from "next/link";

interface Props {
  title: string;
  subtitle?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function AuthShell({ title, subtitle, footer, children }: Props) {
  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] flex-col px-6 py-10">
      <header className="mb-10">
        <Link href="/" className="inline-flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-gradient shadow-glow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M7 5v14l12-7-12-7z" fill="white" />
            </svg>
          </span>
          <span className="text-base font-semibold tracking-tight text-ink-900">
            flip.audio
          </span>
        </Link>
      </header>

      <main className="flex flex-1 flex-col">
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-base text-ink-500">{subtitle}</p>
        )}
        <div className="mt-8 glass rounded-[28px] p-6 shadow-card">
          {children}
        </div>
        {footer && (
          <div className="mt-6 text-sm text-ink-500">{footer}</div>
        )}
      </main>
    </div>
  );
}
