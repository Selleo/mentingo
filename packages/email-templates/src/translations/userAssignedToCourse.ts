import { EmailContent, Language } from "types";

export const getUserAssignedToCourseEmailTranslations = (
  language: Language,
  courseName: string,
  formatedCourseDueDate: string | null,
) => {
  const enMandatoryCourseParagraph = formatedCourseDueDate
    ? `This course is mandatory and must be completed by ${formatedCourseDueDate}.`
    : undefined;
  const plMandatoryCourseParagraph = formatedCourseDueDate
    ? `Ten kurs jest obowiązkowy i musi zostać ukończony do ${formatedCourseDueDate}.`
    : undefined;

  const emailContent: Record<Language, EmailContent> = {
    en: {
      heading: "New course",
      paragraphs: [
        "You've been enrolled 🎓",
        `You now have access to ${courseName}. It's available in your account.`,
        enMandatoryCourseParagraph,
      ].filter(Boolean) as string[],
      buttonText: "MY COURSES",
    },
    pl: {
      heading: "Nowy kurs dostępny",
      paragraphs: [
        "Zostałeś(-aś) zapisany(-a) 🎓",
        `Otrzymałeś(-aś) dostęp do ${courseName}, jest już widoczny na Twoim koncie.`,
        plMandatoryCourseParagraph,
      ].filter(Boolean) as string[],
      buttonText: "MOJE KURSY",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
