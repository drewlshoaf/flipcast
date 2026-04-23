import { StaticPage } from "@/components/shared/static-page";
import { getSession } from "@/lib/auth";
import type { SessionUser } from "@/components/auth/user-chip";

export default async function CookiesPage() {
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
      title="Cookies"
      intro="How Flipcast uses cookies and similar technologies."
    >
      <p>
        We use a small number of first-party cookies to keep you logged
        in, remember your language preference, and measure how people
        use the product. A full cookie disclosure is being drafted.
      </p>
    </StaticPage>
  );
}
