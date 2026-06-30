import type { SupportedLanguages } from "@repo/shared";
import type { IconName } from "~/types/shared";

export type LanguageOption = {
  key: SupportedLanguages;
  iconName: IconName;
  translationKey: string;
};

export const languageOptions: LanguageOption[] = [
  { key: "pl", iconName: "PL", translationKey: "changeUserLanguageView.options.polish" },
  { key: "en", iconName: "GB", translationKey: "changeUserLanguageView.options.english" },
  { key: "de", iconName: "DE", translationKey: "changeUserLanguageView.options.german" },
  { key: "cs", iconName: "CS", translationKey: "changeUserLanguageView.options.czech" },
  { key: "lt", iconName: "LT", translationKey: "changeUserLanguageView.options.lithuanian" },
  { key: "es", iconName: "ES", translationKey: "changeUserLanguageView.options.spanish" },
];
