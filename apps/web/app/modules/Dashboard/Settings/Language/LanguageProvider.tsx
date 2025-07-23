import { useEffect, type ReactNode } from "react";

import i18n from "i18n";
import { useCurrentLanguage } from "~/api/mutations/useCurrentLanguage";

import { useLanguageStore } from "./LanguageStore";

import type { Language } from "./LanguageStore";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { language: currentLanguage, isFromDatabase } = useCurrentLanguage();
  const { setLanguage } = useLanguageStore();

  useEffect(() => {
    if (isFromDatabase) {
      setLanguage(currentLanguage as Language);
    }

    document.documentElement.lang = currentLanguage;
    i18n.changeLanguage(currentLanguage);
  }, [currentLanguage, isFromDatabase, setLanguage]);

  return <>{children}</>;
}
