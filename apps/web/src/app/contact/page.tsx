import { StaticPage } from "@/components/shared/static-page";
import { getSession } from "@/lib/auth";
import type { SessionUser } from "@/components/auth/user-chip";

export default async function ContactPage() {
  const session = await getSession();
  const sessionUser: SessionUser | null = session?.user
    ? {
        id: session.user.id,
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
        isAdmin: session.user.isAdmin ?? false,
      }
    : null;

  return (
    <StaticPage
      sessionUser={sessionUser}
      title="Contact"
      intro="We'd love to hear from you."
    >
      <p>
        For partnerships, press, or general questions, email{" "}
        <a href="mailto:hello@flipcast.fm" className="font-medium text-ink-900 underline decoration-pink-300 underline-offset-4 hover:decoration-pink-500">
          hello@flipcast.fm
        </a>
        .
      </p>
    </StaticPage>
  );
}
