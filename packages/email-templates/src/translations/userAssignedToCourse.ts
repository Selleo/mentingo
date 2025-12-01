import { EmailContent, Language } from "types";

export const getUserAssignedToCourseEmailTranslations = (
  language: Language,
  courseName: string,
) => {
  const emailContent: Record<Language, EmailContent> = {
    en: {
      heading: "New course",
      paragraphs: [
        "You've been enrolled 🎓",
        `You now have access to ${courseName}. It's available in your account.`,
      ],
      buttonText: "MY COURSES",
    },
    pl: {
      heading: "Nowy kurs dostępny",
      paragraphs: [
        "Zostałeś(-aś) zapisany(-a) 🎓",
        `Otrzymałeś(-aś) dostęp do ${courseName}, jest już widoczny na Twoim koncie.`,
      ],
      buttonText: "MOJE KURSY",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
