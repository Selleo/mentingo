import { describe, expect, it } from "vitest";

import { moveWordToBlank, WORD_BANK_BLANK_ID } from "./placeWord";

import type { DndWord } from "./types";

const word = (id: string, blankId: string): DndWord => ({
  id,
  index: null,
  value: id,
  blankId,
});

const blankIds = (words: DndWord[]) =>
  Object.fromEntries(words.map(({ id, blankId }) => [id, blankId]));

describe("moveWordToBlank", () => {
  it("moves a word from the bank into an empty blank", () => {
    const words = [word("alpha", WORD_BANK_BLANK_ID), word("beta", WORD_BANK_BLANK_ID)];

    expect(blankIds(moveWordToBlank(words, "alpha", "blank:1"))).toEqual({
      alpha: "blank:1",
      beta: WORD_BANK_BLANK_ID,
    });
  });

  it("swaps when the target blank already holds a word", () => {
    const words = [word("alpha", "blank:1"), word("beta", "blank:2")];

    expect(blankIds(moveWordToBlank(words, "alpha", "blank:2"))).toEqual({
      alpha: "blank:2",
      beta: "blank:1",
    });
  });

  it("sends the occupant back to the bank when the moved word came from the bank", () => {
    const words = [word("alpha", WORD_BANK_BLANK_ID), word("beta", "blank:1")];

    expect(blankIds(moveWordToBlank(words, "alpha", "blank:1"))).toEqual({
      alpha: "blank:1",
      beta: WORD_BANK_BLANK_ID,
    });
  });

  it("returns a placed word to the bank without disturbing other blanks", () => {
    const words = [word("alpha", "blank:1"), word("beta", "blank:2")];

    expect(blankIds(moveWordToBlank(words, "alpha", WORD_BANK_BLANK_ID))).toEqual({
      alpha: WORD_BANK_BLANK_ID,
      beta: "blank:2",
    });
  });

  it("is a no-op when the word is already in the target blank", () => {
    const words = [word("alpha", "blank:1")];
    const result = moveWordToBlank(words, "alpha", "blank:1");

    expect(result).toBe(words);
  });
});
