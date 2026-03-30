export const SUPPORTED_LANGUAGES = {
  EN: "en",
  PL: "pl",
  DE: "de",
  LT: "lt",
  CS: "cs",
} as const;

export type SupportedLanguages = (typeof SUPPORTED_LANGUAGES)[keyof typeof SUPPORTED_LANGUAGES];
