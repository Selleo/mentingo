import { ASSESSMENT_ATTEMPT_GRADING_STATUSES } from "@repo/shared";

import { resolveQuizFeedbackRangeMessage } from "./quiz-feedback-message";

import type { QuizAuthoringFeedbackRange } from "../types/quiz-authoring.types";

const makeFeedbackRange = (
  overrides: Partial<QuizAuthoringFeedbackRange> = {},
): QuizAuthoringFeedbackRange => ({
  minPercent: 0,
  maxPercent: 50,
  message: "",
  ...overrides,
});

// Partition of 0..100 as the author validator guarantees (contiguous, inclusive integer bounds).
const ranges: QuizAuthoringFeedbackRange[] = [
  makeFeedbackRange({ minPercent: 0, maxPercent: 50, message: "Keep going {{firstName}}!" }),
  makeFeedbackRange({
    minPercent: 51,
    maxPercent: 100,
    message: "Great job {{firstName}}, you scored {{score}}%.",
  }),
];

describe("resolveQuizFeedbackRangeMessage", () => {
  it("picks the band containing the score and interpolates firstName and score", () => {
    const message = resolveQuizFeedbackRangeMessage({
      ranges,
      scorePercentage: "80.00",
      gradingStatus: ASSESSMENT_ATTEMPT_GRADING_STATUSES.GRADED,
      firstName: "Ada",
    });

    expect(message).toBe("Great job Ada, you scored 80%.");
  });

  it("floors the score so the band and {{score}} use the same integer", () => {
    const message = resolveQuizFeedbackRangeMessage({
      ranges,
      scorePercentage: "50.99",
      gradingStatus: ASSESSMENT_ATTEMPT_GRADING_STATUSES.GRADED,
      firstName: "Ada",
    });

    // 50.99 floors to 50, which belongs to the lower band (no {{score}} token there).
    expect(message).toBe("Keep going Ada!");
  });

  it("matches the inclusive upper bound of the top band", () => {
    const message = resolveQuizFeedbackRangeMessage({
      ranges,
      scorePercentage: "100.00",
      gradingStatus: ASSESSMENT_ATTEMPT_GRADING_STATUSES.GRADED,
      firstName: "Ada",
    });

    expect(message).toBe("Great job Ada, you scored 100%.");
  });

  it("returns null until the attempt is fully graded", () => {
    const message = resolveQuizFeedbackRangeMessage({
      ranges,
      scorePercentage: "80.00",
      gradingStatus: ASSESSMENT_ATTEMPT_GRADING_STATUSES.PENDING,
      firstName: "Ada",
    });

    expect(message).toBeNull();
  });

  it("returns null when there is no score yet", () => {
    const message = resolveQuizFeedbackRangeMessage({
      ranges,
      scorePercentage: null,
      gradingStatus: ASSESSMENT_ATTEMPT_GRADING_STATUSES.GRADED,
      firstName: "Ada",
    });

    expect(message).toBeNull();
  });

  it("returns null when the matched band has no message", () => {
    const message = resolveQuizFeedbackRangeMessage({
      ranges: [makeFeedbackRange({ minPercent: 0, maxPercent: 100, message: "" })],
      scorePercentage: "42.00",
      gradingStatus: ASSESSMENT_ATTEMPT_GRADING_STATUSES.GRADED,
      firstName: "Ada",
    });

    expect(message).toBeNull();
  });

  it("returns null when no author ranges are configured", () => {
    const message = resolveQuizFeedbackRangeMessage({
      ranges: [],
      scorePercentage: "42.00",
      gradingStatus: ASSESSMENT_ATTEMPT_GRADING_STATUSES.GRADED,
      firstName: "Ada",
    });

    expect(message).toBeNull();
  });
});
