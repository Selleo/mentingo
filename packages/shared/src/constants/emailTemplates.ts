export const EMAIL_TEMPLATE_STATUSES = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
} as const;

export type EmailTemplateStatus =
  (typeof EMAIL_TEMPLATE_STATUSES)[keyof typeof EMAIL_TEMPLATE_STATUSES];
