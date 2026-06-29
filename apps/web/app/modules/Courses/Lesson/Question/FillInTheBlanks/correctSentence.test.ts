import { describe, expect, it } from "vitest";

import { getCorrectSentence } from "./correctSentence";

import type { QuizQuestion } from "../types";

const buildQuestion = (overrides: Partial<QuizQuestion>): QuizQuestion =>
  ({
    id: "question-1",
    type: "fill_in_the_blanks_text",
    title: "Question",
    displayOrder: 1,
    description: null,
    solutionExplanation: null,
    photoS3Key: null,
    passQuestion: false,
    options: [],
    ...overrides,
  }) as QuizQuestion;

describe("getCorrectSentence", () => {
  it("uses stored solution explanation when it exists", () => {
    expect(
      getCorrectSentence(
        buildQuestion({
          solutionExplanation: "<p>Stored sentence</p>",
        }),
      ),
    ).toBe("<p>Stored sentence</p>");
  });

  it("derives a sentence from blank answer markers", () => {
    expect(
      getCorrectSentence(
        buildQuestion({
          description: "<p>The <blank-answer-answer-1> answer.</p>",
          solutionExplanation: null,
          options: [
            {
              id: "answer-1",
              optionText: "correct",
              displayOrder: 1,
              isCorrect: true,
              isStudentAnswer: false,
              studentAnswer: "wrong",
            },
          ],
        }),
      ),
    ).toBe("The <strong>correct</strong> answer.");
  });

  it("derives a sentence from legacy word markers by display order", () => {
    expect(
      getCorrectSentence(
        buildQuestion({
          description: "First [word], then [word].",
          solutionExplanation: null,
          options: [
            {
              id: "answer-2",
              optionText: "second",
              displayOrder: 2,
              isCorrect: true,
              isStudentAnswer: false,
              studentAnswer: "wrong",
            },
            {
              id: "answer-1",
              optionText: "first",
              displayOrder: 1,
              isCorrect: true,
              isStudentAnswer: true,
              studentAnswer: "first",
            },
          ],
        }),
      ),
    ).toBe("First <strong>first</strong>, then <strong>second</strong>.");
  });

  it("returns null when there is not enough data to build a sentence", () => {
    expect(
      getCorrectSentence(
        buildQuestion({
          description: "The <blank-answer-answer-1> answer.",
          solutionExplanation: null,
          options: [],
        }),
      ),
    ).toBeNull();
  });

  it("returns null when only some blanks can be resolved", () => {
    expect(
      getCorrectSentence(
        buildQuestion({
          description: "First <blank-answer-answer-1>, then <blank-answer-answer-2>.",
          solutionExplanation: null,
          options: [
            {
              id: "answer-1",
              optionText: "first",
              displayOrder: 1,
              isCorrect: true,
              isStudentAnswer: true,
              studentAnswer: "first",
            },
          ],
        }),
      ),
    ).toBeNull();
  });
});
