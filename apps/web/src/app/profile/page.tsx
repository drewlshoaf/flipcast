import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { users } from "@flipaudio/server-db";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProfileForm } from "@/components/profile/profile-form";
import { InterestsPicker } from "@/components/profile/interests-picker";
import { UserChip, type SessionUser } from "@/components/auth/user-chip";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login?next=/profile");
  }

  const row = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });
  if (!row) redirect("/login");

  const sessionUser: SessionUser = {
    id: row.id,
    name: row.name ?? null,
    email: row.email ?? null,
    image: row.image ?? null,
    isAdmin: row.isAdmin ?? false,
  };

  return (
    <div className="mx-auto max-w-[760px] px-6 py-6 md:px-10">
      <header className="mb-10 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-gradient shadow-glow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M7 5v14l12-7-12-7z" fill="white" />
            </svg>
          </span>
          <span className="text-base font-semibold tracking-tight text-ink-900">
            flip.audio
          </span>
        </Link>
        <UserChip user={sessionUser} />
      </header>

      <h1 className="text-3xl font-semibold tracking-tight text-ink-900">
        Profile
      </h1>
      <p className="mt-1 text-base text-ink-500">
        How you show up across flip.audio.
      </p>

      <div className="mt-8 flex flex-col gap-6">
        <ProfileForm
          userId={row.id}
          email={row.email}
          initialName={row.name ?? ""}
          initialImage={row.image ?? null}
        />
        <InterestsPicker initialSelected={row.interests ?? []} />
      </div>
    </div>
  );
}
