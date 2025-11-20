export const SUPPORTED_LANGUAGES = {
  EN: "en",
  PL: "pl",
};

export type SupportedLanguages = (typeof SUPPORTED_LANGUAGES)[keyof typeof SUPPORTED_LANGUAGES];

export type Languages = "pl" | "en";
