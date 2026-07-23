import { Type, type Static } from "@sinclair/typebox";

import {
  emailTemplateBlocksSchema,
  emailTemplateLanguageSchema,
  emailTemplateStringsSchema,
  localizedTextSchema,
} from "./emailNotificationTemplate.schema";

export const createEmailNotificationTemplateSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 200 }),
  baseLanguage: emailTemplateLanguageSchema,
  availableLocales: Type.Array(emailTemplateLanguageSchema, { minItems: 1 }),
  subject: Type.Optional(localizedTextSchema),
  blocks: Type.Optional(emailTemplateBlocksSchema),
  strings: Type.Optional(emailTemplateStringsSchema),
});

export type CreateEmailNotificationTemplate = Static<typeof createEmailNotificationTemplateSchema>;
