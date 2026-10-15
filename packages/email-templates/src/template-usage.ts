import type { AutomationPlaceholderDefinition, LocalizedText } from "@repo/shared";
import {
  EMAIL_TEMPLATE_BLOCK_TYPES,
  EMAIL_TEMPLATE_INLINE_MARK_TYPES,
  type EmailTemplateDocument,
  type LocalizedEmailTemplateContent,
} from "./template-registry.types";
import type { PublishedEmailTemplate } from "./publication.types";

/** Read rendered text and destinations, including tokens split across inline text nodes. */
export function getUsedEmailTemplateVariables(
  subject: LocalizedText,
  content: LocalizedEmailTemplateContent,
): string[] {
  const texts = Object.values(subject).filter((value): value is string => value !== undefined);
  for (const document of Object.values(content)) {
    texts.push(...getEmailTemplateDocumentTexts(document));
  }
  return [
    ...new Set(
      texts.flatMap((text) =>
        [...text.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)].map((match) => match[1]!),
      ),
    ),
  ];
}

function getEmailTemplateDocumentTexts(document: EmailTemplateDocument): string[] {
  const texts: string[] = [];
  for (const block of document.content) {
    if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.BUTTON) {
      texts.push(block.attrs.label, block.attrs.url);
    }
    if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.IMAGE) {
      texts.push(block.attrs.src, block.attrs.alt);
    }
    if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.FOOTER && !block.content) {
      texts.push(block.attrs.text);
    }
    if ("content" in block && block.content) {
      for (const paragraph of block.content) {
        texts.push((paragraph.content ?? []).map((node) => node.text).join(""));
        for (const node of paragraph.content ?? []) {
          for (const mark of node.marks ?? []) {
            if (mark.type === EMAIL_TEMPLATE_INLINE_MARK_TYPES.LINK) {
              texts.push(mark.attrs.href);
            }
          }
        }
      }
    }
  }
  return texts;
}

/** The retained compatibility flag is derived from usage, never authored. */
export function deriveEmailTemplatePlaceholders(
  placeholders: AutomationPlaceholderDefinition[],
  subject: LocalizedText,
  content: LocalizedEmailTemplateContent,
): AutomationPlaceholderDefinition[] {
  const used = new Set(getUsedEmailTemplateVariables(subject, content));
  return placeholders.map((placeholder) => ({
    ...placeholder,
    required: used.has(placeholder.name),
  }));
}

export function deriveEmailTemplatePublicationUsage(
  publication: PublishedEmailTemplate,
): PublishedEmailTemplate {
  return {
    ...publication,
    placeholders: deriveEmailTemplatePlaceholders(
      publication.placeholders,
      publication.subject,
      publication.content,
    ),
  };
}
