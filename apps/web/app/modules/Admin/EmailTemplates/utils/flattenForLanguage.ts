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

export const BUTTON_FALLBACK_ATTR = "fallbackText";

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

export const flattenForLanguage = (params: {
  blocks: EmailTemplateBlocks;
  strings: EmailTemplateStrings;
  language: SupportedLanguages;
  baseLanguage: SupportedLanguages;
}): EmailTemplateBlocks => {
  const { strings, language, baseLanguage } = params;
  const isBase = language === baseLanguage;
  const blocks = cloneEmailTemplateNode(params.blocks);

  const walk = (node: EmailTemplateNode): void => {
    if (node.type && TRANSLATABLE_EMAIL_TEMPLATE_NODE_TYPES.has(node.type) && !isBase) {
      const uuid = readNodeUuid(node);
      if (uuid) {
        const localeOverride = strings[language]?.[uuid];
        if (localeOverride && !isFragmentEmpty(localeOverride)) {
          applyOverride(node, localeOverride);
        } else if (node.type === EMAIL_TEMPLATE_NODE_TYPES.BUTTON) {
          const baseButtonText = typeof node.attrs?.text === "string" ? node.attrs.text : "";
          if (!node.attrs) node.attrs = {};
          if (baseButtonText) node.attrs[BUTTON_FALLBACK_ATTR] = "true";
        } else {
          node.content = [];
        }
      }
    }
    if (node.content) for (const child of node.content) walk(child);
  };

  walk(blocks);
  return blocks;
};

const applyOverride = (node: EmailTemplateNode, override: TranslationFragment): void => {
  if (node.type === EMAIL_TEMPLATE_NODE_TYPES.BUTTON) {
    if (!node.attrs) node.attrs = {};
    node.attrs.text = fragmentToPlainString(override);
  } else {
    node.content = override.map(cloneEmailTemplateNode);
  }
};
