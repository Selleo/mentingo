import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import type { Static } from "@sinclair/typebox";

export const s3MultipartInitSchema = Type.Object({
  uploadId: UUIDSchema,
});

export const s3MultipartInitResponseSchema = Type.Object({
  multipartUploadId: Type.String(),
  fileKey: Type.String(),
  partSize: Type.Optional(Type.Integer({ minimum: 1 })),
});

export const s3MultipartSignSchema = Type.Object({
  uploadId: UUIDSchema,
  partNumber: Type.Integer({ minimum: 1 }),
});

export const s3MultipartSignResponseSchema = Type.Object({
  url: Type.String(),
});

export const s3MultipartCompleteSchema = Type.Object({
  uploadId: UUIDSchema,
  parts: Type.Array(
    Type.Object({
      etag: Type.String({ minLength: 1 }),
      partNumber: Type.Integer({ minimum: 1 }),
    }),
  ),
});

export const s3MultipartCompleteResponseSchema = Type.Object({
  success: Type.Boolean(),
});

export type S3MultipartInitBody = Static<typeof s3MultipartInitSchema>;
export type S3MultipartInitResponse = Static<typeof s3MultipartInitResponseSchema>;
export type S3MultipartSignBody = Static<typeof s3MultipartSignSchema>;
export type S3MultipartSignResponse = Static<typeof s3MultipartSignResponseSchema>;
export type S3MultipartCompleteBody = Static<typeof s3MultipartCompleteSchema>;
export type S3MultipartCompleteResponse = Static<typeof s3MultipartCompleteResponseSchema>;
