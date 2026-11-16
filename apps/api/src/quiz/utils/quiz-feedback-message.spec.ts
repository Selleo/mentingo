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

    expect(message).toBe("Keep going Ada!");
  });

  it.each(["49.5", "49.99"])(
    "puts a fractional %s%% score into the 0-49 band",
    (scorePercentage) => {
      const message = resolveQuizFeedbackRangeMessage({
        ranges: [
          makeFeedbackRange({ minPercent: 0, maxPercent: 49, message: "Low {{score}}" }),
          makeFeedbackRange({ minPercent: 50, maxPercent: 100, message: "High {{score}}" }),
        ],
        scorePercentage,
        gradingStatus: ASSESSMENT_ATTEMPT_GRADING_STATUSES.GRADED,
        firstName: "Ada",
      });

      expect(message).toBe("Low 49");
    },
  );

  it("escapes HTML in the first name", () => {
    const message = resolveQuizFeedbackRangeMessage({
      ranges: [
        makeFeedbackRange({ minPercent: 0, maxPercent: 100, message: "<p>Hi {{firstName}}</p>" }),
      ],
      scorePercentage: "42.00",
      gradingStatus: ASSESSMENT_ATTEMPT_GRADING_STATUSES.GRADED,
      firstName: '<img src=x onerror="alert(1)">',
    });

    expect(message).toBe("<p>Hi &lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>");
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
