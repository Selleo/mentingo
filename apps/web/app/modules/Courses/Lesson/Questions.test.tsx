import { ASSESSMENT_QUESTION_TYPES } from "@repo/shared";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Question } from "app/modules/Courses/Lesson/Question";

import { Questions } from "./Questions";

import type { QuizQuestion } from "./Question/types";

vi.mock("app/modules/Courses/Lesson/Question", () => ({ Question: vi.fn(() => null) }));

describe("learner quiz question numbering", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    { name: "zero-based", positions: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
    { name: "one-based", positions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { name: "shuffled", positions: [9, 0, 4, 3, 8, 2, 7, 6, 5, 1] },
  ])(
    "numbers the displayed $name questions without changing their identity or order",
    ({ positions }) => {
      const questions: QuizQuestion[] = Object.values(ASSESSMENT_QUESTION_TYPES).map(
        (type, index) => ({
          id: `question-${index}`,
          type,
          title: `Author title ${index}`,
          displayOrder: positions[index],
          solutionExplanation: null,
          passQuestion: null,
          options: [],
        }),
      );
      const original = structuredClone(questions);

      render(<Questions questions={questions} lessonId="lesson-1" isQuizCompleted />);

      const calls = vi.mocked(Question).mock.calls.map(([props]) => props);
      expect(calls.map(({ question }) => question)).toEqual(
        original.map((question, index) => ({
          ...question,
          displayOrder: index + 1,
        })),
      );
      expect(
        calls.every(({ isCompleted, lessonId }) => isCompleted && lessonId === "lesson-1"),
      ).toBe(true);
      calls.forEach(({ question }, index) => {
        expect(question).not.toBe(questions[index]);
        expect(question.options).toBe(questions[index].options);
      });
      expect(questions).toEqual(original);
    },
  );
});
