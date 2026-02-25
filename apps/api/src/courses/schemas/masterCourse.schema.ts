import { COURSE_ORIGIN_TYPES, MASTER_COURSE_EXPORT_SYNC_STATUSES } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const courseOriginTypeSchema = Type.Enum(COURSE_ORIGIN_TYPES);

export const masterCourseExportBodySchema = Type.Object({
  targetTenantIds: Type.Array(UUIDSchema, { minItems: 1 }),
});

export const masterCourseExportQueuedItemSchema = Type.Object({
  targetTenantId: UUIDSchema,
  queued: Type.Boolean(),
  reason: Type.Optional(Type.String()),
  exportId: Type.Optional(UUIDSchema),
});

export const masterCourseExportResponseSchema = Type.Object({
  sourceCourseId: UUIDSchema,
  jobs: Type.Array(masterCourseExportQueuedItemSchema),
});

export const masterCourseExportLinkSchema = Type.Object({
  id: UUIDSchema,
  sourceTenantId: UUIDSchema,
  sourceCourseId: UUIDSchema,
  targetTenantId: UUIDSchema,
  targetCourseId: Type.Union([UUIDSchema, Type.Null()]),
  syncStatus: Type.Enum(MASTER_COURSE_EXPORT_SYNC_STATUSES),
  lastSyncedAt: Type.Union([Type.String(), Type.Null()]),
});

export const masterCourseExportCandidateSchema = Type.Object({
  id: UUIDSchema,
  name: Type.String(),
  host: Type.String(),
  isExported: Type.Boolean(),
  targetCourseId: Type.Union([UUIDSchema, Type.Null()]),
  syncStatus: Type.Union([Type.Enum(MASTER_COURSE_EXPORT_SYNC_STATUSES), Type.Null()]),
  lastSyncedAt: Type.Union([Type.String(), Type.Null()]),
});

export const masterCourseExportCandidatesResponseSchema = Type.Object({
  tenants: Type.Array(masterCourseExportCandidateSchema),
  summary: Type.Object({
    totalTenants: Type.Number(),
    exportedCount: Type.Number(),
    remainingCount: Type.Number(),
  }),
});

export const masterCourseJobStatusResponseSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  state: Type.String(),
  attemptsMade: Type.Number(),
  failedReason: Type.Union([Type.String(), Type.Null()]),
});

export type CourseOriginType = Static<typeof courseOriginTypeSchema>;
export type MasterCourseExportBody = Static<typeof masterCourseExportBodySchema>;
export type MasterCourseExportResponse = Static<typeof masterCourseExportResponseSchema>;
export type MasterCourseExportLink = Static<typeof masterCourseExportLinkSchema>;
export type MasterCourseExportCandidatesResponse = Static<
  typeof masterCourseExportCandidatesResponseSchema
>;
