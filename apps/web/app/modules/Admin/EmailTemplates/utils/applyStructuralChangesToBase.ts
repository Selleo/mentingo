import {
  EMAIL_TEMPLATE_NODE_TYPES,
  TRANSLATABLE_EMAIL_TEMPLATE_NODE_TYPES,
  EMAIL_TEMPLATE_NODE_UUID_ATTR,
  cloneEmailTemplateNode,
} from "@repo/shared";

import type { EmailTemplateBlocks, EmailTemplateNode } from "@repo/shared";

export const applyStructuralChangesToBase = (
  doc: EmailTemplateBlocks,
  base: EmailTemplateBlocks,
): EmailTemplateBlocks => {
  const originalByUuid = new Map<string, EmailTemplateNode>();
  const collect = (node: EmailTemplateNode) => {
    const raw = node.attrs?.[EMAIL_TEMPLATE_NODE_UUID_ATTR];
    if (typeof raw === "string") originalByUuid.set(raw, node);
    if (node.content) node.content.forEach(collect);
  };
  collect(base);

  const walk = (node: EmailTemplateNode): EmailTemplateNode => {
    const raw = node.attrs?.[EMAIL_TEMPLATE_NODE_UUID_ATTR];
    const original = typeof raw === "string" ? originalByUuid.get(raw) : undefined;

    if (original && node.type && TRANSLATABLE_EMAIL_TEMPLATE_NODE_TYPES.has(node.type)) {
      if (node.type === EMAIL_TEMPLATE_NODE_TYPES.BUTTON) {
        return {
          ...node,
          attrs: { ...(node.attrs ?? {}), text: original.attrs?.text ?? "" },
        };
      }
      const restored: EmailTemplateNode = { ...node };
      if (node.attrs) restored.attrs = { ...node.attrs };
      if (original.content) restored.content = original.content.map(cloneEmailTemplateNode);
      else delete restored.content;
      return restored;
    }

    if (node.content) {
      return { ...node, content: node.content.map(walk) };
    }
    return node;
  };

  return walk(doc) as EmailTemplateBlocks;
};
