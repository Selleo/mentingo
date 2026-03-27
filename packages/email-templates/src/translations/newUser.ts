import { SupportedLanguages } from "@repo/shared";
import { EmailContent } from "types";

export const getNewUserEmailTranslations = (language: SupportedLanguages, userName: string) => {
  const emailContent: Record<SupportedLanguages, EmailContent> = {
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
    de: {
      heading: "Neues Benutzerprofil",
      paragraphs: [
        "Hallo! 🧑‍💻",
        `${userName} ist beigetreten. Prüfe das Profil und weise Kurse zu.`,
      ],
      buttonText: "PROFIL ÖFFNEN",
    },
    lt: {
      heading: "Naujo naudotojo profilis",
      paragraphs: ["Sveiki! 🧑‍💻", `${userName} prisijungė. Peržiūrėk profilį ir priskirk kursus.`],
      buttonText: "ATIDARYTI PROFILĮ",
    },
    cs: {
      heading: "Nový profil uživatele",
      paragraphs: ["Ahoj! 🧑‍💻", `${userName} se připojil(a). Zkontroluj profil a přiřaď kurzy.`],
      buttonText: "OTEVŘÍT PROFIL",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
