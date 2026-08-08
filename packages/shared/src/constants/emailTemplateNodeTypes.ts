export const EMAIL_TEMPLATE_NODE_TYPES = {
  DOC: "doc",
  PARAGRAPH: "paragraph",
  HEADING: "heading",
  TEXT: "text",
  IMAGE: "image",
  BUTTON: "button",
  FOOTER: "footer",
  DIVIDER: "divider",
  SPACER: "spacer",
  SECTION: "section",
  COLUMNS: "columns",
  COLUMN: "column",
  HORIZONTAL_RULE: "horizontalRule",
  VARIABLE: "variable",
} as const;

export type EmailTemplateNodeType =
  (typeof EMAIL_TEMPLATE_NODE_TYPES)[keyof typeof EMAIL_TEMPLATE_NODE_TYPES];

export const TRANSLATABLE_EMAIL_TEMPLATE_NODE_TYPES = new Set<string>([
  EMAIL_TEMPLATE_NODE_TYPES.HEADING,
  EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH,
  EMAIL_TEMPLATE_NODE_TYPES.BUTTON,
  EMAIL_TEMPLATE_NODE_TYPES.FOOTER,
]);

export const EMAIL_TEMPLATE_NODE_UUID_ATTR = "uuid";
