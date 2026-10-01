import { Type } from "@sinclair/typebox";

const scormPathSegmentSchema = Type.String({
  minLength: 1,
  pattern: "^(?!\\.{1,2}$)[^/\\\\]+$",
});

export const nativeArchiveScormPathSegmentsSchema = Type.Array(scormPathSegmentSchema, {
  minItems: 1,
});
