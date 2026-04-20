import { StandalonePlayer } from "@/components/player/standalone-player";

interface PlayerPageProps {
  params: { id: string };
}

export default function PlayerPage({ params }: PlayerPageProps) {
  return <StandalonePlayer requestId={params.id} />;
}
