import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { users } from "@flipcast/server-db";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { s3 } from "@/lib/s3";

export const runtime = "nodejs";

const ACCEPTED = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

function extFor(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json(
      { error: "Expected multipart form data." },
      { status: 400 },
    );
  }
  const file = form.get("avatar");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing 'avatar' file." },
      { status: 400 },
    );
  }
  if (!ACCEPTED.has(file.type)) {
    return NextResponse.json(
      { error: "Use PNG, JPG, or WebP." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image must be under 5 MB." },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const key = `avatars/${session.user.id}-${Date.now()}.${extFor(file.type)}`;
  await s3().send(
    new PutObjectCommand({
      Bucket: env.s3Bucket,
      Key: key,
      Body: buf,
      ContentType: file.type,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  const url = `${env.s3PublicEndpoint}/${env.s3Bucket}/${key}`;
  await db
    .update(users)
    .set({ image: url, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ image: url });
}
