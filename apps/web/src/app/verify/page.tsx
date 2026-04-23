import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyForm } from "@/components/auth/verify-form";
import { getSession } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";

interface Props {
  searchParams?: { email?: string; next?: string };
}

export default async function VerifyPage({ searchParams }: Props) {
  const session = await getSession();
  if (session?.user) {
    redirect(searchParams?.next ?? "/library");
  }
  const email = searchParams?.email ?? "";
  const next = searchParams?.next ?? "/library";
  const t = getDictionary();

  const subtitle = email
    ? t.auth.verify.subtitleWithEmail.replace("{email}", email)
    : t.auth.verify.subtitleNoEmail;

  return (
    <AuthShell
      title={t.auth.verify.title}
      subtitle={subtitle}
      footer={
        <span>
          {t.auth.verify.wrongEmail}{" "}
          <Link
            href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="font-semibold text-ink-900 underline decoration-sky-300 underline-offset-4 hover:text-sky-600"
          >
            {t.auth.verify.startOver}
          </Link>
          .
        </span>
      }
    >
      <VerifyForm email={email} next={next} />
    </AuthShell>
  );
}
