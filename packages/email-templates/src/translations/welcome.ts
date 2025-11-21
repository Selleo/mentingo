import { EmailContent, Language } from "types";

export const getWelcomeEmailTranslations = (language: Language) => {
  const emailContent: Record<Language, EmailContent> = {
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
  };

  return emailContent[language] ?? emailContent.en;
};
