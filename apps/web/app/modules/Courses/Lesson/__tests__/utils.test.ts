import { expect, describe, it } from "vitest";

import {
  findFirstInProgressLessonId,
  findFirstNotStartedLessonId,
  isNextBlocked,
  isPreviousBlocked,
} from "../utils";

import { data as courseData } from "./data";

export const data = [
  {
    currentLessonIndex: 0,
    totalLessons: 1,
    isNextChapterFreemium: false,
    isEnrolled: false,
  },
  {
    currentLessonIndex: 4,
    totalLessons: 5,
    isNextChapterFreemium: false,
    isEnrolled: false,
  },
  {
    currentLessonIndex: 0,
    totalLessons: 1,
    isNextChapterFreemium: true,
    isEnrolled: false,
  },
  {
    currentLessonIndex: 0,
    totalLessons: 1,
    isNextChapterFreemium: false,
    isEnrolled: true,
  },
  {
    currentLessonIndex: 1,
    totalLessons: 3,
    isNextChapterFreemium: false,
    isEnrolled: false,
  },
  {
    currentLessonIndex: 0,
    totalLessons: 0,
    isNextChapterFreemium: false,
    isEnrolled: false,
  },
  {
    currentLessonIndex: 0,
    totalLessons: 1,
    isPrevChapterFreemium: false,
    isEnrolled: false,
  },
  {
    currentLessonIndex: 1,
    totalLessons: 2,
    isPrevChapterFreemium: false,
    isEnrolled: false,
  },
  {
    currentLessonIndex: 0,
    totalLessons: 1,
    isPrevChapterFreemium: true,
    isEnrolled: false,
  },
  {
    currentLessonIndex: 0,
    totalLessons: 1,
    isPrevChapterFreemium: false,
    isEnrolled: true,
  },
  {
    currentLessonIndex: 0,
    totalLessons: 1,
    isPrevChapterFreemium: true,
    isEnrolled: false,
  },
];

describe("findFirstNotStartedLessonId", () => {
  it("returns the first not started lesson id", () => {
    const firstLessonId = findFirstNotStartedLessonId(courseData[0]);
    expect(firstLessonId).toBe("1665722f-9dbe-48ca-8625-1669d92b9972");
  });

  it("returns undefined if no not started lesson exists", () => {
    const firstLessonId = findFirstNotStartedLessonId(courseData[2]);
    expect(firstLessonId).toBe(undefined);
  });

  it("returns undefined for empty chapters", () => {
    const course = { ...courseData[0], chapters: [] };
    const firstLessonId = findFirstNotStartedLessonId(course);
    expect(firstLessonId).toBe(undefined);
  });
});

describe("findFirstInProgressLessonId", () => {
  it("returns the first in progress lesson id", () => {
    const firstLessonId = findFirstInProgressLessonId(courseData[1]);
    expect(firstLessonId).toBe("1665722f-9dbe-48ca-8625-1669d92b9972");
  });

  it("returns undefined if no in progress lesson exists", () => {
    const firstLessonId = findFirstInProgressLessonId(courseData[2]);
    expect(firstLessonId).toBe(undefined);
  });

  it("returns undefined for empty chapters", () => {
    const course = { ...courseData[1], chapters: [] };
    const firstLessonId = findFirstInProgressLessonId(course);
    expect(firstLessonId).toBe(undefined);
  });
});

describe("isNextBlocked", () => {
  describe("when on last lesson", () => {
    it("returns true when next chapter is paid and user is not enrolled", () => {
      const { currentLessonIndex, totalLessons, isNextChapterFreemium, isEnrolled } = data[0];
      const nextBlocked = isNextBlocked(
        currentLessonIndex,
        totalLessons,
        isNextChapterFreemium ?? false,
        isEnrolled,
      );
      expect(nextBlocked).toBe(true);
    });

    it("returns true when next chapter is paid and user is not enrolled (second case)", () => {
      const { currentLessonIndex, totalLessons, isNextChapterFreemium, isEnrolled } = data[1];
      const nextBlocked = isNextBlocked(
        currentLessonIndex,
        totalLessons,
        isNextChapterFreemium ?? false,
        isEnrolled,
      );
      expect(nextBlocked).toBe(true);
    });

    it("returns false when next chapter is freemium", () => {
      const { currentLessonIndex, totalLessons, isNextChapterFreemium, isEnrolled } = data[2];
      const nextBlocked = isNextBlocked(
        currentLessonIndex,
        totalLessons,
        isNextChapterFreemium ?? false,
        isEnrolled,
      );
      expect(nextBlocked).toBe(false);
    });

    it("returns false when user is enrolled", () => {
      const { currentLessonIndex, totalLessons, isNextChapterFreemium, isEnrolled } = data[3];
      const nextBlocked = isNextBlocked(
        currentLessonIndex,
        totalLessons,
        isNextChapterFreemium ?? false,
        isEnrolled,
      );
      expect(nextBlocked).toBe(false);
    });
  });

  describe("when not on last lesson", () => {
    it("returns false regardless of chapter or enrollment status", () => {
      const { currentLessonIndex, totalLessons, isNextChapterFreemium, isEnrolled } = data[4];
      const nextBlocked = isNextBlocked(
        currentLessonIndex,
        totalLessons,
        isNextChapterFreemium ?? false,
        isEnrolled,
      );
      expect(nextBlocked).toBe(false);
    });
  });

  describe("when no lessons exist", () => {
    it("returns false when totalLessons is 0", () => {
      const { currentLessonIndex, totalLessons, isNextChapterFreemium, isEnrolled } = data[5];
      const nextBlocked = isNextBlocked(
        currentLessonIndex,
        totalLessons,
        isNextChapterFreemium ?? false,
        isEnrolled,
      );
      expect(nextBlocked).toBe(false);
    });
  });
});

describe("isPreviousBlocked", () => {
  describe("when on first lesson", () => {
    it("returns true when previous chapter is paid and user is not enrolled", () => {
      const { currentLessonIndex, isPrevChapterFreemium, isEnrolled } = data[6];
      const previousBlocked = isPreviousBlocked(
        currentLessonIndex,
        isPrevChapterFreemium ?? false,
        isEnrolled,
      );
      expect(previousBlocked).toBe(true);
    });

    it("returns false when previous chapter is freemium", () => {
      const { currentLessonIndex, isPrevChapterFreemium, isEnrolled } = data[8];
      const previousBlocked = isPreviousBlocked(
        currentLessonIndex,
        isPrevChapterFreemium ?? false,
        isEnrolled,
      );
      expect(previousBlocked).toBe(false);
    });

    it("returns false when user is enrolled", () => {
      const { currentLessonIndex, isPrevChapterFreemium, isEnrolled } = data[9];
      const previousBlocked = isPreviousBlocked(
        currentLessonIndex,
        isPrevChapterFreemium ?? false,
        isEnrolled,
      );
      expect(previousBlocked).toBe(false);
    });

    it("returns false when previous chapter is undefined", () => {
      const { currentLessonIndex, isPrevChapterFreemium, isEnrolled } = data[10];
      const previousBlocked = isPreviousBlocked(
        currentLessonIndex,
        isPrevChapterFreemium ?? false,
        isEnrolled,
      );
      expect(previousBlocked).toBe(false);
    });
  });

  describe("when not on first lesson", () => {
    it("returns false regardless of chapter or enrollment status", () => {
      const { currentLessonIndex, isPrevChapterFreemium, isEnrolled } = data[7];
      const previousBlocked = isPreviousBlocked(
        currentLessonIndex,
        isPrevChapterFreemium ?? false,
        isEnrolled,
      );
      expect(previousBlocked).toBe(false);
    });
  });
});
