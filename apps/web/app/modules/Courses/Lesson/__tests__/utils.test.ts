import { expect, describe, it } from "vitest";

import {
  findFirstInProgressLessonId,
  findFirstNotStartedLessonId,
  isNextBlocked,
  isPreviousBlocked,
} from "../utils";

import type { GetCourseResponse } from "~/api/generated-api";

describe("findFirstNotStartedLessonId", () => {
  it("returns the first not started lesson id", () => {
    const courseData = {
      chapters: [
        {
          lessons: [
            {
              id: "1665722f-9dbe-48ca-8625-1669d92b9972",
              status: "not_started",
            },
            {
              id: "805eca43-9162-4e19-b3f6-e2506b79f531",
              status: "not_started",
            },
          ],
        },
      ],
    } as GetCourseResponse["data"];
    const firstLessonId = findFirstNotStartedLessonId(courseData);
    expect(firstLessonId).toBe("1665722f-9dbe-48ca-8625-1669d92b9972");
  });

  it("returns undefined if no not started lesson exists", () => {
    const courseData = {
      chapters: [
        {
          lessons: [
            {
              id: "1665722f-9dbe-48ca-8625-1669d92b9972",
              status: "completed",
            },
            {
              id: "805eca43-9162-4e19-b3f6-e2506b79f531",
              status: "completed",
            },
          ],
        },
      ],
    } as GetCourseResponse["data"];
    const firstLessonId = findFirstNotStartedLessonId(courseData);
    expect(firstLessonId).toBe(undefined);
  });

  it("returns undefined for empty chapters", () => {
    const courseData = {
      chapters: [],
    } as unknown as GetCourseResponse["data"];
    const firstLessonId = findFirstNotStartedLessonId(courseData);
    expect(firstLessonId).toBe(undefined);
  });
});

describe("findFirstInProgressLessonId", () => {
  it("returns the first in progress lesson id", () => {
    const courseData = {
      chapters: [
        {
          lessons: [
            {
              id: "1665722f-9dbe-48ca-8625-1669d92b9972",
              status: "in_progress",
            },
            {
              id: "805eca43-9162-4e19-b3f6-e2506b79f531",
              status: "not_started",
            },
          ],
        },
      ],
    } as GetCourseResponse["data"];

    const firstLessonId = findFirstInProgressLessonId(courseData);
    expect(firstLessonId).toBe("1665722f-9dbe-48ca-8625-1669d92b9972");
  });

  it("returns undefined if no in progress lesson exists", () => {
    const courseData = {
      chapters: [
        {
          lessons: [
            {
              id: "1665722f-9dbe-48ca-8625-1669d92b9972",
              status: "completed",
            },
            {
              id: "805eca43-9162-4e19-b3f6-e2506b79f531",
              status: "completed",
            },
          ],
        },
      ],
    } as GetCourseResponse["data"];
    const firstLessonId = findFirstInProgressLessonId(courseData);
    expect(firstLessonId).toBe(undefined);
  });

  it("returns undefined for empty chapters", () => {
    const courseData = {
      chapters: [],
    } as unknown as GetCourseResponse["data"];
    const firstLessonId = findFirstInProgressLessonId(courseData);
    expect(firstLessonId).toBe(undefined);
  });
});

describe("isNextBlocked", () => {
  describe("when on last lesson", () => {
    it("returns true when next chapter is paid and user is not enrolled", () => {
      const data = {
        currentLessonIndex: 0,
        totalLessons: 1,
        isNextChapterFreemium: false,
        isEnrolled: false,
      };

      const { currentLessonIndex, totalLessons, isNextChapterFreemium, isEnrolled } = data;
      const nextBlocked = isNextBlocked(
        currentLessonIndex,
        totalLessons,
        isNextChapterFreemium ?? false,
        isEnrolled,
      );
      expect(nextBlocked).toBe(true);
    });

    it("returns true when next chapter is paid and user is not enrolled (second case)", () => {
      const data = {
        currentLessonIndex: 4,
        totalLessons: 5,
        isNextChapterFreemium: false,
        isEnrolled: false,
      };

      const { currentLessonIndex, totalLessons, isNextChapterFreemium, isEnrolled } = data;
      const nextBlocked = isNextBlocked(
        currentLessonIndex,
        totalLessons,
        isNextChapterFreemium ?? false,
        isEnrolled,
      );
      expect(nextBlocked).toBe(true);
    });

    it("returns false when next chapter is freemium", () => {
      const data = {
        currentLessonIndex: 0,
        totalLessons: 1,
        isNextChapterFreemium: true,
        isEnrolled: false,
      };

      const { currentLessonIndex, totalLessons, isNextChapterFreemium, isEnrolled } = data;
      const nextBlocked = isNextBlocked(
        currentLessonIndex,
        totalLessons,
        isNextChapterFreemium ?? false,
        isEnrolled,
      );
      expect(nextBlocked).toBe(false);
    });

    it("returns false when user is enrolled", () => {
      const data = {
        currentLessonIndex: 0,
        totalLessons: 1,
        isNextChapterFreemium: false,
        isEnrolled: true,
      };
      const { currentLessonIndex, totalLessons, isNextChapterFreemium, isEnrolled } = data;
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
      const data = {
        currentLessonIndex: 1,
        totalLessons: 3,
        isNextChapterFreemium: false,
        isEnrolled: false,
      };
      const { currentLessonIndex, totalLessons, isNextChapterFreemium, isEnrolled } = data;
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
      const data = {
        currentLessonIndex: 0,
        totalLessons: 0,
        isNextChapterFreemium: false,
        isEnrolled: false,
      };
      const { currentLessonIndex, totalLessons, isNextChapterFreemium, isEnrolled } = data;
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
      const data = {
        currentLessonIndex: 0,
        totalLessons: 1,
        isPrevChapterFreemium: false,
        isEnrolled: false,
      };
      const { currentLessonIndex, isPrevChapterFreemium, isEnrolled } = data;
      const previousBlocked = isPreviousBlocked(
        currentLessonIndex,
        isPrevChapterFreemium ?? false,
        isEnrolled,
      );
      expect(previousBlocked).toBe(true);
    });

    it("returns false when previous chapter is freemium", () => {
      const data = {
        currentLessonIndex: 0,
        totalLessons: 1,
        isPrevChapterFreemium: true,
        isEnrolled: false,
      };
      const { currentLessonIndex, isPrevChapterFreemium, isEnrolled } = data;
      const previousBlocked = isPreviousBlocked(
        currentLessonIndex,
        isPrevChapterFreemium ?? false,
        isEnrolled,
      );
      expect(previousBlocked).toBe(false);
    });

    it("returns false when user is enrolled", () => {
      const data = {
        currentLessonIndex: 0,
        totalLessons: 1,
        isPrevChapterFreemium: false,
        isEnrolled: true,
      };
      const { currentLessonIndex, isPrevChapterFreemium, isEnrolled } = data;
      const previousBlocked = isPreviousBlocked(
        currentLessonIndex,
        isPrevChapterFreemium ?? false,
        isEnrolled,
      );
      expect(previousBlocked).toBe(false);
    });

    it("returns false when previous chapter is undefined", () => {
      const data = {
        currentLessonIndex: 0,
        totalLessons: 1,
        isPrevChapterFreemium: true,
        isEnrolled: false,
      };
      const { currentLessonIndex, isPrevChapterFreemium, isEnrolled } = data;
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
      const data = {
        currentLessonIndex: 1,
        totalLessons: 2,
        isPrevChapterFreemium: false,
        isEnrolled: false,
      };
      const { currentLessonIndex, isPrevChapterFreemium, isEnrolled } = data;
      const previousBlocked = isPreviousBlocked(
        currentLessonIndex,
        isPrevChapterFreemium ?? false,
        isEnrolled,
      );
      expect(previousBlocked).toBe(false);
    });
  });
});
