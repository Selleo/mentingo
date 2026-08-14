const TRANSLATION_ITEM_SEPARATOR = "\n";
const HTML_TAG_PATTERN = /<[^>]+>/g;

export class TranslationStructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranslationStructureError";
  }
}

export const getTranslationContext = (
  metadata: string,
  sourceText: string,
  context: Record<string, string | undefined>,
) => {
  const isTitle = metadata.toLowerCase().includes("title");

  return Object.fromEntries(
    Object.entries(context).filter(([key, value]) => {
      if (!value || value === sourceText) return false;
      if (isTitle && key.toLowerCase().includes("description")) return false;
      return true;
    }),
  );
};

export const validateTranslationStructure = (sourceText: string, translatedText: string) => {
  const sourceTags = sourceText.match(HTML_TAG_PATTERN) ?? [];
  const translatedTags = translatedText.match(HTML_TAG_PATTERN) ?? [];

  if (!sourceTags.length && translatedTags.length) {
    throw new TranslationStructureError("Plain-text translation unexpectedly contains HTML");
  }

  if (sourceTags.length && JSON.stringify(sourceTags) !== JSON.stringify(translatedTags)) {
    throw new TranslationStructureError("Translation did not preserve the source HTML structure");
  }
};

export const formatTranslationItem = (itemId: string, translation: string) =>
  `${itemId}${TRANSLATION_ITEM_SEPARATOR}${translation}`;

export const alignTranslationItems = (
  translations: string[],
  expectedItemIds: string[],
): string[] => {
  const expectedItemIdSet = new Set(expectedItemIds);
  const translationsByItemId = new Map<string, string>();

  for (const translation of translations) {
    const separatorIndex = translation.indexOf(TRANSLATION_ITEM_SEPARATOR);

    if (separatorIndex === -1) throw new Error("Translation output is missing its item ID");

    const itemId = translation.slice(0, separatorIndex);
    const translatedText = translation.slice(separatorIndex + TRANSLATION_ITEM_SEPARATOR.length);

    if (!expectedItemIdSet.has(itemId)) {
      throw new Error(`Translation output contains an unknown item ID: ${itemId}`);
    }

    if (translationsByItemId.has(itemId)) {
      throw new Error(`Translation output contains a duplicate item ID: ${itemId}`);
    }

    translationsByItemId.set(itemId, translatedText);
  }

  if (translationsByItemId.size !== expectedItemIds.length) {
    throw new Error(
      `Translation output item count mismatch: expected ${expectedItemIds.length}, received ${translationsByItemId.size}`,
    );
  }

  return expectedItemIds.map((itemId) => {
    const translation = translationsByItemId.get(itemId);

    if (translation === undefined) {
      throw new Error(`Translation output is missing item ID: ${itemId}`);
    }

    return translation;
  });
};
