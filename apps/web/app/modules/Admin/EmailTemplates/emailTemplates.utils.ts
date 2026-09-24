import { match } from "ts-pattern";

import { EMAIL_TEMPLATE_BLOCK_TYPES } from "./emailTemplates.constants";

import type {
  EmailTemplateBlockMoveDirection,
  EmailTemplate,
  EmailTemplateBlock,
  EmailTemplateDocument,
  EmailTemplateFormValues,
  EmailTemplateParagraph,
} from "./emailTemplates.types";
import type { SupportedLanguages } from "@repo/shared";
import type { JSONContent } from "@tiptap/core";

const getChangedTranslations = <T>(
  previous: Partial<Record<SupportedLanguages, T>>,
  next: Partial<Record<SupportedLanguages, T>>,
): Partial<Record<SupportedLanguages, T>> =>
  Object.fromEntries(
    Object.entries(next).filter(
      ([language, value]) =>
        JSON.stringify(value) !== JSON.stringify(previous[language as SupportedLanguages]),
    ),
  );

export const getEmailTemplateTranslationChanges = (
  saved: EmailTemplateFormValues,
  values: EmailTemplateFormValues,
): EmailTemplateFormValues => ({
  name: getChangedTranslations(saved.name, values.name),
  subject: getChangedTranslations(saved.subject, values.subject),
  content: getChangedTranslations(saved.content, values.content),
});

export const getLocalizedTemplateName = (template: EmailTemplate, language: SupportedLanguages) =>
  template.name[language]?.trim() || template.name[template.baseLanguage] || template.event;

export const createEmailTemplateBlock = (type: EmailTemplateBlock["type"]): EmailTemplateBlock =>
  match(type)
    .with(EMAIL_TEMPLATE_BLOCK_TYPES.HEADER, () => ({
      type: EMAIL_TEMPLATE_BLOCK_TYPES.HEADER,
      attrs: { source: "tenant_branding" as const },
    }))
    .with(EMAIL_TEMPLATE_BLOCK_TYPES.HEADING, () => ({
      type: EMAIL_TEMPLATE_BLOCK_TYPES.HEADING,
      content: [{ type: "paragraph" as const }],
    }))
    .with(EMAIL_TEMPLATE_BLOCK_TYPES.TEXT, () => ({
      type: EMAIL_TEMPLATE_BLOCK_TYPES.TEXT,
      content: [{ type: "paragraph" as const }],
    }))
    .with(EMAIL_TEMPLATE_BLOCK_TYPES.BUTTON, () => ({
      type: EMAIL_TEMPLATE_BLOCK_TYPES.BUTTON,
      attrs: { label: "", url: "" },
    }))
    .with(EMAIL_TEMPLATE_BLOCK_TYPES.IMAGE, () => ({
      type: EMAIL_TEMPLATE_BLOCK_TYPES.IMAGE,
      attrs: { src: "", alt: "" },
    }))
    .with(EMAIL_TEMPLATE_BLOCK_TYPES.DIVIDER, () => ({ type: EMAIL_TEMPLATE_BLOCK_TYPES.DIVIDER }))
    .with(EMAIL_TEMPLATE_BLOCK_TYPES.SPACER, () => ({
      type: EMAIL_TEMPLATE_BLOCK_TYPES.SPACER,
      attrs: { height: 24 },
    }))
    .with(EMAIL_TEMPLATE_BLOCK_TYPES.FOOTER, () => ({
      type: EMAIL_TEMPLATE_BLOCK_TYPES.FOOTER,
      attrs: { text: "" },
      content: [{ type: "paragraph" as const }],
    }))
    .exhaustive();

export const createEmptyEmailTemplateDocument = (): EmailTemplateDocument => ({
  type: "doc",
  version: 1,
  content: [],
});

export const isEmailTemplateBlockEmpty = (block: EmailTemplateBlock): boolean => {
  if (
    block.type === EMAIL_TEMPLATE_BLOCK_TYPES.TEXT ||
    block.type === EMAIL_TEMPLATE_BLOCK_TYPES.HEADING
  )
    return !block.content.some((paragraph) => paragraph.content?.some((node) => node.text.trim()));
  if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.FOOTER)
    return block.content
      ? !block.content.some((paragraph) => paragraph.content?.some((node) => node.text.trim()))
      : !block.attrs.text.trim();
  if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.BUTTON) return !block.attrs.label.trim();
  if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.IMAGE) return !block.attrs.src.trim();
  return false;
};

export const isEmailTemplateTranslationComplete = (
  values: EmailTemplateFormValues,
  language: SupportedLanguages,
) => {
  if (!values.name[language]?.trim() || !values.subject[language]?.trim()) return false;
  return (
    values.content[language]?.content.some((block) => {
      if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.IMAGE) return Boolean(block.attrs.src.trim());
      if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.BUTTON)
        return Boolean(block.attrs.label.trim());
      if (
        block.type === EMAIL_TEMPLATE_BLOCK_TYPES.TEXT ||
        block.type === EMAIL_TEMPLATE_BLOCK_TYPES.HEADING
      )
        return block.content.some((paragraph) =>
          paragraph.content?.some((node) => node.text.trim()),
        );
      return false;
    }) ?? false
  );
};

export const serializeEmailTemplateParagraphs = (document: JSONContent): EmailTemplateParagraph[] =>
  (document.content ?? [])
    .filter((paragraph) => paragraph.type === "paragraph")
    .map((paragraph) => ({
      type: "paragraph",
      content: (paragraph.content ?? [])
        .filter((node) => node.type === "text")
        .map((node) => ({
          type: "text",
          text: node.text ?? "",
          marks: (node.marks ?? []).flatMap(
            (
              mark,
            ): NonNullable<NonNullable<EmailTemplateParagraph["content"]>[number]["marks"]> => {
              if (mark.type === "bold" || mark.type === "italic") return [{ type: mark.type }];
              if (mark.type === "link")
                return [{ type: "link", attrs: { href: String(mark.attrs?.href ?? "") } }];
              return [];
            },
          ),
        })),
    }));

export const moveEmailTemplateBlock = (
  blocks: EmailTemplateBlock[],
  index: number,
  direction: EmailTemplateBlockMoveDirection,
) => {
  const target = index + direction;
  if (target < 0 || target >= blocks.length) return blocks;
  const reordered = [...blocks];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  return reordered;
};

export const moveEmailTemplateBlockToInsertion = (
  blocks: EmailTemplateBlock[],
  source: number,
  insertion: number,
) => {
  if (source < 0 || source >= blocks.length || insertion < 0 || insertion > blocks.length)
    return blocks;
  const target = insertion > source ? insertion - 1 : insertion;
  if (target === source) return blocks;
  const updated = [...blocks];
  const [block] = updated.splice(source, 1);
  updated.splice(target, 0, block);
  return updated;
};

export const getEmailTemplateBlockValidationError = (block: EmailTemplateBlock) => {
  if (
    block.type === EMAIL_TEMPLATE_BLOCK_TYPES.BUTTON &&
    (!block.attrs.label.trim() || !block.attrs.url.trim())
  )
    return "emailTemplates.errors.incompleteButton";
  if (isEmailTemplateBlockEmpty(block)) return "emailTemplates.errors.emptyBlock";
  return undefined;
};

export const getEmailTemplateInvalidContentLanguage = (
  content: EmailTemplateFormValues["content"],
) =>
  Object.entries(content).find(([, document]) =>
    document?.content.some(
      (block) =>
        (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.BUTTON &&
          (!block.attrs.label.trim() || !block.attrs.url.trim())) ||
        (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.IMAGE && !block.attrs.src.trim()),
    ),
  )?.[0] as SupportedLanguages | undefined;
