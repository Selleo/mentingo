import { SupportedLanguages } from "@repo/shared";
import { EmailContent } from "types";

export const getUserFirstLoginEmailTranslations = (language: SupportedLanguages, name: string) => {
  const emailContent: Record<SupportedLanguages, EmailContent> = {
    en: {
      heading: "Welcome",
      paragraphs: [
        "Good to have you here 🙂",
        `Your first sign-in was successful. ${name}, check your assigned courses.`,
      ],
      buttonText: "MY COURSES",
    },
    pl: {
      heading: "Witamy",
      paragraphs: [
        "Dobrze, że jesteś 🙂",
        `Logowanie przebiegło pomyślnie. ${name}, sprawdź przypisane kursy i rozpocznij naukę.`,
      ],
      buttonText: "MOJE KURSY",
    },
    de: {
      heading: "Willkommen",
      paragraphs: [
        "Schön, dass du da bist 🙂",
        `Deine erste Anmeldung war erfolgreich. ${name}, sieh dir deine zugewiesenen Kurse an.`,
      ],
      buttonText: "MEINE KURSE",
    },
    lt: {
      heading: "Sveiki atvykę",
      paragraphs: [
        "Džiugu, kad esi čia 🙂",
        `Pirmasis prisijungimas buvo sėkmingas. ${name}, peržiūrėk tau priskirtus kursus.`,
      ],
      buttonText: "MANO KURSAI",
    },
    cs: {
      heading: "Vítejte",
      paragraphs: [
        "Rádi tě tu máme 🙂",
        `Tvé první přihlášení proběhlo úspěšně. ${name}, podívej se na přiřazené kurzy.`,
      ],
      buttonText: "MOJE KURZY",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
