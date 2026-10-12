import { describe, expect, it } from "vitest";

import { CANONICAL_QUESTION_TYPES, createCanonicalQuestion } from "./ProposalLessonEditors";

describe("canonical proposal quiz question defaults", () => {
  it("creates every supported question family without legacy substitutions", () => {
    const questions = CANONICAL_QUESTION_TYPES.map((type, index) =>
      createCanonicalQuestion(type, index),
    );

    expect(questions.map((question) => question.questionType)).toEqual([
      "single_choice",
      "multiple_choice",
      "true_or_false",
      "photo_question_single_choice",
      "photo_question_multiple_choice",
      "fill_in_the_blanks_text",
      "fill_in_the_blanks_dnd",
      "brief_response",
      "detailed_response",
      "scale_1_5",
    ]);
    expect(questions[5].blanks).toHaveLength(1);
    expect(questions[6].dragAndDropOptions[0]?.targetBlankId).toBe(questions[6].blanks[0]?.id);
    expect(questions[7].openTextSettings).not.toBeNull();
    expect(questions[9].scaleOptions).toHaveLength(5);
    expect(questions[3].photoS3Key).toBeNull();
  });
});
