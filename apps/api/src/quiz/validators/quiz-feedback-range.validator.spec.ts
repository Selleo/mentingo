import { FEEDBACK_RANGE_ISSUES, validateFeedbackRanges } from "./quiz-feedback-range.validator";

import type { QuizAuthoringFeedbackRange } from "../types/quiz-authoring.types";

const range = (
  minPercent: number,
  maxPercent: number,
  message: QuizAuthoringFeedbackRange["message"] = "",
): QuizAuthoringFeedbackRange => ({ minPercent, maxPercent, message });

describe("validateFeedbackRanges", () => {
  it("accepts an empty set (no custom feedback configured)", () => {
    expect(validateFeedbackRanges([])).toEqual([]);
  });

  it("accepts a single range covering the whole scale", () => {
    expect(validateFeedbackRanges([range(0, 100)])).toEqual([]);
  });

  it("accepts contiguous ranges that fully cover 0..100", () => {
    expect(validateFeedbackRanges([range(0, 49), range(50, 100)])).toEqual([]);
  });

  it("accepts a valid partition submitted out of order", () => {
    expect(validateFeedbackRanges([range(50, 100), range(0, 49)])).toEqual([]);
  });

  it("accepts a band with an empty message", () => {
    expect(validateFeedbackRanges([range(0, 100, "")])).toEqual([]);
  });

  it("rejects a gap between bands", () => {
    expect(validateFeedbackRanges([range(0, 40), range(50, 100)])).toContain(
      FEEDBACK_RANGE_ISSUES.GAP_OR_OVERLAP,
    );
  });

  it("rejects overlapping bands", () => {
    expect(validateFeedbackRanges([range(0, 60), range(50, 100)])).toContain(
      FEEDBACK_RANGE_ISSUES.GAP_OR_OVERLAP,
    );
  });

  it("rejects bounds outside 0..100", () => {
    expect(validateFeedbackRanges([range(0, 101)])).toContain(FEEDBACK_RANGE_ISSUES.OUT_OF_BOUNDS);
    expect(validateFeedbackRanges([range(-1, 100)])).toContain(FEEDBACK_RANGE_ISSUES.OUT_OF_BOUNDS);
  });

  it("rejects a set that does not start at 0", () => {
    expect(validateFeedbackRanges([range(10, 100)])).toContain(
      FEEDBACK_RANGE_ISSUES.MUST_START_AT_ZERO,
    );
  });

  it("rejects a set that does not end at 100", () => {
    expect(validateFeedbackRanges([range(0, 90)])).toContain(
      FEEDBACK_RANGE_ISSUES.MUST_END_AT_HUNDRED,
    );
  });

  it("rejects reversed bounds", () => {
    expect(validateFeedbackRanges([range(100, 0)])).toContain(
      FEEDBACK_RANGE_ISSUES.BOUNDS_REVERSED,
    );
  });

  it("rejects non-integer bounds", () => {
    expect(validateFeedbackRanges([range(0, 50.5), range(51, 100)])).toContain(
      FEEDBACK_RANGE_ISSUES.NOT_INTEGER,
    );
  });
});
