// English-only after the multi-locale teardown. The Locale type and the
// useLocale() hook are kept so existing call sites compile, but every value
// is fixed to "en" — there is no language switcher anymore.

export type Locale = "en";

export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(v: unknown): v is Locale {
  return v === "en";
}

export function coerceLocale(_v: unknown): Locale {
  return DEFAULT_LOCALE;
}
