export const env = {
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgres://flipcast:flipcast@postgres:5432/flipcast",
  redisUrl: process.env.REDIS_URL ?? "redis://redis:6379",
  awsRegion: process.env.AWS_REGION ?? "us-east-1",
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  s3Endpoint: process.env.S3_ENDPOINT ?? "http://minio:9000",
  s3PublicEndpoint:
    process.env.S3_PUBLIC_ENDPOINT ?? "http://localhost:9000",
  s3Bucket: process.env.S3_BUCKET ?? "flipcast-audio",
  s3AccessKey: process.env.S3_ACCESS_KEY ?? "minioadmin",
  s3SecretKey: process.env.S3_SECRET_KEY ?? "minioadmin",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  elevenlabsApiKey: process.env.ELEVENLABS_API_KEY ?? "",
  elevenlabsMaxConcurrent: parsePositiveInt(
    process.env.ELEVENLABS_MAX_CONCURRENT,
    3,
  ),
  fishAudioApiKey: process.env.FISH_AUDIO ?? "",
  fishAudioMaxConcurrent: parsePositiveInt(
    process.env.FISH_AUDIO_MAX_CONCURRENT,
    5,
  ),
  defaultSpeed: parseSpeed(process.env.FLIPCAST_DEFAULT_SPEED, 1.0),
};

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

function parseSpeed(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  // Clamp to ElevenLabs' supported range.
  return Math.min(1.2, Math.max(0.7, n));
}
