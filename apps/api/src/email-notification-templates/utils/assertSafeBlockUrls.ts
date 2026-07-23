import { BadRequestException } from "@nestjs/common";
import { EMAIL_TEMPLATE_NODE_TYPES } from "@repo/shared";

import type { EmailTemplateBlocks } from "@repo/shared";

const SCHEME_REGEX = /^[a-z][a-z0-9+.-]*:/i;
const ALLOWED_SCHEMES = new Set(["http:", "https:", "mailto:"]);

function isSafeUrl(value: string): boolean {
  const match = SCHEME_REGEX.exec(value);
  if (match) {
    return ALLOWED_SCHEMES.has(match[0].toLowerCase());
  }
  return value.startsWith("/");
}

function walkNode(node: EmailTemplateBlocks): void {
  if (node.type === EMAIL_TEMPLATE_NODE_TYPES.IMAGE && typeof node.attrs?.src === "string") {
    if (!isSafeUrl(node.attrs.src)) {
      throw new BadRequestException("emailTemplates.toast.invalidUrl");
    }
  }

  if (node.type === EMAIL_TEMPLATE_NODE_TYPES.BUTTON && typeof node.attrs?.url === "string") {
    if (!isSafeUrl(node.attrs.url)) {
      throw new BadRequestException("emailTemplates.toast.invalidUrl");
    }
  }

  if (Array.isArray(node.marks)) {
    for (const mark of node.marks) {
      if (mark.type === "link" && typeof mark.attrs?.href === "string") {
        if (!isSafeUrl(mark.attrs.href)) {
          throw new BadRequestException("emailTemplates.toast.invalidUrl");
        }
      }
    }
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      walkNode(child);
    }
  }
}

export function assertSafeBlockUrls(node: EmailTemplateBlocks): void {
  walkNode(node);
}
