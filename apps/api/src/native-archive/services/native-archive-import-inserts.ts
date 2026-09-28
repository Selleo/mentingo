import { COURSE_STATUSES, LEARNING_PATH_STATUSES } from "@repo/shared";

import { NATIVE_ARCHIVE_DEFAULT_CURRENCY } from "../native-archive.constants";

import type { NativeArchiveLearningPathImportSnapshot } from "../native-archive-learning-path.types";
import type {
  NativeArchiveCourseInsert,
  NativeArchiveLearningPathInsert,
} from "../repositories/native-archive-import.repository.types";
import type { UUIDType } from "src/common";
import type { SourceSnapshot } from "src/courses/types/master-course.types";

export function buildNativeArchiveCourseInsert(
  source: SourceSnapshot["course"],
  actorId: UUIDType,
  categoryId: UUIDType,
  targetId: UUIDType,
): NativeArchiveCourseInsert {
  return {
    id: targetId,
    originalId: source.originalId ?? source.id,
    title: source.title,
    description: source.description,
    status: COURSE_STATUSES.DRAFT,
    priceInCents: 0,
    currency: NATIVE_ARCHIVE_DEFAULT_CURRENCY,
    courseType: source.courseType,
    authorId: actorId,
    categoryId,
    settings: source.settings,
    baseLanguage: source.baseLanguage,
    availableLocales: source.availableLocales,
  };
}

export function buildNativeArchiveLearningPathInsert(
  source: NativeArchiveLearningPathImportSnapshot,
  actorId: UUIDType,
  thumbnailReference: string | null,
  settings: NativeArchiveLearningPathInsert["settings"],
  targetId: UUIDType,
): NativeArchiveLearningPathInsert {
  return {
    id: targetId,
    originalId: source.originalId ?? source.id,
    title: source.title,
    description: source.description,
    thumbnailReference,
    status: LEARNING_PATH_STATUSES.DRAFT,
    includesCertificate: source.includesCertificate,
    settings,
    sequenceEnabled: source.sequenceEnabled,
    authorId: actorId,
    baseLanguage: source.baseLanguage,
    availableLocales: source.availableLocales,
  };
}
