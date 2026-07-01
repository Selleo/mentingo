export const SUPPORTED_LANGUAGES = {
  EN: "en",
  PL: "pl",
  DE: "de",
  LT: "lt",
  CS: "cs",
  ES: "es",
} as const;

export type SupportedLanguages = (typeof SUPPORTED_LANGUAGES)[keyof typeof SUPPORTED_LANGUAGES];

const SUPPORTED_LANGUAGE_VALUES = new Set<string>(Object.values(SUPPORTED_LANGUAGES));

export const isSupportedLanguage = (language: string): language is SupportedLanguages =>
  SUPPORTED_LANGUAGE_VALUES.has(language);
