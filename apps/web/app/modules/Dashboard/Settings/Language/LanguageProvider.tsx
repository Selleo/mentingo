import { useEffect, type ReactNode } from "react";

import i18n from "i18n";
import { useCurrentLanguage } from "~/api/mutations/useCurrentLanguage";

import { useLanguageStore } from "./LanguageStore";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const {
    language: currentLanguage,
    isFromDatabase,
    isFromLocalStorage,
    currentUser,
    userSettings,
  } = useCurrentLanguage();
  const { initializeLanguage } = useLanguageStore();

  useEffect(() => {
    if (currentUser) {
      initializeLanguage(userSettings?.language);
    } else {
      initializeLanguage();
    }
  }, [currentUser, userSettings?.language, initializeLanguage]);

  useEffect(() => {
    document.documentElement.lang = currentLanguage;
    i18n.changeLanguage(currentLanguage);
  }, [currentLanguage, isFromDatabase, isFromLocalStorage]);

  return <>{children}</>;
}
