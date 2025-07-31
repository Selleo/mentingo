import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { useUserSettings } from "../queries/useUserSettings";

export function useCurrentLanguage() {
  const { data: userSettings } = useUserSettings();
  const { language: fallbackLanguage } = useLanguageStore();

  const hasLanguage = (
    settings: typeof userSettings,
  ): settings is { language: string } & typeof userSettings => {
    return settings != null && "language" in settings;
  };

  const currentLanguage = hasLanguage(userSettings) ? userSettings.language : fallbackLanguage;

  return {
    language: currentLanguage,
    isFromDatabase: hasLanguage(userSettings),
    isFromLocalStorage: !hasLanguage(userSettings) && !!fallbackLanguage,
  };
}
