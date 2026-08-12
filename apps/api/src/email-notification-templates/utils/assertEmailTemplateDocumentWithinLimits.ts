import { BadRequestException } from "@nestjs/common";

import type { EmailTemplateBlocks, EmailTemplateNode, EmailTemplateStrings } from "@repo/shared";

export const EMAIL_TEMPLATE_DOCUMENT_LIMITS = {
  maxDepth: 20,
  maxNodes: 500,
  maxTextLength: 20_000,
  maxSerializedBytes: 512 * 1024,
} as const;

const invalidDocument = (): BadRequestException =>
  new BadRequestException("emailTemplates.toast.invalidContent");

const assertNode = (
  value: unknown,
  depth: number,
  state: { nodes: number },
): asserts value is EmailTemplateNode => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalidDocument();
  if (depth > EMAIL_TEMPLATE_DOCUMENT_LIMITS.maxDepth) throw invalidDocument();

  state.nodes += 1;
  if (state.nodes > EMAIL_TEMPLATE_DOCUMENT_LIMITS.maxNodes) throw invalidDocument();

  const node = value as EmailTemplateNode;
  if (
    typeof node.text === "string" &&
    node.text.length > EMAIL_TEMPLATE_DOCUMENT_LIMITS.maxTextLength
  ) {
    throw invalidDocument();
  }

  if (node.content !== undefined) {
    if (!Array.isArray(node.content)) throw invalidDocument();
    for (const child of node.content) assertNode(child, depth + 1, state);
  }
};

export const assertEmailTemplateDocumentWithinLimits = (params: {
  blocks: EmailTemplateBlocks;
  strings: EmailTemplateStrings;
}): void => {
  const serialized = JSON.stringify(params);
  if (
    !serialized ||
    Buffer.byteLength(serialized, "utf8") > EMAIL_TEMPLATE_DOCUMENT_LIMITS.maxSerializedBytes
  ) {
    throw invalidDocument();
  }

  const state = { nodes: 0 };
  assertNode(params.blocks, 0, state);

  for (const translations of Object.values(params.strings)) {
    if (!translations) continue;
    for (const fragment of Object.values(translations)) {
      if (!Array.isArray(fragment)) throw invalidDocument();
      for (const node of fragment) assertNode(node, 0, state);
    }
  }
};
