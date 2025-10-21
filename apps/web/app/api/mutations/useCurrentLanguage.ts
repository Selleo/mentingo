import { useLanguageStore } from "../../modules/Dashboard/Settings/Language/LanguageStore";
import { useCurrentUser } from "../queries/useCurrentUser";
import { useUserSettings } from "../queries/useUserSettings";

export function useCurrentLanguage() {
  const { data: currentUser } = useCurrentUser();
  const { data: userSettings } = useUserSettings();
  const { language: fallbackLanguage } = useLanguageStore();

  if (currentUser) {
    return {
      language: userSettings?.language || fallbackLanguage,
      isFromDatabase: !!userSettings?.language,
      isFromLocalStorage: !userSettings?.language && !!fallbackLanguage,
    };
  }

  return {
    language: fallbackLanguage,
    isFromDatabase: false,
    isFromLocalStorage: !!fallbackLanguage,
  };
}
