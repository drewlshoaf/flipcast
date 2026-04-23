import { StaticPage } from "@/components/shared/static-page";
import { getSession } from "@/lib/auth";
import type { SessionUser } from "@/components/auth/user-chip";

export default async function UseOfAiPage() {
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
      title="How Flipcast uses AI"
      intro="Every Flipcast episode is produced with generative models. Here's how we think about it."
    >
      <p>
        We use AI to draft scripts, select voices, and produce the final
        mix. A human editorial layer sets the house style, picks the
        formats, and reviews outputs for quality. Episodes are generated
        on demand from your prompt — they are not recordings of real
        people unless explicitly labeled as such.
      </p>
      <p className="mt-4 text-sm text-ink-400">
        Full disclosures — models used, data handling, and opt-out controls — are being drafted.
      </p>
    </StaticPage>
  );
}
