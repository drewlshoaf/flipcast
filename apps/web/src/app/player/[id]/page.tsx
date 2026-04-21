import { StandalonePlayer } from "@/components/player/standalone-player";
import { getSession } from "@/lib/auth";

interface PlayerPageProps {
  params: { id: string };
}

export default async function PlayerPage({ params }: PlayerPageProps) {
  const session = await getSession();
  const isAdmin = Boolean(session?.user?.isAdmin);
  return <StandalonePlayer requestId={params.id} isAdmin={isAdmin} />;
}
