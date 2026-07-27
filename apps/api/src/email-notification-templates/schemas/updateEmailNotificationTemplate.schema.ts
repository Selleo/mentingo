import { Type, type Static } from "@sinclair/typebox";

import {
  emailTemplateBlocksSchema,
  emailTemplateLanguageSchema,
  emailTemplateStringsSchema,
  localizedTextSchema,
} from "./emailNotificationTemplate.schema";

export const updateEmailNotificationTemplateSchema = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1, maxLength: 200 }),
    baseLanguage: emailTemplateLanguageSchema,
    availableLocales: Type.Array(emailTemplateLanguageSchema, { minItems: 1 }),
    subject: localizedTextSchema,
    blocks: emailTemplateBlocksSchema,
    strings: emailTemplateStringsSchema,
  }),
);

export type UpdateEmailNotificationTemplate = Static<typeof updateEmailNotificationTemplateSchema>;
