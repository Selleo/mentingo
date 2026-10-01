import type { LocalizedText } from "@repo/shared";
import type { calendarEvents, courses, learningPaths, resources } from "src/storage/schema";

export type NativeArchiveCourseInsert = Pick<
  typeof courses.$inferInsert,
  | "id"
  | "originalId"
  | "status"
  | "priceInCents"
  | "currency"
  | "courseType"
  | "authorId"
  | "categoryId"
  | "settings"
  | "baseLanguage"
  | "availableLocales"
> & {
  title: LocalizedText;
  description: LocalizedText;
};

export type NativeArchiveLearningPathInsert = Pick<
  typeof learningPaths.$inferInsert,
  | "id"
  | "originalId"
  | "thumbnailReference"
  | "status"
  | "includesCertificate"
  | "settings"
  | "sequenceEnabled"
  | "authorId"
  | "baseLanguage"
  | "availableLocales"
> & {
  title: LocalizedText;
  description: LocalizedText;
};

export type NativeArchiveCalendarEventInsert = Omit<
  typeof calendarEvents.$inferInsert,
  "title" | "description"
> & {
  title: LocalizedText;
  description?: LocalizedText | null;
};

export type NativeArchiveResourceInsert = Omit<
  typeof resources.$inferInsert,
  "id" | "title" | "description"
> & {
  title: LocalizedText;
  description: LocalizedText;
};
