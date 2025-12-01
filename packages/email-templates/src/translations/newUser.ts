import { EmailContent, Language } from "types";

export const getNewUserEmailTranslations = (language: Language, userName: string) => {
  const emailContent: Record<Language, EmailContent> = {
    en: {
      heading: "New user profile",
      paragraphs: ["Hello! 🧑‍💻", `${userName} has joined. Review the profile and assign courses.`],
      buttonText: "OPEN PROFILE",
    },
    pl: {
      heading: "Nowy profil użytkownika",
      paragraphs: ["Cześć! 🧑‍💻", `${userName} dołączył(-a). Sprawdź profil i przypisz kursy.`],
      buttonText: "OTWÓRZ PROFIL",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
