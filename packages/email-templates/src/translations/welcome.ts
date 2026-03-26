import { SupportedLanguages } from "@repo/shared";
import { EmailContent } from "types";

export const getWelcomeEmailTranslations = (language: SupportedLanguages) => {
  const emailContent: Record<SupportedLanguages, EmailContent> = {
    en: {
      heading: "Welcome",
      paragraphs: [
        "Good to have you here 🙂",
        "Your account has been successfully created. Checkout available courses.",
      ],
      buttonText: "VIEW COURSES",
    },
    pl: {
      heading: "Witamy",
      paragraphs: [
        "Dobrze, że jesteś 🙂",
        "Twoje konto zostało pomyślnie utworzone. Sprawdź dostępne kursy.",
      ],
      buttonText: "ZOBACZ KURSY",
    },
    de: {
      heading: "Willkommen",
      paragraphs: [
        "Schön, dass du da bist 🙂",
        "Dein Konto wurde erfolgreich erstellt. Sieh dir die verfügbaren Kurse an.",
      ],
      buttonText: "KURSE ANSEHEN",
    },
    lt: {
      heading: "Sveiki atvykę",
      paragraphs: [
        "Džiugu, kad esi čia 🙂",
        "Tavo paskyra buvo sėkmingai sukurta. Peržiūrėk galimus kursus.",
      ],
      buttonText: "PERŽIŪRĖTI KURSUS",
    },
    cs: {
      heading: "Vítejte",
      paragraphs: [
        "Rádi tě tu máme 🙂",
        "Tvůj účet byl úspěšně vytvořen. Prohlédni si dostupné kurzy.",
      ],
      buttonText: "PROHLÉDNOUT KURZY",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
