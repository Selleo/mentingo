import { SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";
import { z } from "zod";

import type { TFunction } from "i18next";

const translationSchema = z.object({ title: z.string(), content: z.string() });

const createTranslationsSchema = () =>
  z.object(
    Object.fromEntries(
      Object.values(SUPPORTED_LANGUAGES).map((language) => [language, translationSchema]),
    ) as Record<SupportedLanguages, typeof translationSchema>,
  );

export const createAnnouncementFormSchema = (
  enabledLanguages: SupportedLanguages[],
  t: TFunction,
) =>
  z
    .object({
      groupId: z.string().uuid().nullable(),
      scheduled: z.boolean(),
      scheduledDate: z.string(),
      scheduledTime: z.string(),
      sendEmail: z.boolean(),
      translations: createTranslationsSchema(),
    })
    .superRefine(({ scheduled, scheduledDate, scheduledTime, translations }, context) => {
      if (scheduled) {
        const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`);
        const minutes = Number(scheduledTime.split(":")[1]);

        if (Number.isNaN(scheduledAt.getTime()) || minutes % 5 !== 0) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["scheduledTime"],
            message: t("announcements.createPage.validation.schedule.invalid"),
          });
        }

        if (scheduledAt.getTime() <= Date.now()) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["scheduledDate"],
            message: t("announcements.createPage.validation.schedule.past"),
          });
        }
      }

      enabledLanguages.forEach((language) => {
        const translation = translations[language];

        if (!translation.title.trim()) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["translations", language, "title"],
            message: t("announcements.createPage.validation.title.required"),
          });
        }

        if (translation.title.length > 120) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["translations", language, "title"],
            message: t("announcements.createPage.validation.title.maxLength"),
          });
        }

        if (!translation.content.trim()) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["translations", language, "content"],
            message: t("announcements.createPage.validation.content.required"),
          });
        }
      });
    });
