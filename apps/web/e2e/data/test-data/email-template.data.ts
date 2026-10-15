import { BUILT_IN_EMAIL_TEMPLATE_KEYS, SUPPORTED_LANGUAGES } from "@repo/shared";

import type { CreateEmailTemplateBody } from "~/api/generated-api";

export const EMAIL_TEMPLATE_DATA = {
  builtInTemplateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.ASSIGNMENT_WITH_DEADLINE,
  catalogPath: "/admin/automations?tab=email-templates",
  listPath: "/admin/email-templates",
  namePrefix: "E2E Email",
  subject: "Your learning assignment",
  body: "Start learning today",
  variable: "course_name",
  english: SUPPORTED_LANGUAGES.EN,
  polish: SUPPORTED_LANGUAGES.PL,
} as const;

export const emailTemplateDocument = (
  ...paragraphs: string[]
): NonNullable<CreateEmailTemplateBody["content"]["en"]> => ({
  type: "doc",
  version: 1,
  content: paragraphs.map((text) => ({
    type: "text",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  })),
});

/** Generic author-declared values; these declarations are independent of notification events. */
export const EMAIL_TEMPLATE_PLACEHOLDERS = [
  {
    name: EMAIL_TEMPLATE_DATA.variable,
    label: "Course name",
    type: "string",
    required: false,
    sampleValue: "Sample learning course",
  },
] satisfies NonNullable<CreateEmailTemplateBody["placeholders"]>;
