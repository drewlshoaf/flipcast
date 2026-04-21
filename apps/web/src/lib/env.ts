function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgres://flipcast:flipcast@postgres:5432/flipcast",
  redisUrl: process.env.REDIS_URL ?? "redis://redis:6379",
  s3Endpoint: process.env.S3_ENDPOINT ?? "http://minio:9000",
  s3PublicEndpoint:
    process.env.S3_PUBLIC_ENDPOINT ?? "http://localhost:9000",
  s3Bucket: process.env.S3_BUCKET ?? "flipcast-audio",
  s3AccessKey: process.env.S3_ACCESS_KEY ?? "minioadmin",
  s3SecretKey: process.env.S3_SECRET_KEY ?? "minioadmin",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  defaultSpeed: clampSpeed(process.env.FLIPCAST_DEFAULT_SPEED, 1.0),
  defaultEngine: resolveEngine(process.env.FLIPCAST_DEFAULT_ENGINE),
  authSecret: process.env.AUTH_SECRET ?? "",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
};

function clampSpeed(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1.2, Math.max(0.7, n));
}

function resolveEngine(raw: string | undefined): "elevenlabs" | "fish" {
  const v = raw?.trim().toLowerCase();
  if (v === "elevenlabs" || v === "fish") return v;
  return "fish";
}

export { required };
