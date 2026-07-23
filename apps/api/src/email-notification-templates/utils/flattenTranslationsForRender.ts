import {
  EMAIL_TEMPLATE_NODE_TYPES,
  TRANSLATABLE_EMAIL_TEMPLATE_NODE_TYPES,
  EMAIL_TEMPLATE_NODE_UUID_ATTR,
  cloneEmailTemplateNode,
} from "@repo/shared";

import type {
  EmailTemplateBlocks,
  EmailTemplateNode,
  EmailTemplateStrings,
  SupportedLanguages,
  TranslationFragment,
} from "@repo/shared";

const readNodeUuid = (node: EmailTemplateNode): string | null => {
  const raw = node.attrs?.[EMAIL_TEMPLATE_NODE_UUID_ATTR];
  return typeof raw === "string" ? raw : null;
};

const fragmentToPlainString = (fragment: TranslationFragment): string => {
  let out = "";
  for (const node of fragment) {
    if (typeof node.text === "string") out += node.text;
    else if (node.content) out += fragmentToPlainString(node.content as TranslationFragment);
  }
  return out;
};

const isFragmentEmpty = (fragment: TranslationFragment | undefined): boolean => {
  if (!fragment || fragment.length === 0) return true;
  return fragmentToPlainString(fragment).trim().length === 0;
};

const pickOverride = (
  strings: EmailTemplateStrings,
  language: SupportedLanguages,
  baseLanguage: SupportedLanguages,
  uuid: string,
): TranslationFragment | undefined => {
  const target = strings[language]?.[uuid];
  if (!isFragmentEmpty(target)) return target;
  const base = strings[baseLanguage]?.[uuid];
  if (!isFragmentEmpty(base)) return base;
  return undefined;
};

export const flattenTranslationsForRender = (params: {
  blocks: EmailTemplateBlocks;
  strings: EmailTemplateStrings;
  language: SupportedLanguages;
  baseLanguage: SupportedLanguages;
}): EmailTemplateBlocks => {
  const { strings, language, baseLanguage } = params;
  const blocks = cloneEmailTemplateNode(params.blocks);

  const walk = (node: EmailTemplateNode): void => {
    if (node.type && TRANSLATABLE_EMAIL_TEMPLATE_NODE_TYPES.has(node.type)) {
      const uuid = readNodeUuid(node);
      if (uuid) {
        const override = pickOverride(strings, language, baseLanguage, uuid);
        if (override) {
          if (node.type === EMAIL_TEMPLATE_NODE_TYPES.BUTTON) {
            if (!node.attrs) node.attrs = {};
            node.attrs.text = fragmentToPlainString(override);
          } else {
            node.content = override.map(cloneEmailTemplateNode);
          }
        }
      }
    }

    if (node.content) {
      for (const child of node.content) walk(child);
    }
  };

  walk(blocks);
  return blocks;
};
