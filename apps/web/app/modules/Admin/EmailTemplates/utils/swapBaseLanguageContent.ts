import {
  EMAIL_TEMPLATE_NODE_TYPES,
  EMAIL_TEMPLATE_NODE_UUID_ATTR,
  TRANSLATABLE_EMAIL_TEMPLATE_NODE_TYPES,
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

const extractFragmentFromNode = (node: EmailTemplateNode): TranslationFragment => {
  if (node.type === EMAIL_TEMPLATE_NODE_TYPES.BUTTON) {
    const raw = node.attrs?.text;
    const text = typeof raw === "string" ? raw : "";
    return text.length > 0 ? [{ type: EMAIL_TEMPLATE_NODE_TYPES.TEXT, text }] : [];
  }
  return (node.content ?? []).map(cloneEmailTemplateNode) as TranslationFragment;
};

const applyFragmentToNode = (node: EmailTemplateNode, fragment: TranslationFragment): void => {
  if (node.type === EMAIL_TEMPLATE_NODE_TYPES.BUTTON) {
    if (!node.attrs) node.attrs = {};
    node.attrs.text = fragmentToPlainString(fragment);
  } else {
    node.content = fragment.map(cloneEmailTemplateNode);
  }
};

export const swapBaseLanguageContent = (params: {
  blocks: EmailTemplateBlocks;
  strings: EmailTemplateStrings;
  oldBase: SupportedLanguages;
  newBase: SupportedLanguages;
}): { blocks: EmailTemplateBlocks; strings: EmailTemplateStrings } => {
  const { oldBase, newBase } = params;
  const blocks = cloneEmailTemplateNode(params.blocks);
  const nextStrings: EmailTemplateStrings = { ...params.strings };
  const newBaseFragments = nextStrings[newBase] ?? {};
  const oldBaseFragments: Record<string, TranslationFragment> = {};

  const walk = (node: EmailTemplateNode): void => {
    if (node.type && TRANSLATABLE_EMAIL_TEMPLATE_NODE_TYPES.has(node.type)) {
      const uuid = readNodeUuid(node);
      if (uuid) {
        oldBaseFragments[uuid] = extractFragmentFromNode(node);
        const promoted = newBaseFragments[uuid];
        if (promoted) applyFragmentToNode(node, promoted);
      }
    }
    if (node.content) for (const child of node.content) walk(child);
  };

  walk(blocks);

  nextStrings[oldBase] = oldBaseFragments;
  delete nextStrings[newBase];

  return { blocks, strings: nextStrings };
};
