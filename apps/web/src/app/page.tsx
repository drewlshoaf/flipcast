import { FlipcastPageClient } from "@/components/flipcast-page-client";
import { env } from "@/lib/env";

export default function HomePage() {
  return (
    <main>
      <FlipcastPageClient defaultSpeed={env.defaultSpeed} />
    </main>
  );
}
