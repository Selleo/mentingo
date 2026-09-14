import {
  EMAIL_TEMPLATE_BLOCK_TYPES,
  EMAIL_TEMPLATE_HEADER_SOURCES,
  EMAIL_TEMPLATE_DOCUMENT_VERSION,
  EMAIL_TEMPLATE_EVENTS,
  EMAIL_TEMPLATE_INLINE_MARK_TYPES,
  EMAIL_TEMPLATE_STATUSES,
  EMAIL_TEMPLATE_VARIABLE_TYPES,
} from "@repo/email-templates";
import { type Static, type TSchema, Type } from "@sinclair/typebox";

import { UUIDSchema, paginatedResponse } from "src/common";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

export const emailTemplateEventSchema = Type.Enum(EMAIL_TEMPLATE_EVENTS);
const emailTemplateStatusSchema = Type.Enum(EMAIL_TEMPLATE_STATUSES);

const localizedValueSchema = <T extends TSchema>(valueSchema: T) =>
  Type.Partial(
    Type.Record(supportedLanguagesSchema, valueSchema, {
      additionalProperties: false,
    }),
  );

const inlineMarkSchema = Type.Union([
  Type.Object(
    { type: Type.Literal(EMAIL_TEMPLATE_INLINE_MARK_TYPES.BOLD) },
    { additionalProperties: false },
  ),
  Type.Object(
    { type: Type.Literal(EMAIL_TEMPLATE_INLINE_MARK_TYPES.ITALIC) },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal(EMAIL_TEMPLATE_INLINE_MARK_TYPES.LINK),
      attrs: Type.Object({ href: Type.String({ minLength: 1 }) }, { additionalProperties: false }),
    },
    { additionalProperties: false },
  ),
]);

const inlineNodeSchema = Type.Object(
  {
    type: Type.Literal("text"),
    text: Type.String(),
    marks: Type.Optional(Type.Array(inlineMarkSchema)),
  },
  { additionalProperties: false },
);

const paragraphNodeSchema = Type.Object(
  {
    type: Type.Literal("paragraph"),
    content: Type.Optional(Type.Array(inlineNodeSchema)),
  },
  { additionalProperties: false },
);

const emailTemplateBlockSchema = Type.Union([
  Type.Object(
    {
      type: Type.Literal(EMAIL_TEMPLATE_BLOCK_TYPES.HEADER),
      attrs: Type.Object(
        { source: Type.Enum(EMAIL_TEMPLATE_HEADER_SOURCES) },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal(EMAIL_TEMPLATE_BLOCK_TYPES.HEADING),
      content: Type.Array(paragraphNodeSchema),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal(EMAIL_TEMPLATE_BLOCK_TYPES.TEXT),
      content: Type.Array(paragraphNodeSchema),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal(EMAIL_TEMPLATE_BLOCK_TYPES.BUTTON),
      attrs: Type.Object(
        { label: Type.String({ minLength: 1 }), url: Type.String({ minLength: 1 }) },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal(EMAIL_TEMPLATE_BLOCK_TYPES.IMAGE),
      attrs: Type.Object(
        {
          src: Type.String({ minLength: 1 }),
          alt: Type.String(),
          width: Type.Optional(Type.Number({ minimum: 1, maximum: 1200 })),
        },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    { type: Type.Literal(EMAIL_TEMPLATE_BLOCK_TYPES.DIVIDER) },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal(EMAIL_TEMPLATE_BLOCK_TYPES.SPACER),
      attrs: Type.Object(
        { height: Type.Number({ minimum: 0, maximum: 200 }) },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal(EMAIL_TEMPLATE_BLOCK_TYPES.FOOTER),
      attrs: Type.Object({ text: Type.String() }, { additionalProperties: false }),
      content: Type.Optional(Type.Array(paragraphNodeSchema)),
    },
    { additionalProperties: false },
  ),
]);

export const emailTemplateDocumentSchema = Type.Object(
  {
    type: Type.Literal("doc"),
    version: Type.Literal(EMAIL_TEMPLATE_DOCUMENT_VERSION),
    content: Type.Array(emailTemplateBlockSchema),
  },
  { additionalProperties: false },
);

const localizedTextSchema = localizedValueSchema(Type.String());
const localizedContentSchema = localizedValueSchema(emailTemplateDocumentSchema);

export const emailTemplateSchema = Type.Object(
  {
    id: Type.Union([UUIDSchema, Type.Null()]),
    source: Type.Union([Type.Literal("default"), Type.Literal("override")]),
    editable: Type.Boolean(),
    variables: Type.Array(
      Type.Object(
        {
          key: Type.String(),
          label: Type.String(),
          type: Type.Enum(EMAIL_TEMPLATE_VARIABLE_TYPES),
          required: Type.Optional(Type.Boolean()),
          requiredInTemplate: Type.Optional(Type.Boolean()),
          sampleValue: Type.Union([
            Type.String(),
            Type.Number(),
            Type.Boolean(),
            Type.Array(Type.Unknown()),
          ]),
        },
        { additionalProperties: false },
      ),
    ),
    event: emailTemplateEventSchema,
    name: localizedTextSchema,
    subject: localizedTextSchema,
    content: localizedContentSchema,
    status: Type.Union([emailTemplateStatusSchema, Type.Null()]),
    baseLanguage: supportedLanguagesSchema,
    availableLocales: Type.Array(supportedLanguagesSchema),
    completeLocales: Type.Array(supportedLanguagesSchema),
    createdAt: Type.Union([Type.String(), Type.Null()]),
    updatedAt: Type.Union([Type.String(), Type.Null()]),
    publishedAt: Type.Union([Type.String(), Type.Null()]),
    archivedAt: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
);

export const paginatedEmailTemplateSchema = paginatedResponse(Type.Array(emailTemplateSchema));

export const createEmailTemplateSchema = Type.Object(
  {
    event: emailTemplateEventSchema,
    name: localizedTextSchema,
    subject: localizedTextSchema,
    content: localizedContentSchema,
    baseLanguage: Type.Optional(supportedLanguagesSchema),
  },
  { additionalProperties: false },
);

export const updateEmailTemplateSchema = Type.Partial(
  Type.Object(
    { name: localizedTextSchema, subject: localizedTextSchema, content: localizedContentSchema },
    { additionalProperties: false },
  ),
  { minProperties: 1 },
);

export const updateEmailTemplateBaseLanguageSchema = Type.Object(
  { baseLanguage: supportedLanguagesSchema },
  { additionalProperties: false },
);

export const previewEmailTemplateSchema = Type.Object(
  {
    event: emailTemplateEventSchema,
    language: supportedLanguagesSchema,
    baseLanguage: supportedLanguagesSchema,
    subject: localizedTextSchema,
    content: localizedContentSchema,
  },
  { additionalProperties: false },
);

export const emailTemplatePreviewResponseSchema = Type.Object(
  {
    event: emailTemplateEventSchema,
    language: supportedLanguagesSchema,
    subject: Type.String(),
    html: Type.String(),
    text: Type.String(),
    warnings: Type.Array(Type.String()),
  },
  { additionalProperties: false },
);

export type CreateEmailTemplateBody = Static<typeof createEmailTemplateSchema>;
export type UpdateEmailTemplateBody = Static<typeof updateEmailTemplateSchema>;
export type UpdateEmailTemplateBaseLanguageBody = Static<
  typeof updateEmailTemplateBaseLanguageSchema
>;
export type PreviewEmailTemplateBody = Static<typeof previewEmailTemplateSchema>;
export type EmailTemplateResponse = Static<typeof emailTemplateSchema>;
export type EmailTemplatePreviewResponse = Static<typeof emailTemplatePreviewResponseSchema>;

export const emailTemplateImageResponseSchema = Type.Object(
  {
    resourceId: UUIDSchema,
    src: Type.String(),
    previewUrl: Type.String(),
  },
  { additionalProperties: false },
);
export const emailTemplateTestResponseSchema = Type.Object(
  {
    jobId: Type.String(),
  },
  { additionalProperties: false },
);
export type EmailTemplateImageResponse = Static<typeof emailTemplateImageResponseSchema>;
export type EmailTemplateTestResponse = Static<typeof emailTemplateTestResponseSchema>;
