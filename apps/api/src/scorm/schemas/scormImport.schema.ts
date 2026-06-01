import { SCORM_IMPORT_ACTION } from "@repo/shared";
import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import { createScormCourseSchema } from "./createScormCourse.schema";
import {
  attachScormLessonPackageSchema,
  createScormLessonSchema,
} from "./createScormLesson.schema";

export const initScormImportSchema = Type.Union([
  Type.Object({
    action: Type.Literal(SCORM_IMPORT_ACTION.CREATE_COURSE),
    filename: Type.String({ minLength: 1 }),
    sizeBytes: Type.Integer({ minimum: 1 }),
    mimeType: Type.String({ minLength: 1 }),
    metadata: createScormCourseSchema,
  }),
  Type.Object({
    action: Type.Literal(SCORM_IMPORT_ACTION.CREATE_LESSON),
    filename: Type.String({ minLength: 1 }),
    sizeBytes: Type.Integer({ minimum: 1 }),
    mimeType: Type.String({ minLength: 1 }),
    metadata: createScormLessonSchema,
  }),
  Type.Object({
    action: Type.Literal(SCORM_IMPORT_ACTION.ATTACH_LESSON_PACKAGE),
    lessonId: UUIDSchema,
    filename: Type.String({ minLength: 1 }),
    sizeBytes: Type.Integer({ minimum: 1 }),
    mimeType: Type.String({ minLength: 1 }),
    metadata: attachScormLessonPackageSchema,
  }),
]);

export const initScormImportResponseSchema = Type.Object({
  packageId: UUIDSchema,
  uploadId: UUIDSchema,
  tusEndpoint: Type.String(),
  tusHeaders: Type.Record(Type.String(), Type.String()),
  expiresAt: Type.String(),
  partSize: Type.Integer({ minimum: 1 }),
});

export const completeScormImportResponseSchema = Type.Object({
  id: UUIDSchema,
  packageId: UUIDSchema,
  fileName: Type.String(),
  fileSize: Type.Number(),
  mimeType: Type.String(),
  scoCount: Type.Number(),
});

export type InitScormImportBody = Static<typeof initScormImportSchema>;
export type InitScormImportResponse = Static<typeof initScormImportResponseSchema>;
export type CompleteScormImportResponse = Static<typeof completeScormImportResponseSchema>;
