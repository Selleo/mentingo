import type { SupportedLanguages } from "@repo/shared";

export const getLiveTrainingEmailButtonText = (language: SupportedLanguages) => {
  const translations: Record<SupportedLanguages, string> = {
    en: "Open Live Training",
    pl: "Otwórz Szkolenie na żywo",
    de: "Live-Schulung öffnen",
    lt: "Atidaryti tiesioginius mokymus",
    cs: "Otevřít živé školení",
    es: "Abrir formación en vivo",
  };

  return translations[language];
};
