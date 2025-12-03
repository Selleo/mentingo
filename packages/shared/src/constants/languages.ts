export const SUPPORTED_LANGUAGES = {
  EN: "en",
  PL: "pl",
} as const;

export type SupportedLanguages = (typeof SUPPORTED_LANGUAGES)[keyof typeof SUPPORTED_LANGUAGES];
