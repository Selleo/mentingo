import {
  ASSESSMENT_GRADING_MODES,
  ASSESSMENT_QUESTION_TYPES,
  ASSESSMENT_TEXT_COMPARISON_MODES,
} from "@repo/shared";

import { preserveExistingQuizAuthoringIds } from "./quiz-authoring-identity.mapper";

import type {
  QuizAuthoringLocalizedQuestion,
  QuizAuthoringQuestion,
} from "../types/quiz-authoring.types";

const createQuestion = (overrides: Partial<QuizAuthoringQuestion> = {}): QuizAuthoringQuestion => ({
  id: "00000000-0000-4000-8000-000000000001",
  questionType: ASSESSMENT_QUESTION_TYPES.SINGLE_CHOICE,
  displayOrder: 1,
  maximumPoints: "1",
  gradingMode: ASSESSMENT_GRADING_MODES.AUTOMATIC,
  prompt: "Question",
  title: "Question",
  description: null,
  photoS3Key: null,
  options: [],
  trueFalseStatements: [],
  scaleOptions: [],
  openTextSettings: null,
  blanks: [],
  dragAndDropOptions: [],
  ...overrides,
});

describe("preserveExistingQuizAuthoringIds", () => {
  it("preserves blank and DnD option IDs when the legacy contract supplies different IDs", () => {
    const firstExistingBlankId = "00000000-0000-4000-8000-000000000010";
    const secondExistingBlankId = "00000000-0000-4000-8000-000000000011";
    const firstIncomingBlankId = "00000000-0000-4000-8000-000000000020";
    const secondIncomingBlankId = "00000000-0000-4000-8000-000000000021";
    const firstExistingOptionId = "00000000-0000-4000-8000-000000000030";
    const secondExistingOptionId = "00000000-0000-4000-8000-000000000031";
    const existingDistractorId = "00000000-0000-4000-8000-000000000032";

    const existingQuestion = createQuestion({
      questionType: ASSESSMENT_QUESTION_TYPES.FILL_IN_THE_BLANKS_DND,
      prompt: `<blank-answer-${firstExistingBlankId}> and <blank-answer-${secondExistingBlankId}>`,
      description: `<blank-answer-${firstExistingBlankId}> and <blank-answer-${secondExistingBlankId}>`,
      blanks: [
        {
          id: firstExistingBlankId,
          textComparisonMode: ASSESSMENT_TEXT_COMPARISON_MODES.EXACT,
          answerSets: [{ preferredAnswer: "first", acceptedAnswers: ["first"] }],
        },
        {
          id: secondExistingBlankId,
          textComparisonMode: ASSESSMENT_TEXT_COMPARISON_MODES.EXACT,
          answerSets: [{ preferredAnswer: "second", acceptedAnswers: ["second"] }],
        },
      ],
      dragAndDropOptions: [
        {
          id: firstExistingOptionId,
          label: "first",
          targetBlankId: firstExistingBlankId,
          displayOrder: 1,
        },
        {
          id: secondExistingOptionId,
          label: "second",
          targetBlankId: secondExistingBlankId,
          displayOrder: 2,
        },
        {
          id: existingDistractorId,
          label: "distractor",
          targetBlankId: null,
          displayOrder: 3,
        },
      ],
    }) as QuizAuthoringLocalizedQuestion;
    const incomingQuestion = createQuestion({
      questionType: ASSESSMENT_QUESTION_TYPES.FILL_IN_THE_BLANKS_DND,
      prompt: `<blank-answer-${firstIncomingBlankId}> and <blank-answer-${secondIncomingBlankId}>`,
      description: `<blank-answer-${firstIncomingBlankId}> and <blank-answer-${secondIncomingBlankId}>`,
      blanks: [
        {
          id: firstIncomingBlankId,
          textComparisonMode: ASSESSMENT_TEXT_COMPARISON_MODES.EXACT,
          answerSets: [{ preferredAnswer: "first", acceptedAnswers: ["first"] }],
        },
        {
          id: secondIncomingBlankId,
          textComparisonMode: ASSESSMENT_TEXT_COMPARISON_MODES.EXACT,
          answerSets: [{ preferredAnswer: "second", acceptedAnswers: ["second"] }],
        },
      ],
      dragAndDropOptions: [
        {
          id: firstIncomingBlankId,
          label: "first",
          targetBlankId: firstIncomingBlankId,
          displayOrder: 1,
        },
        {
          id: secondIncomingBlankId,
          label: "second",
          targetBlankId: secondIncomingBlankId,
          displayOrder: 2,
        },
        {
          id: "00000000-0000-4000-8000-000000000022",
          label: "distractor",
          targetBlankId: null,
          displayOrder: 3,
        },
      ],
    });

    const [result] = preserveExistingQuizAuthoringIds([incomingQuestion], [existingQuestion]);

    expect(result.prompt).toBe(
      `<blank-answer-${firstExistingBlankId}> and <blank-answer-${secondExistingBlankId}>`,
    );
    expect(result.description).toBe(
      `<blank-answer-${firstExistingBlankId}> and <blank-answer-${secondExistingBlankId}>`,
    );
    expect(result.blanks.map(({ id }) => id)).toEqual([
      firstExistingBlankId,
      secondExistingBlankId,
    ]);
    expect(result.dragAndDropOptions).toEqual([
      expect.objectContaining({ id: firstExistingOptionId, targetBlankId: firstExistingBlankId }),
      expect.objectContaining({ id: secondExistingOptionId, targetBlankId: secondExistingBlankId }),
      expect.objectContaining({ id: existingDistractorId, targetBlankId: null }),
    ]);
  });

  it("preserves IDs for choice, true/false, and scale configurations by display order", () => {
    const existingQuestion = createQuestion({
      options: [
        {
          id: "00000000-0000-4000-8000-000000000040",
          displayOrder: 1,
          isCorrect: true,
          label: "Choice",
        },
      ],
      trueFalseStatements: [
        {
          id: "00000000-0000-4000-8000-000000000041",
          displayOrder: 1,
          correctValue: true,
          statement: "Statement",
        },
      ],
      scaleOptions: [
        {
          id: "00000000-0000-4000-8000-000000000042",
          displayOrder: 1,
          scaleValue: 1,
          label: "Scale",
        },
      ],
    }) as QuizAuthoringLocalizedQuestion;
    const incomingQuestion = createQuestion({
      options: [
        {
          id: "00000000-0000-4000-8000-000000000050",
          displayOrder: 1,
          isCorrect: true,
          label: "Updated choice",
        },
      ],
      trueFalseStatements: [
        {
          id: "00000000-0000-4000-8000-000000000051",
          displayOrder: 1,
          correctValue: false,
          statement: "Updated statement",
        },
      ],
      scaleOptions: [
        {
          id: "00000000-0000-4000-8000-000000000052",
          displayOrder: 1,
          scaleValue: 1,
          label: "Updated scale",
        },
      ],
    });

    const [result] = preserveExistingQuizAuthoringIds([incomingQuestion], [existingQuestion]);

    expect(result.options[0].id).toBe(existingQuestion.options[0].id);
    expect(result.trueFalseStatements[0].id).toBe(existingQuestion.trueFalseStatements[0].id);
    expect(result.scaleOptions[0].id).toBe(existingQuestion.scaleOptions[0].id);
  });
});
