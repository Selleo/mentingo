import path from "path";

import { DEFAULT_CERTIFICATE_FONT_COLOR, type ENTITY_TYPES, LESSON_TYPES } from "@repo/shared";
import { v5 as uuidv5 } from "uuid";

import {
  LESSON_SEQUENCE_ENABLED,
  QUIZ_FEEDBACK_ENABLED,
  VIDEO_COMPLETION_TRACKING_ENABLED,
} from "src/courses/constants";
import {
  getScormExtractedFilesReference,
  getScormOriginalFileReference,
} from "src/scorm/scorm-storage-paths";
import { normalizeJsonb } from "src/utils/jsonb";

import { COURSE_TRANSFER_SCORM_PACKAGE_UUID_NAMESPACE } from "../course-transfer.constants";

import type { UUIDType } from "src/common";
import type {
  CourseTransferResourceCollection,
  CourseTransferResourceGroupKey,
  SourceSnapshot,
} from "src/course-transfer/types/course-transfer-graph.types";
import type { CoursesSettings } from "src/courses/types/settings";

type InternalResourceEntityType =
  | typeof ENTITY_TYPES.COURSE
  | typeof ENTITY_TYPES.LESSON
  | typeof ENTITY_TYPES.QUESTION;

export const shouldSyncLesson = (sourceLesson: SourceSnapshot["lessons"][number]) =>
  sourceLesson.type !== LESSON_TYPES.LIVE_TRAINING;

export const normalizeCourseSettings = (settings: unknown) =>
  normalizeJsonb<CoursesSettings>(settings, {
    lessonSequenceEnabled: LESSON_SEQUENCE_ENABLED,
    quizFeedbackEnabled: QUIZ_FEEDBACK_ENABLED,
    videoCompletionTrackingEnabled: VIDEO_COMPLETION_TRACKING_ENABLED,
    certificateSignature: null,
    certificateFontColor: DEFAULT_CERTIFICATE_FONT_COLOR,
    certificateValidity: null,
  });

export const buildInternalResourceFieldKey = (
  sourceEntityType: InternalResourceEntityType,
  sourceEntityId: UUIDType,
  fieldPath: string,
) => [sourceEntityType, sourceEntityId, fieldPath].join(":");

export const getCopiedInternalReference = (
  collection: CourseTransferResourceCollection,
  group: CourseTransferResourceGroupKey,
  sourceEntityType: InternalResourceEntityType,
  sourceEntityId: UUIDType,
  fieldPath: string,
  fallback: string | null,
) => {
  const fieldKey = buildInternalResourceFieldKey(sourceEntityType, sourceEntityId, fieldPath);

  return collection[group].internal[fieldKey]?.target.reference ?? fallback;
};

export const getAllResourceReferences = (collection: CourseTransferResourceCollection) =>
  Object.values(collection).flatMap((group) => [
    ...Object.values(group.external),
    ...Object.values(group.internal),
  ]);

export const getExternalResourceReferences = (collection: CourseTransferResourceCollection) =>
  Object.values(collection).flatMap((group) => Object.values(group.external));

/** Package storage is addressed by the transfer scope so retries reuse the same destination. */
export const getTargetScormStorage = (
  scopeId: UUIDType,
  targetTenantId: UUIDType,
  sourcePackage: SourceSnapshot["scormPackages"][number],
) => {
  const targetPackageId = uuidv5(
    `master-course:${scopeId}:scorm-package:${sourcePackage.id}`,
    COURSE_TRANSFER_SCORM_PACKAGE_UUID_NAMESPACE,
  ) as UUIDType;

  return {
    targetPackageId,
    targetOriginalFileReference: getScormOriginalFileReference(
      targetTenantId,
      targetPackageId,
      path.posix.basename(sourcePackage.originalFileReference),
    ),
    targetExtractedFilesReference: getScormExtractedFilesReference(targetTenantId, targetPackageId),
  };
};

export const rewriteScormStorageReference = (
  reference: string,
  sourceExtractedFilesReference: string,
  targetExtractedFilesReference: string,
) =>
  reference.startsWith(sourceExtractedFilesReference)
    ? `${targetExtractedFilesReference}${reference.slice(sourceExtractedFilesReference.length)}`
    : reference;

export const rewriteScormJsonReferences = (
  value: unknown,
  sourceExtractedFilesReference: string,
  targetExtractedFilesReference: string,
): unknown => {
  if (typeof value === "string") {
    return rewriteScormStorageReference(
      value,
      sourceExtractedFilesReference,
      targetExtractedFilesReference,
    );
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      rewriteScormJsonReferences(
        item,
        sourceExtractedFilesReference,
        targetExtractedFilesReference,
      ),
    );
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        rewriteScormJsonReferences(
          item,
          sourceExtractedFilesReference,
          targetExtractedFilesReference,
        ),
      ]),
    );
  }

  return value;
};
