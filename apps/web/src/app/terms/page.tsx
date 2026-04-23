import { StaticPage } from "@/components/shared/static-page";
import { getSession } from "@/lib/auth";
import type { SessionUser } from "@/components/auth/user-chip";

export default async function TermsPage() {
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
      title="Terms of Service"
      intro="These terms govern your use of Flipcast."
    >
      <p>
        Our full Terms of Service are being drafted and will be posted
        here before general availability. In the meantime, use of
        Flipcast is offered on a best-effort basis and may change as we
        iterate. Don't use the product for anything illegal, harmful, or
        designed to impersonate real people without their consent.
      </p>
    </StaticPage>
  );
}
