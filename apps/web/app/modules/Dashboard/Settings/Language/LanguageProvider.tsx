import { useEffect, type ReactNode } from "react";

import i18n from "i18n";

import { useLanguageStore } from "./LanguageStore";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const language = useLanguageStore((state) => state.language);

  useEffect(() => {
    document.documentElement.lang = language;

    i18n.changeLanguage(language);
  }, [language]);

  return <>{children}</>;
}
