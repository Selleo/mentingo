import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type } from "@sinclair/typebox";

export const nativeArchiveLanguageSchema = Type.Enum(SUPPORTED_LANGUAGES);
export const nativeArchiveLocalizedTextSchema = Type.Partial(
  Type.Record(nativeArchiveLanguageSchema, Type.String(), { additionalProperties: false }),
);
