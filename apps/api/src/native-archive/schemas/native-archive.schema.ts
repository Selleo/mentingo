import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import { NATIVE_ARCHIVE_JOB_STAGES, NATIVE_ARCHIVE_LIMITS } from "../native-archive.constants";

export const nativeArchiveJobResponseSchema = Type.Object({ jobId: Type.String() });
export const nativeArchiveDownloadUrlResponseSchema = Type.Object({
  url: Type.String(),
  expiresInSeconds: Type.Integer(),
});
export const nativeArchiveTusInitRequestSchema = Type.Object({
  sizeBytes: Type.Integer({ minimum: 1, maximum: NATIVE_ARCHIVE_LIMITS.MAX_ARCHIVE_BYTES }),
});
export const nativeArchiveTusInitResponseSchema = Type.Object({
  uploadId: Type.String(),
  tusEndpoint: Type.String(),
  tusHeaders: Type.Record(Type.String(), Type.String()),
  expiresAt: Type.String(),
  partSize: Type.Integer(),
});
export const nativeArchiveJobProgressSchema = Type.Object({
  stage: Type.Union(Object.values(NATIVE_ARCHIVE_JOB_STAGES).map((stage) => Type.Literal(stage))),
  percent: Type.Integer({ minimum: 0, maximum: 100 }),
});
export const nativeArchiveStatusResponseSchema = Type.Object({
  jobId: Type.String(),
  state: Type.String(),
  result: Type.Union([
    Type.Null(),
    Type.Object({
      kind: Type.Union([Type.Literal("course"), Type.Literal("learning-path")]),
      rootId: UUIDSchema,
      alreadyExists: Type.Optional(Type.Boolean()),
      createdCourseIds: Type.Optional(Type.Array(UUIDSchema)),
      reusedCourseIds: Type.Optional(Type.Array(UUIDSchema)),
    }),
  ]),
  failedReason: Type.Union([Type.String(), Type.Null()]),
  progress: Type.Union([nativeArchiveJobProgressSchema, Type.Null()]),
});
