import { SCORM_CONTENT_TOKEN } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

export const renewScormContentSchema = Type.Object({
  token: Type.String({
    pattern: SCORM_CONTENT_TOKEN.PATTERN,
    minLength: SCORM_CONTENT_TOKEN.LENGTH,
    maxLength: SCORM_CONTENT_TOKEN.LENGTH,
  }),
});
export type RenewScormContentBody = Static<typeof renewScormContentSchema>;

export const renewScormContentResponseSchema = Type.Object({ renewed: Type.Boolean() });
export type RenewScormContentResponse = Static<typeof renewScormContentResponseSchema>;
