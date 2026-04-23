import {
  PollyClient,
  SynthesizeSpeechCommand,
  type Engine,
  type VoiceId,
} from "@aws-sdk/client-polly";
import { resolveProviderVoiceId, type VoiceOption, type TtsEngine } from "@flipcast/types";
import { env } from "../env";

const polly = new PollyClient({
  region: env.awsRegion,
  credentials: {
    accessKeyId: env.awsAccessKeyId,
    secretAccessKey: env.awsSecretAccessKey,
  },
});

export async function synthesizeWithPolly(
  text: string,
  voice: VoiceOption,
  engine: TtsEngine,
): Promise<Buffer> {
  const res = await polly.send(
    new SynthesizeSpeechCommand({
      Text: text,
      VoiceId: resolveProviderVoiceId(voice) as VoiceId,
      Engine: engine as Engine,
      OutputFormat: "mp3",
      TextType: "text",
    }),
  );

  const stream = res.AudioStream;
  if (!stream) throw new Error("Polly returned no audio stream.");

  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
