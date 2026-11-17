import type { QuizQuestion, QuizQuestionOption } from "./types";

// Test-only builders for the generated QuizQuestion shape. The return-type annotation checks the
// defaults against the real type, so tests get a fully-typed object from overrides without casting.

export const makeQuizQuestionOption = (
  overrides: Partial<QuizQuestionOption> = {},
): QuizQuestionOption => ({
  id: "option-1",
  optionText: "Option",
  displayOrder: 1,
  isStudentAnswer: false,
  studentAnswer: null,
  isCorrect: false,
  ...overrides,
});

export const makeQuizQuestion = (overrides: Partial<QuizQuestion> = {}): QuizQuestion => ({
  id: "question-1",
  type: "single_choice",
  title: "Question title",
  displayOrder: 1,
  solutionExplanation: null,
  passQuestion: false,
  ...overrides,
});
