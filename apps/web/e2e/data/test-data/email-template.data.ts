import { SUPPORTED_LANGUAGES } from "@repo/shared";

import type { CreateEmailTemplateBody } from "~/api/generated-api";

export const EMAIL_TEMPLATE_DATA = {
  event: "user_assigned_to_course",
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
