"use client";

import type { ReactNode } from "react";
import { en, type Dictionary } from "./dictionaries";
import type { Locale } from "./locale";

// English-only shim. The provider is now a pass-through that exists only so
// the existing layout call site keeps working without edits. useT() returns
// the static English dictionary; useLocale() returns "en".

export function LocaleProvider({ children }: {
  locale?: Locale;
  dictionary?: Dictionary;
  children: ReactNode;
}) {
  return <>{children}</>;
}

export function useLocale(): Locale {
  return "en";
}

export function useT(): Dictionary {
  return en;
}
