import { EMAIL_TEMPLATE_NODE_TYPES } from "@repo/shared";
import { Placeholder } from "@tiptap/extension-placeholder";

import type { TFunction } from "i18next";

const STRUCTURAL_NODES: string[] = [
  EMAIL_TEMPLATE_NODE_TYPES.COLUMNS,
  EMAIL_TEMPLATE_NODE_TYPES.COLUMN,
  EMAIL_TEMPLATE_NODE_TYPES.SECTION,
  "repeat",
  "show",
  "blockquote",
];

const TRANSLATABLE_PLACEHOLDER_NODES: string[] = [
  EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH,
  EMAIL_TEMPLATE_NODE_TYPES.HEADING,
  EMAIL_TEMPLATE_NODE_TYPES.FOOTER,
];

export type GetBasePlaceholder = (uuid: string) => string | null;

export const buildTranslatedPlaceholder = (t: TFunction, getBasePlaceholder?: GetBasePlaceholder) =>
  Placeholder.configure({
    includeChildren: true,
    placeholder: ({ node }) => {
      if (getBasePlaceholder && TRANSLATABLE_PLACEHOLDER_NODES.includes(node.type.name)) {
        const uuid = (node.attrs as { uuid?: string }).uuid;
        if (uuid) {
          const base = getBasePlaceholder(uuid);
          if (base) return base;
        }
      }
      if (node.type.name === EMAIL_TEMPLATE_NODE_TYPES.HEADING) {
        const level = (node.attrs as { level?: number }).level ?? 1;
        return t("emailTemplates.builder.placeholder.heading", { level });
      }
      if (node.type.name === "htmlCodeBlock") {
        return t("emailTemplates.builder.placeholder.htmlCode");
      }
      if (STRUCTURAL_NODES.includes(node.type.name)) {
        return "";
      }
      return t("emailTemplates.builder.placeholder.writeSomethingOrSlash");
    },
  });
