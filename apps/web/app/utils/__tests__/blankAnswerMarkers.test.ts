import { describe, expect, it } from "vitest";

import { normalizeBlankAnswerLineBreaks, splitByBlankAnswerMarkers } from "../blankAnswerMarkers";

describe("splitByBlankAnswerMarkers", () => {
  it("keeps rich text around blank markers intact", () => {
    expect(
      splitByBlankAnswerMarkers(
        "<p>First <blank-answer-answer-1><br />Second <blank-answer-answer-2></p>",
      ),
    ).toEqual([
      { text: "<p>First ", answerId: "answer-1" },
      { text: "<br />Second ", answerId: "answer-2" },
      { text: "</p>" },
    ]);
  });

  it("normalizes TipTap paragraph wrappers to hard breaks for storage", () => {
    expect(
      normalizeBlankAnswerLineBreaks(
        "<p>Test <blank-answer-answer-1></p><p>Test <blank-answer-answer-2></p>",
      ),
    ).toBe("Test <blank-answer-answer-1><br />Test <blank-answer-answer-2>");
  });
});
