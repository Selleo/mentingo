import {
  EMAIL_TEMPLATE_NODE_TYPES,
  TRANSLATABLE_EMAIL_TEMPLATE_NODE_TYPES,
  EMAIL_TEMPLATE_NODE_UUID_ATTR,
} from "@repo/shared";

import type { EmailTemplateBlocks, EmailTemplateNode, TranslationFragment } from "@repo/shared";

export const extractStringsFromDoc = (
  doc: EmailTemplateBlocks,
): Record<string, TranslationFragment> => {
  const out: Record<string, TranslationFragment> = {};

  const walk = (node: EmailTemplateNode): void => {
    if (node.type && TRANSLATABLE_EMAIL_TEMPLATE_NODE_TYPES.has(node.type)) {
      const uuid = node.attrs?.[EMAIL_TEMPLATE_NODE_UUID_ATTR];
      if (typeof uuid === "string") {
        if (node.type === EMAIL_TEMPLATE_NODE_TYPES.BUTTON) {
          const raw = node.attrs?.text;
          const text = typeof raw === "string" ? raw : "";
          out[uuid] = text.length > 0 ? [{ type: EMAIL_TEMPLATE_NODE_TYPES.TEXT, text }] : [];
        } else {
          out[uuid] = (node.content ?? []) as TranslationFragment;
        }
      }
    }
    if (node.content) for (const child of node.content) walk(child);
  };

  walk(doc);
  return out;
};
