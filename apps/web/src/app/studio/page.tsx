import { VIBE_IDS, type FlipcastFormat, type FlipcastVibe } from "@flipaudio/types";
import { StudioClient } from "@/components/studio/studio-client";
import { getSession } from "@/lib/auth";
import { env } from "@/lib/env";
import type { SessionUser } from "@/components/auth/user-chip";

interface StudioPageProps {
  searchParams?: {
    topic?: string;
    format?: string;
    vibe?: string;
    engine?: string;
    auto?: string;
  };
}

const VALID_FORMATS: FlipcastFormat[] = ["panel", "newscast"];
const VALID_ENGINES = ["fish"] as const;

export default async function StudioPage({ searchParams }: StudioPageProps) {
  const initialTopic =
    typeof searchParams?.topic === "string" ? searchParams.topic : "";
  const initialFormat =
    searchParams?.format && VALID_FORMATS.includes(searchParams.format as FlipcastFormat)
      ? (searchParams.format as FlipcastFormat)
      : undefined;
  const initialVibe =
    searchParams?.vibe && (VIBE_IDS as readonly string[]).includes(searchParams.vibe)
      ? (searchParams.vibe as FlipcastVibe)
      : undefined;
  const initialEngine =
    searchParams?.engine &&
    (VALID_ENGINES as readonly string[]).includes(searchParams.engine)
      ? (searchParams.engine as (typeof VALID_ENGINES)[number])
      : undefined;
  const autoStart = searchParams?.auto === "1";

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
    <StudioClient
      defaultSpeed={env.defaultSpeed}
      defaultEngine={env.defaultEngine}
      initialTopic={initialTopic}
      initialFormat={initialFormat}
      initialVibe={initialVibe}
      initialEngine={initialEngine}
      autoStart={autoStart}
      sessionUser={sessionUser}
    />
  );
}
