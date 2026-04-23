import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { getSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { getDictionary } from "@/lib/i18n/server";

interface Props {
  searchParams?: { next?: string };
}

export default async function SignupPage({ searchParams }: Props) {
  const session = await getSession();
  if (session?.user) {
    redirect(searchParams?.next ?? "/library");
  }
  const googleEnabled = Boolean(
    env.googleClientId && env.googleClientSecret,
  );
  const t = getDictionary();
  return (
    <AuthShell
      title={t.auth.signup.title}
      subtitle={t.auth.signup.subtitle}
      footer={
        <span>
          {t.auth.signup.alreadyAccount}{" "}
          <Link
            href={`/login${
              searchParams?.next ? `?next=${encodeURIComponent(searchParams.next)}` : ""
            }`}
            className="font-semibold text-ink-900 underline decoration-sky-300 underline-offset-4 hover:text-sky-600"
          >
            {t.auth.signup.login}
          </Link>
          .
        </span>
      }
    >
      <SignupForm googleEnabled={googleEnabled} />
    </AuthShell>
  );
}
