import { en, type Dictionary } from "./dictionaries";
import { DEFAULT_LOCALE, type Locale } from "./locale";

// Server-only helpers, English-only. Kept to satisfy existing call sites
// that import getLocale() / getDictionary() — both always return en.

export function getLocale(): Locale {
  return DEFAULT_LOCALE;
}

export function getDictionary(_locale?: Locale): Dictionary {
  return en;
}
