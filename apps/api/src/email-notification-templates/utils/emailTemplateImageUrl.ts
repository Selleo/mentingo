import { EMAIL_TEMPLATE_NODE_TYPES } from "@repo/shared";

import { RESOURCE_CATEGORIES } from "src/file/file.constants";

import { EMAIL_TEMPLATE_IMAGE_PUBLIC_PATH } from "../email-template-image.constants";

import type { EmailTemplateNode } from "@repo/shared";

export function* collectImageSrcs(node: EmailTemplateNode): Generator<string> {
  if (node.type === EMAIL_TEMPLATE_NODE_TYPES.IMAGE && typeof node.attrs?.src === "string") {
    yield node.attrs.src;
  }
  for (const child of node.content ?? []) {
    yield* collectImageSrcs(child);
  }
}

export const extractFileKeyFromImageUrl = (url: string): string | null => {
  const idx = url.indexOf(EMAIL_TEMPLATE_IMAGE_PUBLIC_PATH);
  if (idx === -1) return null;

  try {
    return decodeURIComponent(url.slice(idx + EMAIL_TEMPLATE_IMAGE_PUBLIC_PATH.length));
  } catch {
    return null;
  }
};

export const isEmailTemplateImageFileKeyForTenant = (key: string, tenantId: string): boolean => {
  const expectedPrefix = `${tenantId}/${RESOURCE_CATEGORIES.EMAIL_TEMPLATE_IMAGE}/`;
  return key.startsWith(expectedPrefix);
};

export const extractTenantEmailTemplateImageFileKeyFromUrl = (
  url: string,
  tenantId: string,
): string | null => {
  const key = extractFileKeyFromImageUrl(url);
  if (!key || !isEmailTemplateImageFileKeyForTenant(key, tenantId)) return null;
  return key;
};
