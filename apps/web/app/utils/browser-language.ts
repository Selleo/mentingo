import { SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";

export type SupportedLanguage = SupportedLanguages;

export function detectBrowserLanguage(): SupportedLanguage {
  if (typeof navigator === "undefined") {
    return SUPPORTED_LANGUAGES.EN;
  }

  const browserLang =
    navigator.language || (navigator as Navigator & { userLanguage: string }).userLanguage;

  if (!browserLang) {
    return SUPPORTED_LANGUAGES.EN;
  }

  const langCode = browserLang.split("-")[0].toLowerCase();

  if (Object.values(SUPPORTED_LANGUAGES).includes(langCode as SupportedLanguages)) {
    return langCode as SupportedLanguages;
  }

  return SUPPORTED_LANGUAGES.EN;
}

export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return Object.values(SUPPORTED_LANGUAGES).includes(lang as SupportedLanguages);
}

export const LANGUAGE_STORAGE_KEY = "language-storage";

/**
 * Language to boot i18next with, before the user settings are loaded: the one persisted by the
 * language store, otherwise the browser language. Page titles and the error page are rendered
 * with it, so it must not default to a fixed language.
 */
export function getInitialLanguage(): SupportedLanguage {
  try {
    const persisted = JSON.parse(localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? "null")?.state
      ?.language;

    if (typeof persisted === "string" && isSupportedLanguage(persisted)) {
      return persisted;
    }
  } catch {
    // Unavailable or malformed storage: fall back to the browser language.
  }

  return detectBrowserLanguage();
}
