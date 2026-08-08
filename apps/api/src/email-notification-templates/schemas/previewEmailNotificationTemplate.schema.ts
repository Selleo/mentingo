import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

export const previewEmailNotificationTemplateSchema = Type.Object({
  language: Type.Enum(SUPPORTED_LANGUAGES),
  subject: Type.String(),
  html: Type.String(),
});

export type PreviewEmailNotificationTemplate = Static<
  typeof previewEmailNotificationTemplateSchema
>;
