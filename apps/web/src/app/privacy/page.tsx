import { StaticPage } from "@/components/shared/static-page";
import { getSession } from "@/lib/auth";
import type { SessionUser } from "@/components/auth/user-chip";

export default async function PrivacyPage() {
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
      title="Privacy Policy"
      intro="What we collect, why we collect it, and how we handle it."
    >
      <p>
        We collect only what we need to run the service — account info,
        listening history, and the prompts you give us. We don't sell
        your data. A complete privacy policy is being drafted and will
        live here before general availability.
      </p>
    </StaticPage>
  );
}
