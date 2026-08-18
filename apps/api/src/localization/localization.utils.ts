import type { LocalizedText, SupportedLanguages } from "@repo/shared";

export const getExactLocalizedText = (
  value: LocalizedText | null | undefined,
  language: SupportedLanguages,
) => value?.[language];
