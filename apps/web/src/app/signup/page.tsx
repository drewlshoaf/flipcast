import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { getSession } from "@/lib/auth";
import { env } from "@/lib/env";

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
  return (
    <AuthShell
      title="Make the shows you want to hear."
      subtitle="Your library, saved and ready whenever you are."
      footer={
        <span>
          Already have an account?{" "}
          <Link
            href={`/login${
              searchParams?.next ? `?next=${encodeURIComponent(searchParams.next)}` : ""
            }`}
            className="font-semibold text-ink-900 underline decoration-sky-300 underline-offset-4 hover:text-sky-600"
          >
            Log in
          </Link>
          .
        </span>
      }
    >
      <SignupForm googleEnabled={googleEnabled} />
    </AuthShell>
  );
}
