import { describe, expect, it } from "vitest";

import { LESSON_PROGRESS_STATUSES } from "~/modules/Courses/Lesson/types";

import {
  formatDuration,
  formatDurationToDisplayBucket,
  roundDurationToDisplayBucket,
  sumChapterDisplayDurations,
  sumRemainingChapterDisplayDurations,
} from "../formatDuration";

import type { TFunction } from "i18next";

const t = ((key: string, options?: { hours?: number; minutes?: number }) => {
  const hours = options?.hours ?? 0;
  const minutes = options?.minutes ?? 0;

  const translations: Record<string, string> = {
    "modernCourseView.stats.duration.minutes": `${minutes} min`,
    "modernCourseView.stats.duration.hours": `${hours} h`,
    "modernCourseView.stats.duration.hoursAndMinutes": `${hours} h ${minutes} min`,
  };

  return translations[key] ?? key;
}) as TFunction;

describe("formatDuration", () => {
  it.each([
    [undefined, "0 min"],
    [0, "0 min"],
    [59, "1 min"],
    [3600, "1 h"],
    [3660, "1 h 1 min"],
  ])("formats %s seconds as %s", (seconds, expected) => {
    expect(formatDuration(seconds, t)).toBe(expected);
  });
});

describe("roundDurationToDisplayBucket", () => {
  it.each([
    [undefined, "0 min"],
    [0, "0 min"],
    [1, "15 min"],
    [899, "15 min"],
    [900, "15 min"],
    [901, "30 min"],
    [3_600, "1 h"],
    [3_601, "1 h 15 min"],
  ])("rounds %s seconds up to the nearest 15-minute display bucket as %s", (seconds, expected) => {
    expect(formatDurationToDisplayBucket(seconds, t)).toBe(expected);
  });
});

describe("chapter display aggregation", () => {
  it("preserves zero and rounds each chapter for display before summing", () => {
    expect(roundDurationToDisplayBucket(0)).toBe(0);
    expect(sumChapterDisplayDurations([0, 1, 900, 901])).toBe(3_600);
  });

  it("does not round the exact course total as one display bucket", () => {
    expect(sumChapterDisplayDurations([1, 1])).toBe(1_800);
    expect(roundDurationToDisplayBucket(2)).toBe(900);
  });

  it("groups incomplete lessons by chapter before display rounding", () => {
    expect(
      sumRemainingChapterDisplayDurations([
        {
          lessons: [
            { estimatedDurationSeconds: 1, status: LESSON_PROGRESS_STATUSES.IN_PROGRESS },
            { estimatedDurationSeconds: 1, status: LESSON_PROGRESS_STATUSES.COMPLETED },
          ],
        },
        {
          lessons: [
            { estimatedDurationSeconds: 1, status: LESSON_PROGRESS_STATUSES.NOT_STARTED },
            { estimatedDurationSeconds: 1, status: LESSON_PROGRESS_STATUSES.COMPLETED },
          ],
        },
      ]),
    ).toBe(1_800);
  });
});
