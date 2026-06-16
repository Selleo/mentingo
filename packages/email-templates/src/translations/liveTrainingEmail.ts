import type { SupportedLanguages } from "@repo/shared";

export const getLiveTrainingEmailButtonText = (language: SupportedLanguages) => {
  const translations: Record<SupportedLanguages, string> = {
    en: "Open Live Training",
    pl: "Otwórz Szkolenie na żywo",
    de: "Live Training öffnen",
    lt: "Atidaryti Live Training",
    cs: "Otevřít Live Training",
  };

  return translations[language] ?? translations.en;
};
