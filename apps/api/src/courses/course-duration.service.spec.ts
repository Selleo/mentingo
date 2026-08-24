import { LESSON_TYPES } from "src/lesson/lesson.type";

import { CourseDurationService } from "./course-duration.service";
import {
  calculateLessonDurationSeconds,
  emptyLanguageEstimates,
} from "./utils/course-duration.utils";

const resourceId = "11111111-1111-4111-8111-111111111111";

describe("CourseDurationService", () => {
  it("persists lesson and chapter projections with one bulk update each", async () => {
    const repository = {
      withCourseDurationTransaction: jest.fn(async (_courseId, _db, callback) =>
        callback({} as never),
      ),
      getCourseLocalization: jest
        .fn()
        .mockResolvedValue([{ baseLanguage: "pl", availableLocales: ["pl"] }]),
      getChapterDurationRows: jest
        .fn()
        .mockResolvedValue([{ id: "chapter-id", durationEstimates: {} }]),
      getLessonProjectionRows: jest.fn().mockResolvedValue([
        {
          id: "lesson-id",
          chapterId: "chapter-id",
          type: LESSON_TYPES.CONTENT,
          description: { pl: "hello world" },
          questionCount: 0,
        },
      ]),
      getResourceRowsByReferences: jest.fn(),
      updateLessonDurations: jest.fn().mockResolvedValue(undefined),
      updateChapterDurations: jest.fn().mockResolvedValue(undefined),
      updateCourseDuration: jest.fn().mockResolvedValue(undefined),
    };
    const service = new CourseDurationService(repository as never);

    await service.refreshCourseDurationEstimates("course-id" as never);

    expect(repository.updateLessonDurations).toHaveBeenCalledTimes(1);
    expect(repository.updateChapterDurations).toHaveBeenCalledTimes(1);
    expect(repository.updateCourseDuration).toHaveBeenCalledTimes(1);
    expect(repository.updateLessonDurations.mock.calls[0][0]).toEqual([
      { id: "lesson-id", durationEstimates: { pl: { totalSeconds: 1 } } },
    ]);
    expect(repository.updateChapterDurations.mock.calls[0][0]).toEqual([
      { id: "chapter-id", durationEstimates: { pl: { totalSeconds: 1 } } },
    ]);
    expect(repository.updateCourseDuration.mock.calls[0][1]).toEqual({
      pl: { totalSeconds: 1 },
    });
  });

  it("creates projections only for the course's active languages", () => {
    const activeLanguages = ["en", "pl", "en"] as const;

    expect(Object.keys(emptyLanguageEstimates([...new Set(activeLanguages)]))).toEqual([
      "en",
      "pl",
    ]);
  });

  it("uses the ceiling of valid internal video metadata for every video occurrence", () => {
    const html = [
      `<div data-node-type="video" data-src="/api/lesson/lesson-resource/${resourceId}"></div>`,
      `<div data-node-type="video" data-src="/api/lesson/lesson-resource/${resourceId}"></div>`,
    ].join("");
    const resources = new Map([
      [
        resourceId,
        {
          id: resourceId,
          resourceEntityId: null,
          contentType: "video/mp4",
          metadata: { durationSeconds: 12.2 },
        },
      ],
    ]);

    expect(
      calculateLessonDurationSeconds({
        descriptionHtml: html,
        lessonType: LESSON_TYPES.CONTENT,
        quizQuestionCount: 0,
        resourcesByReference: resources,
      }),
    ).toBe(26);
  });

  it("falls back to three minutes for invalid or unresolved video metadata", () => {
    const invalid = "22222222-2222-4222-8222-222222222222";
    const html = [
      `<div data-node-type="video" data-src="/api/lesson/lesson-resource/${invalid}"></div>`,
      `<div data-node-type="video" data-src="https://example.com/video.mp4"></div>`,
    ].join("");
    const resources = new Map([
      [
        invalid,
        {
          id: invalid,
          resourceEntityId: null,
          contentType: "video/mp4",
          metadata: { durationSeconds: 0 },
        },
      ],
    ]);

    expect(
      calculateLessonDurationSeconds({
        descriptionHtml: html,
        lessonType: LESSON_TYPES.CONTENT,
        quizQuestionCount: 0,
        resourcesByReference: resources,
      }),
    ).toBe(360);
  });

  it("does not count a video resource when its ID appears in a non-video node", () => {
    const html = `<div data-node-type="image" data-src="/api/lesson/lesson-resource/${resourceId}"></div>`;
    const resources = new Map([
      [
        resourceId,
        {
          id: resourceId,
          resourceEntityId: null,
          contentType: "video/mp4",
          metadata: { durationSeconds: 600 },
        },
      ],
    ]);

    expect(
      calculateLessonDurationSeconds({
        descriptionHtml: html,
        lessonType: LESSON_TYPES.CONTENT,
        quizQuestionCount: 0,
        resourcesByReference: resources,
      }),
    ).toBe(15);
  });
});
