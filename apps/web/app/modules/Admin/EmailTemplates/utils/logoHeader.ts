import { EMAIL_TEMPLATE_NODE_TYPES } from "@repo/shared";
import { v4 as uuid } from "uuid";

import type { CommandProps } from "@maily-to/core/blocks";
import type { EmailTemplateBlocks, EmailTemplateNode } from "@repo/shared";

export const TENANT_LOGO_VARIABLE = "{{tenant.logo_url}}";

export const insertLogoHeader =
  (logoUrl: string | null) =>
  ({ editor, range }: CommandProps) =>
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .insertContent({
        type: EMAIL_TEMPLATE_NODE_TYPES.IMAGE,
        attrs: {
          uuid: uuid(),
          src: logoUrl ?? TENANT_LOGO_VARIABLE,
          alignment: "center",
        },
      })
      .run();

const walk = (
  node: EmailTemplateNode,
  transform: (n: EmailTemplateNode) => EmailTemplateNode,
): EmailTemplateNode => {
  const next = transform(node);
  if (!next.content) return next;
  return { ...next, content: next.content.map((child) => walk(child, transform)) };
};

const hasImageWithSrc = (node: EmailTemplateNode, src: string): boolean => {
  if (node.type === EMAIL_TEMPLATE_NODE_TYPES.IMAGE && node.attrs?.src === src) return true;
  return node.content?.some((child) => hasImageWithSrc(child, src)) ?? false;
};

const remapImageSrc = (doc: EmailTemplateBlocks, from: string, to: string): EmailTemplateBlocks => {
  if (!hasImageWithSrc(doc, from)) return doc;
  return walk(doc, (node) => {
    if (node.type !== EMAIL_TEMPLATE_NODE_TYPES.IMAGE) return node;
    if (node.attrs?.src !== from) return node;
    return { ...node, attrs: { ...node.attrs, src: to } };
  });
};

export const resolveTenantLogoInDoc = (
  doc: EmailTemplateBlocks,
  logoUrl: string | null,
): EmailTemplateBlocks => {
  if (!logoUrl) return doc;
  return remapImageSrc(doc, TENANT_LOGO_VARIABLE, logoUrl);
};

export const packTenantLogoInDoc = (
  doc: EmailTemplateBlocks,
  logoUrl: string | null,
): EmailTemplateBlocks => {
  if (!logoUrl) return doc;
  return remapImageSrc(doc, logoUrl, TENANT_LOGO_VARIABLE);
};
