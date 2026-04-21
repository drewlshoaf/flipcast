import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { getSession } from "@/lib/auth";
import { env } from "@/lib/env";

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
  return (
    <AuthShell
      title="Welcome back."
      subtitle="Log in to keep your library of Flipcasts."
      footer={
        <span>
          New here?{" "}
          <Link
            href={`/signup${
              searchParams?.next ? `?next=${encodeURIComponent(searchParams.next)}` : ""
            }`}
            className="font-semibold text-ink-900 underline decoration-pink-300 underline-offset-4 hover:text-pink-600"
          >
            Create an account
          </Link>
          .
        </span>
      }
    >
      <LoginForm googleEnabled={googleEnabled} />
    </AuthShell>
  );
}
