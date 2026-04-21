import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyForm } from "@/components/auth/verify-form";
import { getSession } from "@/lib/auth";

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

  return (
    <AuthShell
      title="One last step."
      subtitle={
        email
          ? `We sent a 6-digit code to ${email}. Enter it below to verify.`
          : "Enter the 6-digit code we sent to your email."
      }
      footer={
        <span>
          Wrong email?{" "}
          <Link
            href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="font-semibold text-ink-900 underline decoration-sky-300 underline-offset-4 hover:text-sky-600"
          >
            Start over
          </Link>
          .
        </span>
      }
    >
      <VerifyForm email={email} next={next} />
    </AuthShell>
  );
}
