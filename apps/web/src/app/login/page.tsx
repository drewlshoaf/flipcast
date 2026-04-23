import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { getSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { getDictionary } from "@/lib/i18n/server";

interface Props {
  searchParams?: { next?: string };
}

export default async function LoginPage({ searchParams }: Props) {
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
      title={t.auth.login.title}
      subtitle={t.auth.login.subtitle}
      footer={
        <span>
          {t.auth.login.newHere}{" "}
          <Link
            href={`/signup${
              searchParams?.next ? `?next=${encodeURIComponent(searchParams.next)}` : ""
            }`}
            className="font-semibold text-ink-900 underline decoration-pink-300 underline-offset-4 hover:text-pink-600"
          >
            {t.auth.login.createAccount}
          </Link>
          .
        </span>
      }
    >
      <LoginForm googleEnabled={googleEnabled} />
    </AuthShell>
  );
}
