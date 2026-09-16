import { EMAIL_TEMPLATE_BLOCK_TYPES, type EmailTemplateDocument } from "../template-registry.types";

export function resolveLegacyEmailTemplateContent(
  document: EmailTemplateDocument,
  replacements: ReadonlyMap<string, string>,
): EmailTemplateDocument {
  if (!replacements.size) return document;

  const resolved = structuredClone(document);
  const replace = (text: string) => replacements.get(text) ?? text;

  for (const block of resolved.content) {
    switch (block.type) {
      case EMAIL_TEMPLATE_BLOCK_TYPES.BUTTON:
        block.attrs.label = replace(block.attrs.label);
        break;
      case EMAIL_TEMPLATE_BLOCK_TYPES.TEXT:
      case EMAIL_TEMPLATE_BLOCK_TYPES.HEADING:
        for (const paragraph of block.content) {
          for (const node of paragraph.content ?? []) {
            node.text = replace(node.text);
          }
        }
        break;
    }
  }

  return resolved;
}
