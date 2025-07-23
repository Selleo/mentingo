import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { useUserSettings } from "../queries/useUserSettings";

export function useCurrentLanguage() {
  const { data: userSettings } = useUserSettings();
  const { language: fallbackLanguage } = useLanguageStore();

  const currentLanguage = userSettings?.language || fallbackLanguage;

  return {
    language: currentLanguage,
    isFromDatabase: !!userSettings?.language,
    isFromLocalStorage: !userSettings?.language && !!fallbackLanguage,
  };
}
