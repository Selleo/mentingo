import { describe, expect, it } from "vitest";

import { appendFeedbackRange, toFormFeedbackRanges } from "./feedbackRanges";

describe("toFormFeedbackRanges", () => {
  it("keeps an edited quiz without bands empty instead of filling defaults", () => {
    expect(toFormFeedbackRanges(undefined)).toEqual([]);
    expect(toFormFeedbackRanges([])).toEqual([]);
  });

  it("keeps band ids so the API can match bands", () => {
    expect(
      toFormFeedbackRanges([{ id: "band-1", minPercent: 0, maxPercent: 100, message: "Hi" }]),
    ).toEqual([{ id: "band-1", minPercent: 0, maxPercent: 100, message: "Hi" }]);
  });
});

describe("appendFeedbackRange", () => {
  it("starts with a band covering the whole scale", () => {
    expect(appendFeedbackRange([])).toEqual([{ minPercent: 0, maxPercent: 100, message: "" }]);
  });

  it("fills the gap after a last band that ends below 100", () => {
    expect(appendFeedbackRange([{ minPercent: 0, maxPercent: 59, message: "Low" }])).toEqual([
      { minPercent: 0, maxPercent: 59, message: "Low" },
      { minPercent: 60, maxPercent: 100, message: "" },
    ]);
  });

  it("splits a last band that ends at 100 instead of overlapping it", () => {
    expect(
      appendFeedbackRange([
        { id: "low", minPercent: 0, maxPercent: 49, message: "Low" },
        { id: "high", minPercent: 50, maxPercent: 100, message: "High" },
      ]),
    ).toEqual([
      { id: "low", minPercent: 0, maxPercent: 49, message: "Low" },
      { id: "high", minPercent: 50, maxPercent: 75, message: "High" },
      { minPercent: 76, maxPercent: 100, message: "" },
    ]);
  });

  it("cannot split a single-point last band", () => {
    expect(appendFeedbackRange([{ minPercent: 100, maxPercent: 100, message: "" }])).toBeNull();
  });
});
