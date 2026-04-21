import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./env";

let cached: S3Client | null = null;

export function s3(): S3Client {
  if (!cached) {
    cached = new S3Client({
      region: "us-east-1",
      endpoint: env.s3Endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.s3AccessKey,
        secretAccessKey: env.s3SecretKey,
      },
    });
  }
  return cached;
}
