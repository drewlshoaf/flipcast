import Link from "next/link";
import { getDictionary, getLocale } from "@/lib/i18n/server";

// Global site footer — mounted once in the root layout so every page
// gets the same chrome. Server component so the dictionary and the
// current year are resolved at render time on the server.
export function SiteFooter() {
  const locale = getLocale();
  const t = getDictionary(locale).siteFooter;
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-slate-200/70 bg-white/40 backdrop-blur-sm">
      <div className="mx-auto max-w-[1320px] px-6 py-12 md:px-10">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          {/* Brand block */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-2xl bg-brand-gradient shadow-glow">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M7 5v14l12-7-12-7z" fill="white" />
                </svg>
              </span>
              <span className="text-base font-semibold tracking-tight text-ink-900">
                flipcast
              </span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-500">
              {t.tagline}
            </p>
          </div>

          <FooterColumn
            heading={t.product.heading}
            links={[
              { label: t.product.home, href: "/" },
              { label: t.product.studio, href: "/studio" },
              { label: t.product.library, href: "/library" },
            ]}
          />

          <FooterColumn
            heading={t.company.heading}
            links={[
              { label: t.company.about, href: "/about" },
              { label: t.company.useOfAi, href: "/use-of-ai" },
              { label: t.company.contact, href: "/contact" },
            ]}
          />

          <FooterColumn
            heading={t.legal.heading}
            links={[
              { label: t.legal.terms, href: "/terms" },
              { label: t.legal.privacy, href: "/privacy" },
              { label: t.legal.cookies, href: "/cookies" },
            ]}
          />
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-slate-200/70 pt-6 text-xs text-ink-400 md:flex-row md:items-center">
          <span>{t.copyright.replace("{year}", String(year))}</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  heading,
  links,
}: {
  heading: string;
  links: Array<{ label: string; href: string }>;
}) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">
        {heading}
      </h2>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-sm text-ink-700 transition hover:text-ink-900"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
