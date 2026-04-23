import { HomePageV2 } from "@/components/home/home-page-v2";
import { getSession } from "@/lib/auth";
import type { SessionUser } from "@/components/auth/user-chip";

export default async function Page() {
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
  return <HomePageV2 sessionUser={sessionUser} />;
}
