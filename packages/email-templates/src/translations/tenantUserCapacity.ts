import { SupportedLanguages } from "@repo/shared";
import { EmailContent } from "types";

export const getTenantUserCapacityEmailTranslations = (
  language: SupportedLanguages,
  capacityTitle: string,
  capacityMessage: string,
) => {
  const emailContent: Record<SupportedLanguages, EmailContent> = {
    en: {
      heading: capacityTitle,
      paragraphs: [capacityMessage],
      buttonText: "MANAGE USERS",
    },
    pl: {
      heading: capacityTitle,
      paragraphs: [capacityMessage],
      buttonText: "ZARZĄDZAJ UŻYTKOWNIKAMI",
    },
    de: {
      heading: capacityTitle,
      paragraphs: [capacityMessage],
      buttonText: "BENUTZER VERWALTEN",
    },
    lt: {
      heading: capacityTitle,
      paragraphs: [capacityMessage],
      buttonText: "TVARKYTI NAUDOTOJUS",
    },
    cs: {
      heading: capacityTitle,
      paragraphs: [capacityMessage],
      buttonText: "SPRAVOVAT UŽIVATELE",
    },
    es: {
      heading: capacityTitle,
      paragraphs: [capacityMessage],
      buttonText: "GESTIONAR USUARIOS",
    },
    fr: {
      heading: capacityTitle,
      paragraphs: [capacityMessage],
      buttonText: "GÉRER LES UTILISATEURS",
    },
  };

  return emailContent[language];
};
