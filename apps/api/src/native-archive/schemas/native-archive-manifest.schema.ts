import { Type } from "@sinclair/typebox";

import {
  NATIVE_ARCHIVE_FORMAT,
  NATIVE_ARCHIVE_KIND,
  NATIVE_ARCHIVE_LIMITS,
  NATIVE_ARCHIVE_VERSION,
} from "../native-archive.constants";

export const nativeArchiveAssetSchema = Type.Object({
  path: Type.String({ pattern: "^assets/[a-f0-9]{64}$" }),
  sha256: Type.String({ pattern: "^[a-f0-9]{64}$" }),
  byteLength: Type.Integer({
    minimum: 0,
    maximum: NATIVE_ARCHIVE_LIMITS.MAX_UNCOMPRESSED_BYTES,
  }),
  contentType: Type.Union([Type.Literal("application/octet-stream"), Type.Literal("video/mp4")]),
  sourceReference: Type.String({ maxLength: 500 }),
});

export const nativeArchiveManifestSchema = Type.Object({
  format: Type.Literal(NATIVE_ARCHIVE_FORMAT),
  version: Type.Literal(NATIVE_ARCHIVE_VERSION),
  kind: Type.Union([
    Type.Literal(NATIVE_ARCHIVE_KIND.COURSE),
    Type.Literal(NATIVE_ARCHIVE_KIND.LEARNING_PATH),
  ]),
  rootId: Type.String({ format: "uuid" }),
  courseIds: Type.Array(Type.String({ format: "uuid" }), { uniqueItems: true }),
  exportedAt: Type.String(),
  applicationVersion: Type.String(),
  assets: Type.Array(nativeArchiveAssetSchema, {
    maxItems: NATIVE_ARCHIVE_LIMITS.MAX_ENTRIES,
  }),
});
