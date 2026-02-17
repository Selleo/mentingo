import { VIDEO_EMBED_PROVIDERS } from "@repo/shared";
import { Type } from "@sinclair/typebox";

export const getThumbnailQuerySchema = Type.Object({
  sourceUrl: Type.String({ minLength: 1 }),
  provider: Type.Optional(Type.Enum(VIDEO_EMBED_PROVIDERS)),
});
