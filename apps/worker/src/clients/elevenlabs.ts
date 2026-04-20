import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import {
  resolveProviderVoiceId,
  type TtsEngine,
  type VoiceOption,
} from "@flipcast/types";
import { env } from "../env";

let cachedClient: ElevenLabsClient | null = null;

function client(): ElevenLabsClient {
  if (!env.elevenlabsApiKey) {
    throw new Error(
      "ELEVENLABS_API_KEY is not set; cannot synthesize with ElevenLabs.",
    );
  }
  if (!cachedClient) {
    cachedClient = new ElevenLabsClient({ apiKey: env.elevenlabsApiKey });
  }
  return cachedClient;
}

interface EngineConfig {
  modelId: string;
  voiceSettings?: {
    stability?: number;
    similarityBoost?: number;
    style?: number;
    useSpeakerBoost?: boolean;
    speed?: number;
  };
}

const ENGINE_CONFIG: Partial<Record<TtsEngine, EngineConfig>> = {
  elevenlabs: {
    modelId: "eleven_multilingual_v2",
  },
  "elevenlabs-flash": {
    modelId: "eleven_flash_v2_5",
  },
  "elevenlabs-narration": {
    modelId: "eleven_multilingual_v2",
    voiceSettings: {
      stability: 0.7,
      similarityBoost: 0.85,
      style: 0.0,
      useSpeakerBoost: true,
    },
  },
};

export async function synthesizeWithElevenLabs(
  text: string,
  voice: VoiceOption,
  engine: TtsEngine,
  speed?: number,
): Promise<Buffer> {
  const config = ENGINE_CONFIG[engine];
  if (!config) {
    throw new Error(`No ElevenLabs config for engine "${engine}".`);
  }

  const voiceSettings = {
    ...(config.voiceSettings ?? {}),
    ...(typeof speed === "number" ? { speed } : {}),
  };
  const hasSettings = Object.keys(voiceSettings).length > 0;

  const audio = await client().textToSpeech.convert(
    resolveProviderVoiceId(voice),
    {
      text,
      modelId: config.modelId,
      outputFormat: "mp3_44100_128",
      ...(hasSettings ? { voiceSettings } : {}),
    },
  );

  const chunks: Buffer[] = [];
  for await (const chunk of audio as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
