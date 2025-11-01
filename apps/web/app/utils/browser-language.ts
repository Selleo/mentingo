export type SupportedLanguage = "en" | "pl";

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ["en", "pl"];

export function detectBrowserLanguage(): SupportedLanguage {
  if (typeof navigator === "undefined") {
    return "en";
  }

  const browserLang =
    navigator.language || (navigator as Navigator & { userLanguage: string }).userLanguage;

  if (!browserLang) {
    return "en";
  }

  const langCode = browserLang.split("-")[0].toLowerCase();

  if (SUPPORTED_LANGUAGES.includes(langCode as SupportedLanguage)) {
    return langCode as SupportedLanguage;
  }

  return "en";
}

export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
}
