import { AUTOMATION_RESERVED_BRANDING_PLACEHOLDER } from "@repo/shared";

import { EMAIL_TEMPLATE_BLOCK_TYPES } from "../emailTemplates.constants";

import type { EmailTemplateBlock, EmailTemplateParagraph } from "../emailTemplates.types";

function getTagRanges(value: string) {
  return [...value.matchAll(/{{\s*([^{}]+?)\s*}}/g)]
    .filter((match) => match[1].trim() !== AUTOMATION_RESERVED_BRANDING_PLACEHOLDER)
    .map((match) => ({ start: match.index, end: match.index + match[0].length }));
}

export function removeEmailTemplateTags(value: string): string {
  const ranges = getTagRanges(value);

  return ranges.reduceRight(
    (text, range) => text.slice(0, range.start) + text.slice(range.end),
    value,
  );
}

function removeTagsFromDestination(value: string): string {
  // A partially stripped URL could lead somewhere unintended. Let the author choose a new destination.
  return getTagRanges(value).length ? "" : value;
}

function removeTagsFromParagraphs(paragraphs: EmailTemplateParagraph[]): EmailTemplateParagraph[] {
  return paragraphs.map((paragraph) => {
    const ranges = getTagRanges((paragraph.content ?? []).map((node) => node.text).join(""));
    let offset = 0;

    return {
      ...paragraph,
      content: paragraph.content?.map((node) => {
        const start = offset;
        offset += node.text.length;

        const text = ranges.reduceRight((value, range) => {
          const from = Math.max(0, range.start - start);
          const to = Math.min(node.text.length, range.end - start);

          return from < to ? value.slice(0, from) + value.slice(to) : value;
        }, node.text);

        return {
          ...node,
          text,
          marks: node.marks?.filter(
            (mark) => mark.type !== "link" || !getTagRanges(mark.attrs.href).length,
          ),
        };
      }),
    };
  });
}

export function removeTagsFromEmailBlocks(blocks: EmailTemplateBlock[]): EmailTemplateBlock[] {
  return blocks.map((block) => {
    switch (block.type) {
      case EMAIL_TEMPLATE_BLOCK_TYPES.HEADING:
      case EMAIL_TEMPLATE_BLOCK_TYPES.TEXT:
        return { ...block, content: removeTagsFromParagraphs(block.content) };
      case EMAIL_TEMPLATE_BLOCK_TYPES.FOOTER:
        return {
          ...block,
          attrs: { ...block.attrs, text: removeEmailTemplateTags(block.attrs.text) },
          content: block.content ? removeTagsFromParagraphs(block.content) : block.content,
        };
      case EMAIL_TEMPLATE_BLOCK_TYPES.BUTTON:
        return {
          ...block,
          attrs: {
            ...block.attrs,
            label: removeEmailTemplateTags(block.attrs.label),
            url: removeTagsFromDestination(block.attrs.url),
          },
        };
      case EMAIL_TEMPLATE_BLOCK_TYPES.IMAGE:
        return {
          ...block,
          attrs: {
            ...block.attrs,
            alt: removeEmailTemplateTags(block.attrs.alt),
            src: removeTagsFromDestination(block.attrs.src),
          },
        };
      default:
        return block;
    }
  });
}
