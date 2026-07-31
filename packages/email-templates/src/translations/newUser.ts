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
    es: {
      heading: "Nuevo perfil de usuario",
      paragraphs: ["¡Hola! 🧑‍💻", `${userName} se ha unido. Revisa el perfil y asigna cursos.`],
      buttonText: "ABRIR PERFIL",
    },
    fr: {
      heading: "Nouveau profil utilisateur",
      paragraphs: [
        "Bonjour ! 🧑‍💻",
        `${userName} a rejoint la plateforme. Consultez son profil et attribuez-lui des cours.`,
      ],
      buttonText: "OUVRIR LE PROFIL",
    },
  };

  return emailContent[language];
};
