import { StudioClient } from "@/components/studio/studio-client";
import { getSession } from "@/lib/auth";
import { env } from "@/lib/env";
import type { SessionUser } from "@/components/auth/user-chip";

interface StudioPageProps {
  searchParams?: { topic?: string };
}

export default async function StudioPage({ searchParams }: StudioPageProps) {
  const initialTopic =
    typeof searchParams?.topic === "string" ? searchParams.topic : "";
  const session = await getSession();
  const sessionUser: SessionUser | null = session?.user
    ? {
        id: session.user.id,
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      }
    : null;
  return (
    <StudioClient
      defaultSpeed={env.defaultSpeed}
      initialTopic={initialTopic}
      sessionUser={sessionUser}
    />
  );
}
