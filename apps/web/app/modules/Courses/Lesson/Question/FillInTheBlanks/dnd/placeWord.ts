import type { DndWord } from "./types";

export const WORD_BANK_BLANK_ID = "blank_preset";

/**
 * Moves a word to a blank, or back to the bank. A word already in the target blank is swapped
 * into the moved word's old blank; a word displaced from the bank goes back to the bank. Mirrors
 * the drag behaviour so click and keyboard selection resolve the same way.
 */
export const moveWordToBlank = (
  words: DndWord[],
  wordId: string,
  targetBlankId: string,
): DndWord[] => {
  const activeWord = words.find(({ id }) => id === wordId);

  if (!activeWord || activeWord.blankId === targetBlankId) return words;

  const sourceBlankId = activeWord.blankId;

  return words.map((word) => {
    if (word.id === wordId) return { ...word, blankId: targetBlankId };

    if (
      targetBlankId !== WORD_BANK_BLANK_ID &&
      word.blankId === targetBlankId &&
      word.id !== wordId
    ) {
      return { ...word, blankId: sourceBlankId };
    }

    return word;
  });
};
