import { EMAIL_TEMPLATE_NODE_TYPES, TENANT_LOGO_VARIABLE } from "@repo/shared";
import { v4 as uuid } from "uuid";

import mentingoLogoUrl from "~/assets/svgs/app-logo.svg?url";

import type { CommandProps } from "@maily-to/core/blocks";
import type { EmailTemplateBlocks, EmailTemplateNode } from "@repo/shared";

export { TENANT_LOGO_VARIABLE } from "@repo/shared";
export const TENANT_LOGO_HEIGHT = "32";
export const TENANT_LOGO_PLACEHOLDER_SRC = mentingoLogoUrl;

export const resolveEffectiveLogoUrl = (tenantLogoUrl: string | null): string =>
  tenantLogoUrl && tenantLogoUrl.length > 0 ? tenantLogoUrl : TENANT_LOGO_PLACEHOLDER_SRC;

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
          width: null,
          height: TENANT_LOGO_HEIGHT,
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

export const resolveTenantLogoInDoc = (
  doc: EmailTemplateBlocks,
  logoUrl: string | null,
): EmailTemplateBlocks => {
  if (!logoUrl) return doc;
  if (!hasImageWithSrc(doc, TENANT_LOGO_VARIABLE)) return doc;
  return walk(doc, (node) => {
    if (node.type !== EMAIL_TEMPLATE_NODE_TYPES.IMAGE) return node;
    if (node.attrs?.src !== TENANT_LOGO_VARIABLE) return node;
    return {
      ...node,
      attrs: {
        ...node.attrs,
        src: logoUrl,
        width: null,
        height: TENANT_LOGO_HEIGHT,
      },
    };
  });
};

export const packTenantLogoInDoc = (
  doc: EmailTemplateBlocks,
  logoUrl: string | null,
): EmailTemplateBlocks => {
  const targets = new Set<string>([TENANT_LOGO_PLACEHOLDER_SRC]);
  if (logoUrl) targets.add(logoUrl);
  if (![...targets].some((t) => hasImageWithSrc(doc, t))) return doc;
  return walk(doc, (node) => {
    if (node.type !== EMAIL_TEMPLATE_NODE_TYPES.IMAGE) return node;
    const src = node.attrs?.src;
    if (typeof src !== "string" || !targets.has(src)) return node;
    return {
      ...node,
      attrs: {
        ...node.attrs,
        src: TENANT_LOGO_VARIABLE,
        width: "auto",
        height: TENANT_LOGO_HEIGHT,
      },
    };
  });
};
