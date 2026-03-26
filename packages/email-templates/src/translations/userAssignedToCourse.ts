import { SupportedLanguages } from "@repo/shared";
import { EmailContent } from "types";

export const getUserAssignedToCourseEmailTranslations = (
  language: SupportedLanguages,
  courseName: string,
  formatedCourseDueDate: string | null,
) => {
  const enMandatoryCourseParagraph = formatedCourseDueDate
    ? `This course is mandatory and must be completed by ${formatedCourseDueDate}.`
    : undefined;
  const plMandatoryCourseParagraph = formatedCourseDueDate
    ? `Ten kurs jest obowiązkowy i musi zostać ukończony do ${formatedCourseDueDate}.`
    : undefined;
  const deMandatoryCourseParagraph = formatedCourseDueDate
    ? `Dieser Kurs ist verpflichtend und muss bis zum ${formatedCourseDueDate} abgeschlossen werden.`
    : undefined;
  const ltMandatoryCourseParagraph = formatedCourseDueDate
    ? `Šis kursas yra privalomas ir turi būti baigtas iki ${formatedCourseDueDate}.`
    : undefined;
  const czMandatoryCourseParagraph = formatedCourseDueDate
    ? `Tento kurz je povinný a musí být dokončen do ${formatedCourseDueDate}.`
    : undefined;

  const emailContent: Record<SupportedLanguages, EmailContent> = {
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
    de: {
      heading: "Neuer Kurs verfügbar",
      paragraphs: [
        "Du wurdest eingeschrieben 🎓",
        `Du hast jetzt Zugriff auf ${courseName}. Der Kurs ist in deinem Konto verfügbar.`,
        deMandatoryCourseParagraph,
      ].filter(Boolean) as string[],
      buttonText: "MEINE KURSE",
    },
    lt: {
      heading: "Naujas kursas pasiekiamas",
      paragraphs: [
        "Esi įtrauktas(-a) 🎓",
        `Dabar turi prieigą prie ${courseName}. Kursas jau matomas tavo paskyroje.`,
        ltMandatoryCourseParagraph,
      ].filter(Boolean) as string[],
      buttonText: "MANO KURSAI",
    },
    cs: {
      heading: "Nový kurz je dostupný",
      paragraphs: [
        "Byl(a) jsi zapsán(a) 🎓",
        `Nyní máš přístup ke kurzu ${courseName}. Kurz je už dostupný ve tvém účtu.`,
        czMandatoryCourseParagraph,
      ].filter(Boolean) as string[],
      buttonText: "MOJE KURZY",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
