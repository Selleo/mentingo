import { describe, expect, it } from "vitest";

import { collectFeedbackRangeIssues } from "./feedbackRanges";

import type { QuizFeedbackRange } from "../QuizLessonForm.types";

const range = (minPercent: number, maxPercent: number, message = ""): QuizFeedbackRange => ({
  minPercent,
  maxPercent,
  message,
});

describe("collectFeedbackRangeIssues", () => {
  it("treats an empty set as valid (no custom feedback)", () => {
    expect(collectFeedbackRangeIssues([])).toEqual([]);
  });

  it("accepts a single band covering the whole scale", () => {
    expect(collectFeedbackRangeIssues([range(0, 100)])).toEqual([]);
  });

  it("accepts contiguous bands", () => {
    expect(collectFeedbackRangeIssues([range(0, 49), range(50, 79), range(80, 100)])).toEqual([]);
  });

  it("accepts contiguous bands given out of display order", () => {
    expect(collectFeedbackRangeIssues([range(50, 100), range(0, 49)])).toEqual([]);
  });

  it("allows an empty message on a band", () => {
    expect(collectFeedbackRangeIssues([range(0, 100, "")])).toEqual([]);
  });

  it("flags a gap between bands", () => {
    expect(collectFeedbackRangeIssues([range(0, 40), range(50, 100)])).toContain("gapOrOverlap");
  });

  it("flags overlapping bands", () => {
    expect(collectFeedbackRangeIssues([range(0, 60), range(50, 100)])).toContain("gapOrOverlap");
  });

  it("flags bounds outside 0..100", () => {
    expect(collectFeedbackRangeIssues([range(0, 101)])).toContain("outOfBounds");
  });

  it("flags non-integer bounds", () => {
    expect(collectFeedbackRangeIssues([range(0, 49.5), range(50, 100)])).toContain("notInteger");
  });

  it("flags reversed bounds", () => {
    expect(collectFeedbackRangeIssues([range(60, 40)])).toContain("boundsReversed");
  });

  it("requires the first band to start at zero", () => {
    expect(collectFeedbackRangeIssues([range(10, 100)])).toContain("mustStartAtZero");
  });

  it("requires the last band to end at a hundred", () => {
    expect(collectFeedbackRangeIssues([range(0, 90)])).toContain("mustEndAtHundred");
  });

  it("skips coverage checks while bounds are unusable", () => {
    const issues = collectFeedbackRangeIssues([range(0, 49.5)]);

    expect(issues).toContain("notInteger");
    expect(issues).not.toContain("mustEndAtHundred");
  });
});
