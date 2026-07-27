import { Type, type Static } from "@sinclair/typebox";

export const emailTemplateImageUploadResponseSchema = Type.Object({
  url: Type.String(),
});

export type EmailTemplateImageUploadResponse = Static<
  typeof emailTemplateImageUploadResponseSchema
>;
