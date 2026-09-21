import {
  ANNOUNCEMENT_SOURCE_TYPES,
  SUPPORTED_LANGUAGES,
  type SupportedLanguages,
} from "@repo/shared";

import type { NotificationAnnouncement } from "./notifications.types";
import type { TranslationDraft, TranslationFormValues } from "./types";

const emptyTranslation = (): TranslationDraft => ({ title: "", content: "" });
const padDatePart = (value: number) => String(value).padStart(2, "0");

const toDateInputValue = (date: Date) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;

const toTimeInputValue = (date: Date) =>
  `${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;

const getEmptyTranslations = (): Record<SupportedLanguages, TranslationDraft> =>
  Object.fromEntries(
    Object.values(SUPPORTED_LANGUAGES).map((language) => [language, emptyTranslation()]),
  ) as Record<SupportedLanguages, TranslationDraft>;

export const getDefaultAnnouncementFormValues = (): TranslationFormValues => ({
  groupId: null,
  scheduled: false,
  scheduledDate: toDateInputValue(new Date()),
  scheduledTime: toTimeInputValue(new Date()),
  sendEmail: false,
  translations: getEmptyTranslations(),
});

export const buildAnnouncementScheduledAt = (date: string, time: string) =>
  new Date(`${date}T${time}:00`).toISOString();

export const getNotificationHref = (announcement: NotificationAnnouncement) => {
  if (announcement.sourceType === ANNOUNCEMENT_SOURCE_TYPES.COURSE_CHAT && announcement.sourceId) {
    return `/course/${announcement.sourceId}`;
  }

  return null;
};
