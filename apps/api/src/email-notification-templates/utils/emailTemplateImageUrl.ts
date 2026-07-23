import { EMAIL_TEMPLATE_NODE_TYPES } from "@repo/shared";

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
  return idx === -1
    ? null
    : decodeURIComponent(url.slice(idx + EMAIL_TEMPLATE_IMAGE_PUBLIC_PATH.length));
};
