import type { Locale } from "@/lib/i18n/locale";
import type { RankedPromptConcept } from "./schema";

// Locale-keyed cache for the home-page engine. The cache holds the full
// ranked+filtered set so downstream callers can re-rank (e.g. per-user
// interest bias) without paying for a fresh LLM call each time.
//
// TTL matches /api/ideas (30 min). Per-process singleton via globalThis so
// Next.js dev HMR doesn't wipe it on every change.

export interface PromptEngineCacheEntry {
  concepts: RankedPromptConcept[];
  rejected: RankedPromptConcept[];
  generatedAt: string;
  expiresAt: number;
  model: string;
}

// Version suffix on the globalThis key. Bump when the concept schema gains
// new required fields so an in-process cache from the previous deploy can't
// feed stale entries into the new renderer.
//   v2 (2026-04) — adds category / descriptor / best_as / tone_tag
declare global {
  // eslint-disable-next-line no-var
  var __flipcastPromptEngineCache_v2:
    | Partial<Record<Locale, PromptEngineCacheEntry>>
    | undefined;
}

export const PROMPT_ENGINE_TTL_MS = 30 * 60 * 1000;

function store(): Partial<Record<Locale, PromptEngineCacheEntry>> {
  if (!globalThis.__flipcastPromptEngineCache_v2) {
    globalThis.__flipcastPromptEngineCache_v2 = {};
  }
  return globalThis.__flipcastPromptEngineCache_v2;
}

export function readCache(locale: Locale): PromptEngineCacheEntry | null {
  const entry = store()[locale];
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) return null;
  return entry;
}

export function writeCache(
  locale: Locale,
  entry: Omit<PromptEngineCacheEntry, "expiresAt">,
): PromptEngineCacheEntry {
  const full: PromptEngineCacheEntry = {
    ...entry,
    expiresAt: Date.now() + PROMPT_ENGINE_TTL_MS,
  };
  store()[locale] = full;
  return full;
}

export function clearCache(locale?: Locale): void {
  if (locale) delete store()[locale];
  else globalThis.__flipcastPromptEngineCache_v2 = {};
}
