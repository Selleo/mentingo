import type { SupportedLanguages } from "@repo/shared";

export type CreateUserSettingsResolution = {
  newUsersLanguage: SupportedLanguages;
  settingsOverride?: { language: SupportedLanguages };
};
