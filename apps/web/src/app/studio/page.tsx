import { StudioClient } from "@/components/studio/studio-client";
import { env } from "@/lib/env";

interface StudioPageProps {
  searchParams?: { topic?: string };
}

export default function StudioPage({ searchParams }: StudioPageProps) {
  const initialTopic =
    typeof searchParams?.topic === "string" ? searchParams.topic : "";
  return (
    <StudioClient
      defaultSpeed={env.defaultSpeed}
      initialTopic={initialTopic}
    />
  );
}
