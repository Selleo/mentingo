import { EmailContent, Language } from "types";

export const getUserFirstLoginEmailTranslations = (language: Language, name: string) => {
  const emailContent: Record<Language, EmailContent> = {
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
  };

  return emailContent[language] ?? emailContent.en;
};
