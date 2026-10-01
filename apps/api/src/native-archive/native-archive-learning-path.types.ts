import type { learningPathCourses, learningPaths } from "src/storage/schema";

export type NativeArchiveLearningPathSnapshot = Pick<
  typeof learningPaths.$inferSelect,
  | "id"
  | "originalId"
  | "title"
  | "description"
  | "thumbnailReference"
  | "status"
  | "includesCertificate"
  | "settings"
  | "sequenceEnabled"
  | "originType"
  | "baseLanguage"
  | "availableLocales"
> & {
  courseLinks: Pick<typeof learningPathCourses.$inferSelect, "courseId" | "displayOrder">[];
};

export type NativeArchiveLearningPathExportRow = Omit<
  NativeArchiveLearningPathSnapshot,
  "courseLinks"
> & { authorId: typeof learningPaths.$inferSelect.authorId };

export type NativeArchiveLearningPathImportSnapshot = Pick<
  NativeArchiveLearningPathSnapshot,
  | "id"
  | "title"
  | "description"
  | "thumbnailReference"
  | "includesCertificate"
  | "settings"
  | "sequenceEnabled"
  | "baseLanguage"
  | "availableLocales"
  | "courseLinks"
> & { originalId?: typeof learningPaths.$inferSelect.originalId };

export type NativeArchiveLearningPathAssetFields = Pick<
  NativeArchiveLearningPathImportSnapshot,
  "thumbnailReference" | "settings"
>;
