import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../env";

export const s3 = new S3Client({
  endpoint: env.s3Endpoint,
  region: "us-east-1",
  credentials: {
    accessKeyId: env.s3AccessKey,
    secretAccessKey: env.s3SecretKey,
  },
  forcePathStyle: true,
});

export async function uploadObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.s3Bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return `${env.s3PublicEndpoint}/${env.s3Bucket}/${key}`;
}
