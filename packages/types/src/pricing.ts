// Per-million-token rates (USD) for the Claude models we call. Update when
// pricing changes or we add a new model.
export const CLAUDE_PRICING_PER_MTOK: Record<
  string,
  {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  }
> = {
  "claude-sonnet-4-6": {
    input: 3,
    output: 15,
    cacheRead: 0.3,
    cacheWrite: 3.75,
  },
  "claude-opus-4-7": {
    input: 15,
    output: 75,
    cacheRead: 1.5,
    cacheWrite: 18.75,
  },
  "claude-haiku-4-5": {
    input: 1,
    output: 5,
    cacheRead: 0.1,
    cacheWrite: 1.25,
  },
};

/// Flat pay-as-you-go rate for TTS, per 1000 characters synthesized. Fish
// Audio s2-pro pricing; update when the rate card changes.
export const TTS_USD_PER_1K_CHARS = 0.1;

/** @deprecated use TTS_USD_PER_1K_CHARS */
export const ELEVENLABS_USD_PER_1K_CHARS = TTS_USD_PER_1K_CHARS;

export interface ClaudeCallUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export interface ClaudeUsageAggregate {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  // Per-model breakdown so cost is accurate when multiple models are used in
  // one episode.
  byModel: Record<string, ClaudeCallUsage>;
}

export function emptyClaudeUsage(): ClaudeUsageAggregate {
  return {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    totalCacheCreationTokens: 0,
    byModel: {},
  };
}

export function mergeClaudeUsage(
  agg: ClaudeUsageAggregate | null | undefined,
  model: string,
  usage: ClaudeCallUsage,
): ClaudeUsageAggregate {
  const base = agg ?? emptyClaudeUsage();
  const prior = base.byModel[model] ?? {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
  };
  return {
    totalInputTokens: base.totalInputTokens + usage.inputTokens,
    totalOutputTokens: base.totalOutputTokens + usage.outputTokens,
    totalCacheReadTokens: base.totalCacheReadTokens + usage.cacheReadTokens,
    totalCacheCreationTokens:
      base.totalCacheCreationTokens + usage.cacheCreationTokens,
    byModel: {
      ...base.byModel,
      [model]: {
        inputTokens: prior.inputTokens + usage.inputTokens,
        outputTokens: prior.outputTokens + usage.outputTokens,
        cacheReadTokens: prior.cacheReadTokens + usage.cacheReadTokens,
        cacheCreationTokens:
          prior.cacheCreationTokens + usage.cacheCreationTokens,
      },
    },
  };
}

export function claudeCostUsd(agg: ClaudeUsageAggregate | null | undefined): number {
  if (!agg) return 0;
  let total = 0;
  for (const [model, usage] of Object.entries(agg.byModel)) {
    const price = CLAUDE_PRICING_PER_MTOK[model];
    if (!price) continue;
    total +=
      (usage.inputTokens * price.input) / 1_000_000 +
      (usage.outputTokens * price.output) / 1_000_000 +
      (usage.cacheReadTokens * price.cacheRead) / 1_000_000 +
      (usage.cacheCreationTokens * price.cacheWrite) / 1_000_000;
  }
  return total;
}

export function ttsCostUsd(chars: number): number {
  return (chars * TTS_USD_PER_1K_CHARS) / 1000;
}

/** @deprecated use ttsCostUsd */
export const elevenLabsCostUsd = ttsCostUsd;
