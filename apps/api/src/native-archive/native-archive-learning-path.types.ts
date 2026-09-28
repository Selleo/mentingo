import type { learningPathCourses, learningPaths } from "src/storage/schema";

export type NativeArchiveLearningPathSnapshot = Pick<
  typeof learningPaths.$inferSelect,
  | "id"
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
>;

export type NativeArchiveLearningPathAssetFields = Pick<
  NativeArchiveLearningPathImportSnapshot,
  "thumbnailReference" | "settings"
>;
