import { StaticPage } from "@/components/shared/static-page";
import { getSession } from "@/lib/auth";
import type { SessionUser } from "@/components/auth/user-chip";

export default async function AboutPage() {
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
      title="About Flipcast"
      intro="Flipcast is an on-demand podcast company. You make the show, we produce the episode."
    >
      <p>
        We believe audio is the most intimate medium on the internet — and
        that anyone should be able to spin up a show about whatever is on
        their mind in the moment. Flipcast turns a prompt into a produced
        episode in minutes.
      </p>
      <p className="mt-4 text-sm text-ink-400">
        More to come here — we're drafting a proper About page.
      </p>
    </StaticPage>
  );
}
