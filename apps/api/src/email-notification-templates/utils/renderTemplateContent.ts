import { Maily } from "@maily-to/render";

import { flattenTranslationsForRender } from "./flattenTranslationsForRender";

import type {
  EmailTemplateBlocks,
  EmailTemplateStrings,
  LocalizedText,
  SupportedLanguages,
} from "@repo/shared";

export type RenderTemplateOutput = {
  language: SupportedLanguages;
  subject: string;
  html: string;
};

export const renderTemplateContent = async (params: {
  blocks: EmailTemplateBlocks;
  strings: EmailTemplateStrings;
  subject: LocalizedText;
  language: SupportedLanguages;
  baseLanguage: SupportedLanguages;
  previewText?: string;
}): Promise<RenderTemplateOutput> => {
  const monolingualBlocks = flattenTranslationsForRender({
    blocks: params.blocks,
    strings: params.strings,
    language: params.language,
    baseLanguage: params.baseLanguage,
  });

  const maily = new Maily(monolingualBlocks as never);
  if (params.previewText) maily.setPreviewText(params.previewText);
  const html = await maily.render();

  const localizedSubject = params.subject[params.language];
  const baseSubject = params.subject[params.baseLanguage];
  const subject =
    localizedSubject && localizedSubject.trim().length > 0 ? localizedSubject : (baseSubject ?? "");

  return {
    language: params.language,
    subject,
    html,
  };
};
