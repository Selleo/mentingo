import { VIDEO_UPLOAD_STATUS } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import type { Static } from "@sinclair/typebox";

export const videoUploadStatusSchema = Type.Object({
  uploadId: Type.String(),
  placeholderKey: Type.String(),
  status: Type.Union([
    Type.Literal(VIDEO_UPLOAD_STATUS.QUEUED),
    Type.Literal(VIDEO_UPLOAD_STATUS.UPLOADED),
    Type.Literal(VIDEO_UPLOAD_STATUS.PROCESSED),
    Type.Literal(VIDEO_UPLOAD_STATUS.FAILED),
  ]),
  provider: Type.Optional(Type.Union([Type.Literal("bunny"), Type.Literal("s3")])),
  fileKey: Type.Optional(Type.String()),
  fileUrl: Type.Optional(Type.String()),
  bunnyVideoId: Type.Optional(Type.String()),
  multipartUploadId: Type.Optional(Type.String()),
  partSize: Type.Optional(Type.Integer({ minimum: 1 })),
  fileType: Type.Optional(Type.String()),
  lessonId: Type.Optional(Type.String()),
  error: Type.Optional(Type.String()),
  userId: Type.Optional(Type.String()),
});

export const videoUploadStatusResponseSchema = Type.Union([videoUploadStatusSchema, Type.Null()]);

export type VideoUploadStatusResponse = Static<typeof videoUploadStatusResponseSchema>;
