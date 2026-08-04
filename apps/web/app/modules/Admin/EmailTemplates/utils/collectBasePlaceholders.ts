import {
  EMAIL_TEMPLATE_NODE_TYPES,
  TRANSLATABLE_EMAIL_TEMPLATE_NODE_TYPES,
  EMAIL_TEMPLATE_NODE_UUID_ATTR,
} from "@repo/shared";

import type { EmailTemplateBlocks, EmailTemplateNode } from "@repo/shared";

const flattenText = (nodes: EmailTemplateNode[] | undefined): string => {
  if (!nodes) return "";
  let out = "";
  for (const node of nodes) {
    if (typeof node.text === "string") out += node.text;
    if (node.content) out += flattenText(node.content);
  }
  return out;
};

export const collectBasePlaceholders = (blocks: EmailTemplateBlocks): Record<string, string> => {
  const map: Record<string, string> = {};

  const walk = (node: EmailTemplateNode): void => {
    if (node.type && TRANSLATABLE_EMAIL_TEMPLATE_NODE_TYPES.has(node.type)) {
      const uuid = node.attrs?.[EMAIL_TEMPLATE_NODE_UUID_ATTR];
      if (typeof uuid === "string" && uuid.length > 0) {
        const text =
          node.type === EMAIL_TEMPLATE_NODE_TYPES.BUTTON
            ? typeof node.attrs?.text === "string"
              ? node.attrs.text
              : ""
            : flattenText(node.content);
        map[uuid] = text;
      }
    }
    if (node.content) for (const child of node.content) walk(child);
  };

  walk(blocks);
  return map;
};
