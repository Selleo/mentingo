import {
  MASTER_COURSE_EXPORT_SYNC_STATUSES,
  LEARNING_PATH_PROGRESS_STATUSES,
  LEARNING_PATH_STATUSES,
  SUPPORTED_LANGUAGES,
  type LocalizedText,
} from "@repo/shared";
import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import { PROGRESS_STATUSES } from "src/utils/types/progress.type";

export const learningPathStatusOptions = Type.Enum(LEARNING_PATH_STATUSES);
export const supportedLanguagesOptions = Type.Enum(SUPPORTED_LANGUAGES);
export const localizedTextSchema = Type.Record(Type.String(), Type.String());
export const learningPathProgressStatusOptions = Type.Union([
  Type.Literal(LEARNING_PATH_PROGRESS_STATUSES.NOT_STARTED),
  Type.Literal(LEARNING_PATH_PROGRESS_STATUSES.IN_PROGRESS),
  Type.Literal(LEARNING_PATH_PROGRESS_STATUSES.COMPLETED),
]);

export const learningPathSchema = Type.Object({
  id: UUIDSchema,
  title: localizedTextSchema,
  description: localizedTextSchema,
  thumbnailReference: Type.Union([Type.String(), Type.Null()]),
  status: learningPathStatusOptions,
  includesCertificate: Type.Boolean(),
  sequenceEnabled: Type.Boolean(),
  authorId: UUIDSchema,
  baseLanguage: supportedLanguagesOptions,
  availableLocales: Type.Array(supportedLanguagesOptions),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const learningPathCourseSchema = Type.Object({
  id: UUIDSchema,
  learningPathId: UUIDSchema,
  courseId: UUIDSchema,
  displayOrder: Type.Number(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const learningPathCourseDetailSchema = Type.Intersect([
  learningPathCourseSchema,
  Type.Object({
    progress: Type.Enum(PROGRESS_STATUSES),
    isLocked: Type.Boolean(),
    completedAt: Type.Union([Type.String(), Type.Null()]),
  }),
]);

export const learningPathDetailSchema = Type.Intersect([
  learningPathSchema,
  Type.Object({
    progress: learningPathProgressStatusOptions,
    courses: Type.Array(learningPathCourseDetailSchema),
  }),
]);

export const createLearningPathSchema = Type.Object({
  language: supportedLanguagesOptions,
  title: Type.String(),
  description: Type.String(),
  thumbnailReference: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  status: Type.Optional(learningPathStatusOptions),
  includesCertificate: Type.Optional(Type.Boolean()),
  sequenceEnabled: Type.Optional(Type.Boolean()),
});

export const updateLearningPathSchema = Type.Partial(
  Type.Object({
    language: supportedLanguagesOptions,
    title: Type.String(),
    description: Type.String(),
    thumbnailReference: Type.Union([Type.String(), Type.Null()]),
    status: learningPathStatusOptions,
    includesCertificate: Type.Boolean(),
    sequenceEnabled: Type.Boolean(),
  }),
);

export const learningPathCourseIdsSchema = Type.Object({
  courseIds: Type.Array(UUIDSchema),
});

export const learningPathStudentIdsSchema = Type.Object({
  studentIds: Type.Array(UUIDSchema),
});

export const learningPathGroupIdsSchema = Type.Object({
  groupIds: Type.Array(UUIDSchema),
});

export const learningPathExportBodySchema = Type.Object({
  targetTenantIds: Type.Array(UUIDSchema, { minItems: 1 }),
});

export const learningPathExportQueuedItemSchema = Type.Object({
  targetTenantId: UUIDSchema,
  queued: Type.Boolean(),
  reason: Type.Optional(Type.String()),
  exportId: Type.Optional(UUIDSchema),
});

export const learningPathExportResponseSchema = Type.Object({
  sourceLearningPathId: UUIDSchema,
  jobs: Type.Array(learningPathExportQueuedItemSchema),
});

export const learningPathExportLinkSchema = Type.Object({
  id: UUIDSchema,
  sourceTenantId: UUIDSchema,
  sourceLearningPathId: UUIDSchema,
  targetTenantId: UUIDSchema,
  targetLearningPathId: Type.Union([UUIDSchema, Type.Null()]),
  syncStatus: Type.Enum(MASTER_COURSE_EXPORT_SYNC_STATUSES),
  lastSyncedAt: Type.Union([Type.String(), Type.Null()]),
});

export const learningPathExportCandidateSchema = Type.Object({
  id: UUIDSchema,
  name: Type.String(),
  host: Type.String(),
  isExported: Type.Boolean(),
  targetLearningPathId: Type.Union([UUIDSchema, Type.Null()]),
  syncStatus: Type.Union([Type.Enum(MASTER_COURSE_EXPORT_SYNC_STATUSES), Type.Null()]),
  lastSyncedAt: Type.Union([Type.String(), Type.Null()]),
});

export const learningPathExportCandidatesResponseSchema = Type.Object({
  tenants: Type.Array(learningPathExportCandidateSchema),
  summary: Type.Object({
    totalTenants: Type.Number(),
    exportedCount: Type.Number(),
    remainingCount: Type.Number(),
  }),
});

export const learningPathJobStatusSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  state: Type.String(),
  attemptsMade: Type.Number(),
  failedReason: Type.Union([Type.String(), Type.Null()]),
});

export const learningPathCertificateSchema = Type.Object({
  id: UUIDSchema,
  userId: UUIDSchema,
  learningPathId: UUIDSchema,
  courseTitle: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  completionDate: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  fullName: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  certificateSignatureUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  certificateFontColor: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  createdAt: Type.String(),
});

export const learningPathCertificateShareLinkSchema = Type.Object({
  shareUrl: Type.String(),
  linkedinShareUrl: Type.String(),
});

export const learningPathCertificateDownloadSchema = Type.Object({
  certificateId: UUIDSchema,
  language: Type.Enum(SUPPORTED_LANGUAGES),
});

export const learningPathCertificateCreateShareLinkSchema = Type.Object({
  certificateId: UUIDSchema,
  language: Type.Optional(Type.String()),
});

export const learningPathCertificateShareSchema = Type.Union([
  learningPathCertificateSchema,
  Type.Null(),
]);

export type LearningPathSchema = {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  thumbnailReference: string | null;
  status: Static<typeof learningPathStatusOptions>;
  includesCertificate: boolean;
  sequenceEnabled: boolean;
  authorId: string;
  baseLanguage: Static<typeof supportedLanguagesOptions>;
  availableLocales: Static<typeof supportedLanguagesOptions>[];
  createdAt: string;
  updatedAt: string;
};
export type LearningPathCourseSchema = Static<typeof learningPathCourseSchema>;
export type LearningPathCourseDetailSchema = Static<typeof learningPathCourseDetailSchema>;
export type LearningPathDetailSchema = LearningPathSchema & {
  progress: Static<typeof learningPathProgressStatusOptions>;
  courses: LearningPathCourseDetailSchema[];
};
export type CreateLearningPathBody = Static<typeof createLearningPathSchema>;
export type UpdateLearningPathBody = Static<typeof updateLearningPathSchema>;
export type LearningPathCourseIdsBody = Static<typeof learningPathCourseIdsSchema>;
export type LearningPathStudentIdsBody = Static<typeof learningPathStudentIdsSchema>;
export type LearningPathGroupIdsBody = Static<typeof learningPathGroupIdsSchema>;
export type LearningPathExportBody = Static<typeof learningPathExportBodySchema>;
export type LearningPathExportResponse = Static<typeof learningPathExportResponseSchema>;
export type LearningPathExportLink = Static<typeof learningPathExportLinkSchema>;
export type LearningPathExportCandidate = Static<typeof learningPathExportCandidateSchema>;
export type LearningPathExportCandidatesResponse = Static<
  typeof learningPathExportCandidatesResponseSchema
>;
export type LearningPathJobStatus = Static<typeof learningPathJobStatusSchema>;
export type LearningPathCertificate = Static<typeof learningPathCertificateSchema>;
export type LearningPathCertificateShareLink = Static<
  typeof learningPathCertificateShareLinkSchema
>;
export type LearningPathCertificateShare = Static<typeof learningPathCertificateShareSchema>;
export type LearningPathCertificateDownloadBody = Static<
  typeof learningPathCertificateDownloadSchema
>;
export type LearningPathCertificateCreateShareLinkBody = Static<
  typeof learningPathCertificateCreateShareLinkSchema
>;
