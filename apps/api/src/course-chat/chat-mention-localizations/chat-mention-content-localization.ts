import type { SupportedLanguages } from "node_modules/@repo/shared/dist/index.cjs";

export function getLocalizedUserMentionContentAnnouncement(courseName: string) {
  const content: Record<SupportedLanguages, string> = {
    en: `In the course "${courseName}"`,
    pl: `W kursie "${courseName}"`,
    de: `Im Kurs "${courseName}"`,
    lt: `Kurse "${courseName}"`,
    cs: `V kurzu "${courseName}"`,
    es: `En el curso "${courseName}"`,
  };
  return content;
}
