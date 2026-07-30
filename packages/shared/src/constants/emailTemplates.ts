export const EMAIL_TEMPLATE_STATUSES = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
} as const;

export type EmailTemplateStatus =
  (typeof EMAIL_TEMPLATE_STATUSES)[keyof typeof EMAIL_TEMPLATE_STATUSES];

export const TENANT_LOGO_VARIABLE = "{{branding.logo_url}}";
export const TENANT_LOGO_CID = "logo";
export const TENANT_LOGO_CID_SRC = `cid:${TENANT_LOGO_CID}`;
export const DEFAULT_TENANT_PRIMARY_COLOR = "#4796FD";
export const DEFAULT_PLATFORM_LOGO_PATH = "/app/assets/svgs/app-logo.svg";
