import type {
  GetEffectiveLanguageInput,
  GetLocalizedResourceLanguageParams,
  LanguageFormKeyPart,
} from "./types";
import type { SupportedLanguages } from "@repo/shared";

export const getEffectiveLanguage = ({
  value,
  baseLanguage,
  availableLocales,
}: GetEffectiveLanguageInput): SupportedLanguages => {
  if (!baseLanguage || !availableLocales || availableLocales.includes(value)) return value;

  return baseLanguage;
};

const buildLanguageFormKey = (parts: LanguageFormKeyPart[]) =>
  parts
    .filter((part) => part !== null && part !== undefined)
    .map(String)
    .join(":");

export const getLocalizedResourceLanguage = ({
  value,
  baseLanguage,
  availableLocales,
  onChange,
  formKeyParts,
}: GetLocalizedResourceLanguageParams) => {
  const effectiveLanguage = getEffectiveLanguage({ value, baseLanguage, availableLocales });
  const formKey = buildLanguageFormKey([effectiveLanguage, ...formKeyParts]);

  return {
    effectiveLanguage,
    formKey,
    selectorProps: {
      formKey,
      value,
      baseLanguage,
      availableLocales,
      onChange,
    },
  };
};
