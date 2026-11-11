import { ASSESSMENT_GRADING_MODES, SUPPORTED_LANGUAGES } from "@repo/shared";

import { QUESTION_TYPE } from "src/questions/schema/question.types";

import { mapLegacyQuizAuthoringInput } from "./legacy-to-quiz-authoring.mapper";

import type { AdminQuestionBody } from "src/lesson/lesson.schema";

const gradingModeOf = (question: Omit<AdminQuestionBody, "title">) =>
  mapLegacyQuizAuthoringInput({
    language: SUPPORTED_LANGUAGES.EN,
    questions: [{ title: "Question", ...question }],
  }).questions?.[0]?.gradingMode;

describe("mapLegacyQuizAuthoringInput grading mode", () => {
  it.each([QUESTION_TYPE.BRIEF_RESPONSE, QUESTION_TYPE.DETAILED_RESPONSE])(
    "keeps %s answers counted as correct unless review is required",
    (type) => {
      expect(gradingModeOf({ type })).toBe(ASSESSMENT_GRADING_MODES.PARTICIPATION);
      expect(gradingModeOf({ type, requiresReview: false })).toBe(
        ASSESSMENT_GRADING_MODES.PARTICIPATION,
      );
      expect(gradingModeOf({ type, requiresReview: true })).toBe(ASSESSMENT_GRADING_MODES.MANUAL);
    },
  );

  it("grades closed questions automatically even when review is requested", () => {
    expect(gradingModeOf({ type: QUESTION_TYPE.SINGLE_CHOICE, requiresReview: true })).toBe(
      ASSESSMENT_GRADING_MODES.AUTOMATIC,
    );
  });
});
