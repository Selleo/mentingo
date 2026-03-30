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
