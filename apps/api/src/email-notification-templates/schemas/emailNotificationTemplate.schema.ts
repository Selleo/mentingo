import { EMAIL_TEMPLATE_STATUSES, SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";
import { createSelectSchema } from "drizzle-typebox";

import { emailNotificationTemplates } from "src/storage/schema";
import { omitTenantId } from "src/utils/omitTenantId";

import type { EmailTemplateBlocks, EmailTemplateStrings, LocalizedText } from "@repo/shared";

export const emailTemplateLanguageSchema = Type.Enum(SUPPORTED_LANGUAGES);
export const emailTemplateStatusSchema = Type.Enum(EMAIL_TEMPLATE_STATUSES);

export const tiptapJsonNodeSchema = Type.Recursive(
  (self) =>
    Type.Object(
      {
        type: Type.Optional(Type.String()),
        attrs: Type.Optional(Type.Record(Type.String(), Type.Any())),
        content: Type.Optional(Type.Array(self)),
        marks: Type.Optional(
          Type.Array(
            Type.Object(
              {
                type: Type.String(),
                attrs: Type.Optional(Type.Record(Type.String(), Type.Any())),
              },
              { additionalProperties: true },
            ),
          ),
        ),
        text: Type.Optional(Type.String()),
      },
      { additionalProperties: true },
    ),
  { $id: "TiptapJsonNode" },
);

export const emailTemplateBlocksSchema = Type.Unsafe<EmailTemplateBlocks>(tiptapJsonNodeSchema);

export const emailTemplateStringsSchema = Type.Unsafe<EmailTemplateStrings>(
  Type.Partial(
    Type.Record(
      emailTemplateLanguageSchema,
      Type.Record(Type.String(), Type.Array(tiptapJsonNodeSchema)),
    ),
  ),
);

export const localizedTextSchema = Type.Unsafe<LocalizedText>(
  Type.Partial(Type.Record(emailTemplateLanguageSchema, Type.String())),
);

export const emailNotificationTemplateSchema = Type.Composite([
  Type.Omit(omitTenantId(createSelectSchema(emailNotificationTemplates)), [
    "subject",
    "blocks",
    "strings",
    "baseLanguage",
    "availableLocales",
    "status",
    "archivedAt",
  ]),
  Type.Object({
    subject: localizedTextSchema,
    blocks: emailTemplateBlocksSchema,
    strings: emailTemplateStringsSchema,
    baseLanguage: emailTemplateLanguageSchema,
    availableLocales: Type.Array(emailTemplateLanguageSchema),
    status: emailTemplateStatusSchema,
    archivedAt: Type.Union([Type.String(), Type.Null()]),
  }),
]);

export const emailNotificationTemplatesListSchema = Type.Array(emailNotificationTemplateSchema);

export type EmailNotificationTemplate = Static<typeof emailNotificationTemplateSchema>;
